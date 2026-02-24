import * as crypto from "crypto";
import { SSMClient, GetParameterCommand, PutParameterCommand } from "@aws-sdk/client-ssm";

const log = {
  info: (msg: string, extra?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: "info", message: msg, ...extra })),
  error: (msg: string, extra?: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: "error", message: msg, ...extra })),
};

// Lambda Function URL event shape (payload format version 2.0)
interface LambdaFunctionUrlEvent {
  requestContext: {
    http: {
      method: string;
      path: string;
    };
  };
  rawPath: string;
  queryStringParameters?: Record<string, string>;
  headers: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded?: boolean;
}

interface LambdaFunctionUrlResult {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

interface AgentSessionEvent {
  type: string;
  action: string;
  agentSession?: {
    id: string;
    status: string;
    issue?: { id: string; title: string; description: string };
  };
  agentActivity?: { body: string };
}

// Token cached for the lifetime of this Lambda container
let cachedLinearToken: string | undefined;

async function getLinearToken(): Promise<string> {
  if (cachedLinearToken) return cachedLinearToken;

  const paramName = process.env.LINEAR_TOKEN_PARAM;
  if (!paramName) return "";

  const ssm = new SSMClient({});
  const response = await ssm.send(
    new GetParameterCommand({ Name: paramName, WithDecryption: true }),
  );
  cachedLinearToken = response.Parameter?.Value ?? "";
  return cachedLinearToken!;
}

export const handler = async (
  event: LambdaFunctionUrlEvent,
): Promise<LambdaFunctionUrlResult> => {
  const { method, path } = event.requestContext.http;

  if (method === "GET" && path === "/oauth/callback") {
    return handleOAuthCallback(event);
  }

  if (method === "POST") {
    return handleWebhook(event);
  }

  return { statusCode: 404, body: "Not found" };
};

async function handleOAuthCallback(
  event: LambdaFunctionUrlEvent,
): Promise<LambdaFunctionUrlResult> {
  const code = event.queryStringParameters?.code;
  if (!code) {
    return { statusCode: 400, body: "Missing code parameter" };
  }

  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;
  const callbackUrl = process.env.LINEAR_CALLBACK_URL;
  const paramName = process.env.LINEAR_TOKEN_PARAM;

  if (!clientId || !clientSecret || !callbackUrl || !paramName) {
    log.error("Missing OAuth configuration");
    return { statusCode: 500, body: "Server configuration error" };
  }

  // Exchange authorization code for access token
  const tokenResponse = await fetch("https://api.linear.app/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    log.error("Token exchange failed", { status: tokenResponse.status, body: await tokenResponse.text() });
    return { statusCode: 502, body: "Token exchange failed" };
  }

  const { access_token } = (await tokenResponse.json()) as {
    access_token: string;
  };

  // Store token in SSM Parameter Store and invalidate cache
  const ssm = new SSMClient({});
  await ssm.send(
    new PutParameterCommand({
      Name: paramName,
      Value: access_token,
      Type: "SecureString",
      Overwrite: true,
    }),
  );
  cachedLinearToken = undefined;

  log.info("OAuth token stored successfully");
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: "<html><body><h1>Agent installed successfully!</h1><p>You may close this window.</p></body></html>",
  };
}

async function handleWebhook(
  event: LambdaFunctionUrlEvent,
): Promise<LambdaFunctionUrlResult> {
  // Validate HMAC-SHA256 signature
  const sig = event.headers["linear-signature"] ?? "";
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!secret) {
    log.error("LINEAR_WEBHOOK_SECRET is not set");
    return { statusCode: 500, body: "Server configuration error" };
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(event.body ?? "")
    .digest();

  if (!sig || !/^[0-9a-f]+$/i.test(sig) || sig.length !== expected.length * 2) {
    return { statusCode: 401, body: "Invalid signature" };
  }

  if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), expected)) {
    return { statusCode: 401, body: "Invalid signature" };
  }

  let payload: AgentSessionEvent;
  try {
    payload = JSON.parse(event.body ?? "");
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }
  if (payload.type !== "AgentSessionEvent") {
    log.info("Ignored non-AgentSessionEvent webhook", { type: payload.type });
    return { statusCode: 200, body: "Ignored" };
  }

  const { action, agentSession, agentActivity } = payload;

  if (!action) {
    return { statusCode: 400, body: "Missing action" };
  }
  if (!agentSession?.id) {
    return { statusCode: 400, body: "Missing agentSession.id" };
  }
  if (action !== "create" && !agentActivity?.body) {
    return { statusCode: 400, body: "Missing agentActivity.body" };
  }

  const session = agentSession;
  const issue = session.issue ?? { id: "", title: "", description: "" };

  const linearToken = await getLinearToken();

  // Post immediate thought to Linear — must arrive within 10 seconds
  await postLinearActivity(linearToken, session.id, "thought", "Received issue. Starting work...");

  let githubToken: string;
  try {
    githubToken = await generateGitHubInstallationToken();
  } catch (err) {
    log.error("Failed to generate GitHub token", { error: String(err) });
    await postLinearActivity(linearToken, session.id, "response", "Internal error: could not authenticate with GitHub");
    return { statusCode: 500, body: "GitHub auth failed" };
  }

  const dispatchResponse = await fetch(
    "https://api.github.com/repos/pulumi/ci-mgmt/actions/workflows/linear-agent.yml/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "master",
        inputs: {
          linear_session_id: session.id,
          linear_issue_id: issue.id,
          issue_title: issue.title,
          issue_body: issue.description,
          event_type: action === "create" ? "created" : "prompted",
          prompt_body: agentActivity?.body ?? "",
        },
      }),
    },
  );

  if (!dispatchResponse.ok) {
    const errorBody = await dispatchResponse.text();
    log.error("GitHub dispatch failed", { status: dispatchResponse.status, body: errorBody });
    await postLinearActivity(
      linearToken,
      session.id,
      "response",
      `Failed to start workflow: ${dispatchResponse.status}`,
    );
    return { statusCode: 500, body: "Failed to trigger workflow" };
  }

  log.info("Webhook dispatched", { sessionId: session.id, action });
  return { statusCode: 200, body: "OK" };
}

// Generates a short-lived GitHub installation access token using App credentials.
// Mirrors what `actions/create-github-app-token` does in CI.
async function generateGitHubInstallationToken(): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  // Private key may have literal '\n' sequences in the env var — normalize them.
  const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

  if (!appId || !installationId || !privateKey) {
    throw new Error("Missing GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, or GITHUB_APP_PRIVATE_KEY");
  }

  // Build a JWT (RS256) signed with the App's private key
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: appId, iat: now - 60, exp: now + 600 }),
  ).toString("base64url");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const jwt = `${header}.${payload}.${signer.sign(privateKey, "base64url")}`;

  // Exchange the JWT for an installation access token
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status} ${await res.text()}`);
  }

  const { token } = (await res.json()) as { token: string };
  return token;
}

async function postLinearActivity(
  token: string,
  sessionId: string,
  type: string,
  body: string,
): Promise<void> {
  if (!token) {
    log.error("No Linear token available — OAuth installation may be incomplete");
    return;
  }

  const escapedBody = body.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation {
        agentActivityCreate(input: {
          sessionId: "${sessionId}"
          type: ${type}
          body: "${escapedBody}"
        }) { success }
      }`,
    }),
  });

  if (!response.ok) {
    log.error("Failed to post Linear activity", { status: response.status, body: await response.text() });
  }
}

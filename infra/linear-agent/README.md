# linear-agent

AWS Lambda webhook receiver that bridges Linear AI agent sessions with GitHub Actions workflows.
Deployed as a Pulumi stack to AWS.

## Architecture

```
Linear Issue → assigned to "Provider Agent"
                         │
                         │ AgentSessionEvent webhook (signed HMAC-SHA256)
                         ▼
              AWS Lambda (Function URL)
              handler.ts
              1. Validate signature
              2. Post "thought" to Linear  ← must happen within 10s of webhook
              3. Generate GitHub App token
              4. Dispatch linear-agent.yml workflow
                         │
                         │ workflow_dispatch
                         ▼
              .github/workflows/linear-agent.yml  (Claude orchestrator)
                         │
              ┌──────────┴──────────┐
              │  per-repo workers   │
              ▼                     ▼
        linear-agent-worker.yml  ...
        (Claude per-repo)
```

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Pulumi IaC: Lambda, Function URL, IAM role, SSM parameter |
| `handler.ts` | Lambda handler: signature validation, Linear ↔ GitHub bridge |
| `Pulumi.yaml` | Project manifest |
| `Pulumi.corp.yaml` | Stack config (encrypted secrets) |

## Environment Variables (set by `index.ts`)

| Variable | Source | Purpose |
|----------|--------|---------|
| `LINEAR_WEBHOOK_SECRET` | Pulumi secret | HMAC-SHA256 key for validating webhook signatures |
| `LINEAR_CLIENT_ID` | Pulumi config | OAuth app client ID |
| `LINEAR_CLIENT_SECRET` | Pulumi secret | OAuth app client secret |
| `LINEAR_CALLBACK_URL` | Pulumi config | OAuth redirect URL (`{funcUrl}/oauth/callback`) |
| `LINEAR_TOKEN_PARAM` | SSM param name | SSM SecureString holding the Linear OAuth token |
| `GITHUB_APP_ID` | Pulumi config | GitHub App ID |
| `GITHUB_APP_INSTALLATION_ID` | Pulumi config | GitHub App installation ID (pulumi org) |
| `GITHUB_APP_PRIVATE_KEY` | Pulumi secret | RSA private key (literal `\n` sequences are normalized) |

## Deployment

### First deploy (bootstrap)

```bash
cd infra/linear-agent
pulumi up                                  # creates resources; func URL not yet in config
WEBHOOK_URL=$(pulumi stack output webhookUrl)
pulumi config set linearCallbackUrl "${WEBHOOK_URL}oauth/callback"
pulumi up                                  # injects callback URL into Lambda env
```

### OAuth installation

Once deployed, authorize the Linear app to install it as an agent:

```
https://linear.app/oauth/authorize
  ?client_id=<LINEAR_CLIENT_ID>
  &redirect_uri=<LINEAR_CALLBACK_URL>
  &scope=app:assignable,app:mentionable,read,write
  &response_type=code
  &actor=app          ← required: installs as agent, not user
```

Linear redirects to the callback URL with `?code=...`. The Lambda exchanges it for an
access token and stores it in SSM Parameter Store (`linear-token`). The token is cached
in the Lambda container's memory for subsequent warm invocations.

### Subsequent deploys

```bash
pulumi up
```

---

## Linear Agent API Reference

Official docs: https://linear.app/developers/agent-interaction

### Webhook: `AgentSessionEvent`

Enable the "Agent session events" webhook category on your OAuth app.
Linear sends a POST to the Function URL with these headers:

| Header | Value |
|--------|-------|
| `Linear-Signature` | Hex-encoded `HMAC-SHA256(secret, rawBody)` |
| `Linear-Event` | `AgentSessionEvent` |
| `Linear-Delivery` | UUID per delivery |

**Signature verification** (see `handler.ts:handleWebhook`):

```typescript
const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest();
crypto.timingSafeEqual(Buffer.from(sig, "hex"), hmac);
```

Always use the **raw bytes** for HMAC — never re-serialize parsed JSON.
Also check `isBase64Encoded` since Lambda Function URL can base64-encode the body.

### Webhook payload shape

```typescript
interface AgentSessionEventWebhookPayload {
  type: "AgentSessionEvent";
  action: "created" | "prompted";

  agentSession: {
    id: string;
    status: AgentSessionStatus;
    issue?: {
      id: string;
      title: string;
      description: string;    // markdown
    };
    comment?: { body: string; id: string; userId: string };
    url?: string;
  };

  // Only present on "prompted" events
  agentActivity?: {
    id: string;
    agentSessionId: string;
    content: JSONObject;      // see AgentActivityContent types below
    signal?: AgentActivitySignal;
    signalMetadata?: JSONObject;
    userId: string;
    user: { id: string; name: string };
    sourceCommentId?: string;
    createdAt: string;
    updatedAt: string;
    ephemeral: boolean;
  };

  // Pre-formatted context string (useful for "created" events)
  promptContext?: string;
  previousComments?: Array<{ body: string; id: string; userId: string }>;
  guidance?: Array<{ ... }>;

  appUserId: string;
  organizationId: string;
  oauthClientId: string;
  webhookTimestamp: number;   // Unix milliseconds; reject if > 1 minute old
}
```

### Action types

| `action` | When | `agentActivity` present? |
|----------|------|--------------------------|
| `created` | Issue assigned to agent / first mention | No |
| `prompted` | User sends a follow-up message in the session | Yes |

**Timing requirement**: After a `created` event you **must** post an activity or update
`externalUrls` within **10 seconds**, or Linear marks the session as unresponsive.
The Lambda responds to this by calling `postLinearActivity(..., "thought", "...")` before
doing any async work.

### `AgentSessionStatus` values

`pending` | `active` | `awaitingInput` | `complete` | `error` | `stale`

Linear manages status automatically based on the last activity emitted.

---

### Posting activities: `agentActivityCreate`

```graphql
mutation AgentActivityCreate($input: AgentActivityCreateInput!) {
  agentActivityCreate(input: $input) {
    success
    agentActivity { id content signal createdAt }
  }
}
```

```typescript
interface AgentActivityCreateInput {
  agentSessionId: string;     // required
  content: AgentActivityContent;  // required: JSONObject with `type` + type fields
  signal?: AgentActivitySignal;
  signalMetadata?: JSONObject;
  ephemeral?: boolean;        // if true, hides once the next activity is posted
  id?: string;                // optional idempotency key
  contextualMetadata?: JSONObject;
}
```

### Activity content types

The `content` field is a `JSONObject` with a `type` discriminant:

| `type` | Fields | Notes |
|--------|--------|-------|
| `thought` | `type`, `body` (Markdown) | Internal reasoning; set `ephemeral: true` to auto-hide |
| `response` | `type`, `body` (Markdown) | Final answer shown to the user |
| `error` | `type`, `body` (Markdown) | Reports a failure state |
| `action` | `type`, `action` (tool name), `parameter?`, `result?` (Markdown) | Tool invocation |
| `elicitation` | `type`, `body` (Markdown) | Ask the user a question; pair with `select` or `auth` signal |
| `prompt` | — | Set by Linear when user writes; **agents cannot create this type** |

Example:
```json
{ "type": "thought", "body": "Checking provider config..." }
{ "type": "response", "body": "Created PR: https://github.com/..." }
{ "type": "action", "action": "create_pr", "result": "PR #123 opened" }
```

### Signals

Signals modify how an activity is interpreted by the UI.

| Signal | Direction | Activity type | Meaning |
|--------|-----------|--------------|---------|
| `stop` | Human → Agent | `prompt` | User clicked "stop"; agent must halt and emit `response` or `error` |
| `auth` | Agent → Human | `elicitation` | Auth required; `signalMetadata.url` is the auth link |
| `select` | Agent → Human | `elicitation` | Show options; `signalMetadata.options: [{label, value}]` |
| `continue` | — | — | Documented in schema; exact semantics TBD |

When a user responds to a `select` elicitation, Linear sends a `prompted` webhook with
their selection as a normal `agentActivity`.

### Updating external URLs

Use this to link the session to external resources (e.g. a GitHub workflow run URL),
and also to satisfy the 10-second activity requirement after `created`:

```graphql
mutation {
  agentSessionUpdate(id: $sessionId, input: {
    addedExternalUrls: [{ label: "GitHub run", url: "https://..." }]
  }) { success }
}
```

---

## GitHub App token generation

`handler.ts:generateGitHubInstallationToken` mirrors `actions/create-github-app-token`:

1. Build a RS256-signed JWT:
   - Header: `{"alg":"RS256","typ":"JWT"}`
   - Payload: `{"iss":"<APP_ID>","iat":<now-60>,"exp":<now+600>}` (60s clock skew buffer)
2. POST to `https://api.github.com/app/installations/{installationId}/access_tokens`
3. Returns a short-lived token scoped to the installation.

The private key env var may contain literal `\n` sequences (common in Pulumi/CI secret
storage); the handler normalizes these with `.replace(/\\n/g, "\n")`.

---

## Common bugs and gotchas

### Linear field names differ from what you'd expect

- Webhook `agentActivity.content` is a `JSONObject` (not a string `body`).
  The user's message text is inside `content`, not at `agentActivity.body`.
- `AgentActivityCreateInput.agentSessionId` — not `sessionId`.
- `AgentActivityCreateInput.content` is a JSONObject `{type, ...fields}` — not a flat
  `type` + `body` at the top level.

### Signature validation has no log on failure

The HMAC paths return 401 silently. If you see a 48ms Lambda invocation with no log
output, the signature check is failing. Add `log.error(...)` before early returns to
diagnose (see debug section below).

### Lambda base64-encodes some bodies

When `event.isBase64Encoded === true`, `event.body` is base64. Always decode before
computing the HMAC or parsing JSON:

```typescript
const rawBody = event.isBase64Encoded
  ? Buffer.from(event.body ?? "", "base64").toString("utf8")
  : (event.body ?? "");
```

### Action string is past tense

Linear sends `"created"` and `"prompted"`, not `"create"` and `"prompt"`.

### OAuth token is workspace-scoped

Each Linear workspace installation produces its own token. If you need to support
multiple workspaces, store tokens keyed by `organizationId` from the webhook payload.

---

## Debugging

Logs go to CloudWatch under the Lambda function's log group.

**No logs at all (fast invocation)**: signature validation is returning 401 early.
Temporarily add logging before the `return { statusCode: 401 }` lines.

**Check signature mismatch**: verify `LINEAR_WEBHOOK_SECRET` in Lambda env matches the
secret configured on the Linear webhook. You can read the current env:

```bash
aws lambda get-function-configuration --function-name <name> \
  --query 'Environment.Variables.LINEAR_WEBHOOK_SECRET'
```

**Replay a webhook**: Linear's developer dashboard has a webhook delivery log with a
"Resend" button. Use this instead of reassigning the issue repeatedly.

**Test the OAuth callback**:
```bash
curl "$(pulumi stack output webhookUrl)oauth/callback?code=test"
# Should return 400 "Missing code parameter" only if code is missing env vars
# If LINEAR_CLIENT_ID etc. are missing it returns 500
```

**View recent Lambda logs**:
```bash
aws logs tail /aws/lambda/linear-webhook-handler --follow
```

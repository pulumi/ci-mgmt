import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { handler } from "./handler";

const config = new pulumi.Config();

// IAM role for the Lambda function
const role = new aws.iam.Role("linear-webhook-role", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: "lambda.amazonaws.com",
  }),
});

new aws.iam.RolePolicyAttachment("linear-webhook-basic-execution", {
  role: role,
  policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
});

// SSM SecureString parameter — stores the Linear OAuth token obtained via /oauth/callback.
// Created empty; populated automatically when the OAuth flow completes.
const tokenParam = new aws.ssm.Parameter(
  "linear-token",
  {
    type: "SecureString",
    value: "placeholder", // Overwritten by oauth callback.
  },
  { ignoreChanges: ["value"] },
);

// Allow the Lambda to read and write the token parameter
new aws.iam.RolePolicy("linear-webhook-ssm-policy", {
  role: role,
  policy: tokenParam.arn.apply((arn) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["ssm:GetParameter", "ssm:PutParameter"],
          Resource: arn,
        },
      ],
    }),
  ),
});

// Note on LINEAR_CALLBACK_URL: this is a bootstrapping config value.
// 1. Run `pulumi up` once (set linearCallbackUrl to a placeholder or omit via config.get).
// 2. Note the exported webhookUrl, compute: <webhookUrl>oauth/callback
// 3. Run `pulumi config set linearCallbackUrl <url>` then `pulumi up` again.
// The callback URL is only used during OAuth installation, not for webhook processing.
const callbackUrl = config.get("linearCallbackUrl") ?? "";

const func = new aws.lambda.CallbackFunction("linear-webhook-handler", {
  runtime: aws.lambda.Runtime.NodeJS24dX,
  callback: handler,
  role: role,
  environment: {
    variables: {
      LINEAR_WEBHOOK_SECRET: config.requireSecret("linearWebhookSecret"),
      LINEAR_CLIENT_ID: config.require("linearClientId"),
      LINEAR_CLIENT_SECRET: config.requireSecret("linearClientSecret"),
      LINEAR_CALLBACK_URL: callbackUrl,
      LINEAR_TOKEN_PARAM: tokenParam.name,
      GITHUB_APP_ID: config.require("githubAppId"),
      GITHUB_APP_PRIVATE_KEY: config.requireSecret("githubAppPrivateKey"),
      GITHUB_APP_INSTALLATION_ID: config.require("githubAppInstallationId"),
    },
  },
  timeout: 30,
});

// Lambda Function URL — single endpoint for both GET /oauth/callback and POST / (webhook)
const funcUrl = new aws.lambda.FunctionUrl("linear-webhook-url", {
  functionName: func.name,
  authorizationType: "NONE",
  cors: {
    allowOrigins: ["*"],
    allowMethods: ["GET", "POST"],
    allowHeaders: ["content-type", "linear-signature"],
  },
});

export const webhookUrl = funcUrl.functionUrl;
export const tokenParamName = tokenParam.name;
// OAuth install URL (constructed after deploy — paste into Linear app settings):
// https://linear.app/oauth/authorize?client_id=8008fc08432f9b94b9d682644ad97388&redirect_uri=https://kedkfg7ljryb67jmqbjfxemmpm0wjhht.lambda-url.us-west-2.on.aws/oauth/callback&scope=app:assignable,app:mentionable,read,write&response_type=code&actor=app

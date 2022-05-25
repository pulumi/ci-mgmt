import { z } from "zod";
import { GithubWorkflow, NormalJob } from "./github-workflow";
import * as steps from "./steps";
import { Step } from "./steps";

export const WorkflowOpts = z.object({
  provider: z.string(),
  env: z.record(z.any()).optional(),
  docker: z.boolean().default(false),
  aws: z.boolean().default(false),
  gcp: z.boolean().default(false),
  lint: z.boolean().default(true),
  "setup-script": z.string().optional(),
  parallel: z.number().default(3),
  timeout: z.number().default(60),
});
type WorkflowOpts = z.infer<typeof WorkflowOpts>;

const env = (opts: WorkflowOpts) =>
  Object.assign(
    {
      GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
      PROVIDER: opts.provider,
      PULUMI_ACCESS_TOKEN: "${{ secrets.PULUMI_ACCESS_TOKEN }}",
      PULUMI_API: "https://api.pulumi-staging.io",
      PULUMI_LOCAL_NUGET: "${{ github.workspace }}/nuget",
      NPM_TOKEN: "${{ secrets.NPM_TOKEN }}",
      NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}",
      NUGET_PUBLISH_KEY: "${{ secrets.NUGET_PUBLISH_KEY }}",
      PYPI_PASSWORD: "${{ secrets.PYPI_PASSWORD }}",
      TRAVIS_OS_NAME: "linux",
      SLACK_WEBHOOK_URL: "${{ secrets.SLACK_WEBHOOK_URL }}",
      PULUMI_GO_DEP_ROOT: "${{ github.workspace }}/..",
    },
    opts.env
  );

export function CommandDispatchWorkflow(
  name: string,
  opts: WorkflowOpts
): GithubWorkflow {
  return {
    name: name,

    on: {
      issue_comment: {
        types: ["created", "edited"],
      },
    },
    env: env(opts),

    jobs: {
      "command-dispatch-for-testing": new EmptyJob(
        "command-dispatch-for-testing"
      )
        .addConditional("${{ github.event.issue.pull_request }}")
        .addStep(steps.CheckoutRepoStep())
        .addStep(steps.CommandDispatchStep(`${opts.provider}`)),
    },
  };
}

export class EmptyJob implements NormalJob {
  steps: Step[];
  "runs-on" = "ubuntu-latest";
  strategy: NormalJob["strategy"];
  name: string;
  if?: string;

  constructor(name: string, params?: Partial<NormalJob>) {
    this.name = name;
    this.steps = [];
    Object.assign(this, { name }, params);
  }

  addStep(step: Step) {
    this.steps.push(step);
    return this;
  }

  addStrategy(strategy: NormalJob["strategy"]) {
    this.strategy = strategy;
    return this;
  }

  addConditional(conditional: string) {
    this.if = conditional;
    return this;
  }
}

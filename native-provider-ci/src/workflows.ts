import { z } from "zod";
import { GithubWorkflow, NormalJob } from "./github-workflow";
import * as steps from "./steps";
import { Step } from "./steps";

const pythonVersion = "3.7";
const goVersion = "1.17.x";
const nodeVersion = "14.x";
const dotnetVersion = "3.1.301";

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

export function DefaultBranchWorkflow(
  name: string,
  opts: WorkflowOpts
): GithubWorkflow {
  const workflow: GithubWorkflow = {
    name,
    on: {
      push: {
        branches: [name],
        "tags-ignore": ["v*", "sdk/*", "**"],
        "paths-ignore": ["**.md"],
      },
    },
    env: env(opts),
    jobs: {
      prerequisites: new PrerequisitesJob("prerequisites"),
      build_sdk: new BuildSdkJob("build_sdk"),
      test: new TestsJob("test", opts),
      publish: new PublishPrereleaseJob("publish", opts),
      publish_sdk: new PublishSDKJob("publish_sdk"),
      generate_coverage_data: new GenerateCoverageDataJob(
        "generate_coverage_data"
      ),
    },
  };

  if (opts.lint) {
    workflow.jobs = Object.assign(workflow.jobs, {
      lint: new LintProviderJob("lint"),
      lint_sdk: new LintSDKJob("lint-sdk", opts),
    });
  }
  return workflow;
}

export function NightlyCronWorkflow(
  name: string,
  opts: WorkflowOpts
): GithubWorkflow {
  return {
    name: name,
    on: {
      schedule: [
        {
          cron: "0 6 * * *",
        },
      ],
    },
    env: env(opts),
    jobs: {
      prerequisites: new PrerequisitesJob("prerequisites"),
      build_sdk: new BuildSdkJob("build_sdk"),
      test: new TestsJob("test", opts),
    },
  };
}

export function ReleaseWorkflow(
  name: string,
  opts: WorkflowOpts
): GithubWorkflow {
  const workflow: GithubWorkflow = {
    name: name,
    on: {
      push: {
        tags: ["v*.*.*", "!v*.*.*-**"],
      },
    },
    env: env(opts),
    jobs: {
      prerequisites: new PrerequisitesJob("prerequisites"),
      build_sdk: new BuildSdkJob("build_sdk"),
      test: new TestsJob("test", opts),
      publish: new PublishJob("publish", opts),
      publish_sdk: new PublishSDKJob("publish_sdk"),
      tag_sdk: new TagSDKJob("tag_sdk"),
      create_docs_build: new DocsBuildJob("create_docs_build"),
    },
  };

  if (opts.lint) {
    workflow.jobs = Object.assign(workflow.jobs, {
      lint: new LintProviderJob("lint"),
      lint_sdk: new LintSDKJob("lint-sdk", opts),
    });
  }
  return workflow;
}

export function PrereleaseWorkflow(
  name: string,
  opts: WorkflowOpts
): GithubWorkflow {
  const workflow: GithubWorkflow = {
    name: name,
    on: {
      push: {
        tags: ["v*.*.*-**"],
      },
    },
    env: env(opts),
    jobs: {
      prerequisites: new PrerequisitesJob("prerequisites"),
      build_sdk: new BuildSdkJob("build_sdk"),
      test: new TestsJob("test", opts),
      publish: new PublishPrereleaseJob("publish", opts),
      publish_sdk: new PublishSDKJob("publish_sdk"),
    },
  };

  if (opts.lint) {
    workflow.jobs = Object.assign(workflow.jobs, {
      lint: new LintProviderJob("lint"),
      lint_sdk: new LintSDKJob("lint-sdk", opts),
    });
  }
  return workflow;
}

export function RunAcceptanceTestsWorkflow(
  name: string,
  opts: WorkflowOpts
): GithubWorkflow {
  const workflow: GithubWorkflow = {
    name: name,
    on: {
      repository_dispatch: {
        types: ["run-acceptance-tests-command"],
      },
      pull_request: {
        branches: ["master", "main"],
        "paths-ignore": ["CHANGELOG.md"],
      },
    },
    env: {
      ...env(opts),
      PR_COMMIT_SHA: "${{ github.event.client_payload.pull_request.head.sha }}",
    },
    jobs: {
      "comment-notification": new EmptyJob("comment-notification")
        .addConditional("github.event_name == 'repository_dispatch'")
        .addStep(steps.CreateCommentsUrlStep())
        .addStep(steps.UpdatePRWithResultsStep()),
      prerequisites: new PrerequisitesJob(
        "prerequisites"
      ).addDispatchConditional(true),
      build_sdk: new BuildSdkJob("build_sdk").addDispatchConditional(true),
      test: new TestsJob("test", opts).addDispatchConditional(true),
    },
  };
  if (opts.lint) {
    workflow.jobs = Object.assign(workflow.jobs, {
      lint: new LintProviderJob("lint").addDispatchConditional(true),
      lint_sdk: new LintSDKJob("lint-sdk", opts).addDispatchConditional(true),
    });
  }
  return workflow;
}

export function PullRequestWorkflow(
  name: string,
  opts: WorkflowOpts
): GithubWorkflow {
  return {
    name: name,
    on: {
      pull_request_target: {},
    },
    env: env(opts),
    jobs: {
      "comment-on-pr": new EmptyJob("comment-on-pr")
        .addConditional(
          "github.event.pull_request.head.repo.full_name != github.repository"
        )
        .addStep(steps.CheckoutRepoStep())
        .addStep(steps.CommentPRWithSlashCommandStep()),
    },
  };
}

interface UpdatePulumiTerraformBridgeWorkflowArgs {
  providerDefaultBranch: string;
}

export function UpdatePulumiTerraformBridgeWorkflow(
  args: UpdatePulumiTerraformBridgeWorkflowArgs
): GithubWorkflow {
  return {
    name: "Update pulumi-terraform-bridge",
    on: {
      workflow_dispatch: {
        inputs: {
          bridge_version: {
            required: true,
            description:
              "The version of pulumi/pulumi-terraform-bridge to update to. Do not include the 'v' prefix. Must be major version 3.",
            type: "string",
          },
          sdk_version: {
            required: true,
            description:
              "The version of pulumi/pulumi/sdk to update to. Do not include the 'v' prefix. Must be major version 3.",
            type: "string",
          },
        },
      },
    },
    env: {
      GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
      // If there are missing or extra mappings, they can not have been
      // introduced by updating the bridge, so for this workflow we'll
      // ignore mapping errors.
      PULUMI_EXTRA_MAPPING_ERROR: false,
      PULUMI_MISSING_MAPPING_ERROR: false,
    },
    jobs: {
      update_bridge: new EmptyJob("update-bridge")
        .addStrategy({
          "fail-fast": true,
          matrix: {
            goversion: [goVersion],
            dotnetversion: [dotnetVersion],
            pythonversion: [pythonVersion],
            nodeversion: [nodeVersion],
          },
        })
        .addStep(steps.CheckoutRepoStep())
        .addStep(steps.CheckoutTagsStep())
        .addStep(steps.InstallGo())
        .addStep(steps.InstallPulumiCtl())
        .addStep(steps.InstallPulumiCli())
        .addStep(steps.InstallDotNet())
        .addStep(steps.InstallNodeJS())
        .addStep(steps.InstallPython())
        .addStep({
          name: "Update pulumi-terraform-bridge",
          run: "cd provider && go mod edit -require github.com/pulumi/pulumi-terraform-bridge/v3@v${{ github.event.inputs.bridge_version }} && go mod tidy",
        })
        .addStep({
          name: "Update Pulumi SDK (provider/go.mod)",
          run: "cd provider && go mod edit -require github.com/pulumi/pulumi/sdk/v3@v${{ github.event.inputs.sdk_version }} && go mod tidy",
        })
        .addStep({
          name: "Update Pulumi SDK (sdk/go.mod)",
          run: "cd sdk && go mod edit -require github.com/pulumi/pulumi/sdk/v3@v${{ github.event.inputs.sdk_version }} && go mod tidy",
        })
        .addStep(steps.RunCommand("make tfgen"))
        .addStep(steps.RunCommand("make build_sdks"))
        .addStep({
          name: "Create PR",
          id: "create-pr",
          uses: "peter-evans/create-pull-request@v3.12.0",
          with: {
            "commit-message":
              "Update pulumi-terraform-bridge to v${{ github.event.inputs.bridge_version }}",
            committer: "pulumi-bot <bot@pulumi.com>",
            author: "pulumi-bot <bot@pulumi.com>",
            branch:
              "pulumi-bot/bridge-v${{ github.event.inputs.bridge_version }}-${{ github.run_id}}",
            base: args.providerDefaultBranch,
            labels: "impact/no-changelog-required",
            title:
              "Update pulumi-terraform-bridge to v${{ github.event.inputs.bridge_version }}",
            body: "This pull request was generated automatically by the update-bridge workflow in this repository.",
            "team-reviewers": "platform-integrations",
            token: "${{ secrets.PULUMI_BOT_TOKEN }}",
          },
        })
        .addStep({
          name: "Set Automerge",
          if: "steps.create-pr.outputs.pull-request-operation == 'created'",
          uses: "peter-evans/enable-pull-request-automerge@v1",
          with: {
            token: "${{ secrets.PULUMI_BOT_TOKEN }}",
            "pull-request-number":
              "${{ steps.create-pr.outputs.pull-request-number }}",
            repository: "${{ github.repository }}",
            "merge-method": "squash",
          },
        }),
    },
  };
}

export interface UpdateUpstreamProviderArgs {
  "upstream-provider-repo": string;
  "upstream-provider-org": string;
  "fail-on-extra-mapping": boolean;
  "fail-on-missing-mapping": boolean;
  "upstream-provider-major-version": string;
  "provider-default-branch": string;
}

export function UpdateUpstreamProviderWorkflow(
  args: UpdateUpstreamProviderArgs,
  opts: WorkflowOpts
): GithubWorkflow {
  const prStepOptions = {
    "commit-message":
      "Update ${{ env.UPSTREAM_PROVIDER_REPO }} to v${{ github.event.inputs.version }}",
    committer: "pulumi-bot <bot@pulumi.com>",
    author: "pulumi-bot <bot@pulumi.com>",
    branch:
      "pulumi-bot/v${{ github.event.inputs.version }}-${{ github.run_id}}",
    base: args["provider-default-branch"],
    // TODO: Add auto-merge.
    labels: "impact/no-changelog-required",
    title:
      "Update ${{ env.UPSTREAM_PROVIDER_REPO }} to v${{ github.event.inputs.version }}",
    body: "This pull request was generated automatically by the update-upstream-provider workflow in this repository.",
    "team-reviewers": "platform-integrations",
    token: "${{ secrets.PULUMI_BOT_TOKEN }}",
  };

  return {
    name: "Update upstream provider",
    on: {
      workflow_dispatch: {
        inputs: {
          version: {
            required: true,
            description:
              "The new version of the upstream provider. Do not include the 'v' prefix.",
            type: "string",
          },
          linked_issue_number: {
            required: false,
            description:
              "The issue number of a PR in this repository to which the generated pull request should be linked.",
            type: "string",
          },
        },
      },
    },

    env: {
      ...env(opts),
      PULUMI_EXTRA_MAPPING_ERROR: args["fail-on-extra-mapping"],
      PULUMI_MISSING_MAPPING_ERROR: args["fail-on-missing-mapping"],
      UPSTREAM_PROVIDER_ORG: args["upstream-provider-org"],
      UPSTREAM_PROVIDER_REPO: args["upstream-provider-repo"],
      UPSTREAM_PROVIDER_MAJOR_VERSION: args["upstream-provider-major-version"],
    },

    jobs: {
      update_upstream_provider: new EmptyJob("update-upstream_provider")
        .addStrategy({
          "fail-fast": true,
          matrix: {
            goversion: [goVersion],
            dotnetversion: [dotnetVersion],
            pythonversion: [pythonVersion],
            nodeversion: [nodeVersion],
          },
        })
        .addStep({
          id: "run-url",
          name: "Create URL to the run output",
          run: "echo ::set-output name=run-url::https://github.com/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID",
        })
        .addStep(steps.CheckoutRepoStep())
        .addStep(steps.CheckoutTagsStep())
        .addStep(steps.InstallGo())
        .addStep(steps.InstallPulumiCtl())
        .addStep(steps.InstallPulumiCli())
        .addStep(steps.InstallDotNet())
        .addStep(steps.InstallNodeJS())
        .addStep(steps.InstallPython())
        .addStep({
          name: "Get upstream provider sha",
          run: 'echo "UPSTREAM_PROVIDER_SHA=$(curl https://api.github.com/repos/${{ env.UPSTREAM_PROVIDER_ORG }}/${{ env.UPSTREAM_PROVIDER_REPO }}/git/ref/tags/v${{ github.event.inputs.version }} | jq .object.sha -r)" >> $GITHUB_ENV',
        })
        .addStep({
          name: "Update shim/go.mod",
          if: "${{ hashFiles('provider/shim/go.mod') != '' }}",
          run: "cd provider/shim && go mod edit -require github.com/${{ env.UPSTREAM_PROVIDER_ORG }}/${{ env.UPSTREAM_PROVIDER_REPO }}${{ env.UPSTREAM_PROVIDER_MAJOR_VERSION }}@${{ env.UPSTREAM_PROVIDER_SHA }} && go mod tidy",
        })
        .addStep({
          name: "Update go.mod",
          run: "cd provider && go mod edit -require github.com/${{ env.UPSTREAM_PROVIDER_ORG }}/${{ env.UPSTREAM_PROVIDER_REPO }}${{ env.UPSTREAM_PROVIDER_MAJOR_VERSION }}@${{ env.UPSTREAM_PROVIDER_SHA }} && go mod tidy",
        })
        .addStep(steps.RunCommand("make tfgen"))
        .addStep(steps.RunCommand("make build_sdks"))
        .addStep({
          name: "Create PR (no linked issue)",
          uses: "peter-evans/create-pull-request@v3.12.0",
          if: "${{ !github.event.inputs.linked_issue_number }}",
          with: {
            ...prStepOptions,
            body: "This pull request was generated automatically by the update-upstream-provider workflow in this repository.",
          },
        })
        // Identical to the previous step, except that it links to the
        // issue if one is suppled:
        .addStep({
          name: "Create PR (with linked issue)",
          uses: "peter-evans/create-pull-request@v3.12.0",
          if: "${{ github.event.inputs.linked_issue_number }}",
          with: {
            ...prStepOptions,
            body: "Fixes #${{ github.event.inputs.linked_issue_number }}\n\nThis pull request was generated automatically by the update-upstream-provider workflow in this repository.",
          },
        })
        .addStep({
          name: "Comment on failed attempt",
          if: "${{ failure() && github.event.inputs.linked_issue_number }}",
          uses: "jungwinter/comment@v1",
          with: {
            type: "create",
            issue_number: "${{ github.event.inputs.linked_issue_number }}",
            token: "${{ secrets.PULUMI_BOT_TOKEN }}",
            body: "Failed to automatically update upstream provider (probably beacuse of new resources or data sources, which must be mapped manually).\n\nFor more details, see: ${{ steps.run-url.outputs.run-url }}",
          },
        }),
    },
  };
}

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

export class BuildSdkJob implements NormalJob {
  needs = "prerequisites";
  "runs-on" = "ubuntu-latest";
  strategy = {
    "fail-fast": true,
    matrix: {
      goversion: [goVersion],
      dotnetversion: [dotnetVersion],
      pythonversion: [pythonVersion],
      nodeversion: [nodeVersion],
      language: ["nodejs", "python", "dotnet", "go"],
    },
  };
  steps = [
    steps.CheckoutRepoStep(),
    steps.CheckoutScriptsRepoStep(),
    steps.CheckoutTagsStep(),
    steps.InstallGo(),
    steps.InstallPulumiCtl(),
    steps.InstallPulumiCli(),
    steps.InstallNodeJS(),
    steps.InstallDotNet(),
    steps.InstallPython(),
    steps.DownloadProviderStep(),
    steps.UnzipProviderBinariesStep(),
    steps.InstallPlugins(),
    steps.SetProvidersToPATH(),
    steps.BuildSdksStep(),
    steps.CheckCleanWorkTreeStep(),
    steps.ZipSDKsStep(),
    steps.UploadSdkStep(),
    steps.NotifySlack("Failure in building ${{ matrix.language }} sdk"),
  ];
  name: string;
  if: NormalJob["if"];

  constructor(name: string) {
    this.name = name;
    Object.assign(this, { name });
  }

  addDispatchConditional(isWorkflowDispatch: boolean) {
    if (isWorkflowDispatch) {
      this.if =
        "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository";

      this.steps = this.steps.filter((step) => step.name !== "Checkout Repo");
      this.steps.unshift(steps.CheckoutRepoStepAtPR());
    }
    return this;
  }
}

export class PrerequisitesJob implements NormalJob {
  "runs-on" = "ubuntu-latest";
  strategy = {
    "fail-fast": true,
    matrix: {
      goversion: [goVersion],
      dotnetversion: [dotnetVersion],
      pythonversion: [pythonVersion],
      nodeversion: [nodeVersion],
    },
  };
  steps = [
    steps.CheckoutRepoStep(),
    steps.CheckoutScriptsRepoStep(),
    steps.CheckoutTagsStep(),
    steps.InstallGo(),
    steps.InstallPulumiCtl(),
    steps.InstallPulumiCli(),
    steps.InstallSchemaChecker(),
    steps.BuildBinariesStep(),
    steps.CheckSchemaChanges(),
    steps.CommentSchemaChangesOnPR(),
    steps.ZipProviderBinariesStep(),
    steps.UploadProviderBinariesStep(),
    steps.NotifySlack("Failure in building provider prerequisites"),
  ].filter((step: Step) => step.uses !== undefined || step.run !== undefined);
  name: string;
  if: NormalJob["if"];

  constructor(name: string) {
    this.name = name;
    Object.assign(this, { name });
  }

  addDispatchConditional(isWorkflowDispatch: boolean) {
    if (isWorkflowDispatch) {
      this.if =
        "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository";

      this.steps = this.steps.filter((step) => step.name !== "Checkout Repo");
      this.steps.unshift(steps.CheckoutRepoStepAtPR());
    }
    return this;
  }
}

export class TestsJob implements NormalJob {
  "runs-on" = "ubuntu-latest";
  needs = "build_sdk";
  strategy = {
    "fail-fast": true,
    matrix: {
      goversion: [goVersion],
      dotnetversion: [dotnetVersion],
      pythonversion: [pythonVersion],
      nodeversion: [nodeVersion],
      language: ["nodejs", "python", "dotnet", "go"],
    },
  };
  steps: NormalJob["steps"];
  name: string;
  if: NormalJob["if"];

  constructor(name: string, opts: WorkflowOpts) {
    this.name = name;
    this.steps = [
      steps.CheckoutRepoStep(),
      steps.CheckoutScriptsRepoStep(),
      steps.CheckoutTagsStep(),
      steps.InstallGo(),
      steps.InstallPulumiCtl(),
      steps.InstallPulumiCli(),
      steps.InstallNodeJS(),
      steps.InstallDotNet(),
      steps.InstallPython(),
      steps.DownloadProviderStep(),
      steps.UnzipProviderBinariesStep(),
      steps.SetNugetSource(),
      steps.DownloadSDKsStep(),
      steps.UnzipSDKsStep(),
      steps.SetProvidersToPATH(),
      steps.InstallPythonDeps(),
      steps.RunDockerComposeStep(opts.docker),
      steps.RunSetUpScriptStep(opts["setup-script"]),
      steps.ConfigureAwsCredentialsForTests(opts.aws),
      steps.ConfigureGcpCredentials(opts.gcp),
      steps.InstallSDKDeps(),
      steps.SetupGotestfmt(),
      steps.RunTests(),
      steps.NotifySlack("Failure in running ${{ matrix.language }} tests"),
    ].filter((step: Step) => step.uses !== undefined || step.run !== undefined);
    Object.assign(this, { name });
  }

  addDispatchConditional(isWorkflowDispatch: boolean) {
    if (isWorkflowDispatch) {
      this.if =
        "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository";

      this.steps = this.steps?.filter((step) => step.name !== "Checkout Repo");
      this.steps?.unshift(steps.CheckoutRepoStepAtPR());
    }
    return this;
  }
}

export class PublishPrereleaseJob implements NormalJob {
  "runs-on" = "ubuntu-latest";
  needs = "test";
  strategy = {
    "fail-fast": true,
    matrix: {
      goversion: [goVersion],
      dotnetversion: [dotnetVersion],
      pythonversion: [pythonVersion],
      nodeversion: [nodeVersion],
    },
  };
  steps: NormalJob["steps"];
  name: string;
  constructor(name: string, opts: WorkflowOpts) {
    this.name = name;
    this.steps = [
      steps.CheckoutRepoStep(),
      steps.CheckoutTagsStep(),
      steps.InstallGo(),
      steps.InstallPulumiCtl(),
      steps.InstallPulumiCli(),
      steps.ConfigureAwsCredentialsForPublish(),
      steps.SetPreReleaseVersion(),
      steps.RunGoReleaserWithArgs(
        `-p ${opts.parallel} -f .goreleaser.prerelease.yml --rm-dist --skip-validate --timeout ${opts.timeout}m0s`
      ),
      steps.NotifySlack("Failure in publishing binaries"),
    ];
    Object.assign(this, { name });
  }
}

export class PublishJob implements NormalJob {
  "runs-on" = "ubuntu-latest";
  needs = "test";
  strategy = {
    "fail-fast": true,
    matrix: {
      goversion: [goVersion],
      dotnetversion: [dotnetVersion],
      pythonversion: [pythonVersion],
      nodeversion: [nodeVersion],
    },
  };
  name: string;
  steps: NormalJob["steps"];

  constructor(name: string, opts: WorkflowOpts) {
    this.name = name;
    Object.assign(this, { name });
    this.steps = [
      steps.CheckoutRepoStep(),
      steps.CheckoutTagsStep(),
      steps.InstallGo(),
      steps.InstallPulumiCtl(),
      steps.InstallPulumiCli(),
      steps.ConfigureAwsCredentialsForPublish(),
      steps.SetPreReleaseVersion(),
      steps.RunGoReleaserWithArgs(
        `-p ${opts.parallel} release --rm-dist --timeout ${opts.timeout}m0s`
      ),
      steps.NotifySlack("Failure in publishing binaries"),
    ];
  }
}

export class DocsBuildJob implements NormalJob {
  "runs-on" = "ubuntu-latest";
  needs = "tag_sdk";
  steps = [steps.InstallPulumiCtl(), steps.DispatchDocsBuildEvent()];
  name: string;

  constructor(name: string) {
    this.name = name;
    Object.assign(this, { name });
  }
}

export class TagSDKJob implements NormalJob {
  "runs-on" = "ubuntu-latest";
  needs = "publish_sdk";
  steps = [
    steps.CheckoutRepoStep(),
    steps.InstallPulumiCtl(),
    steps.TagSDKTag(),
  ];
  name: string;

  constructor(name: string) {
    this.name = name;
    Object.assign(this, { name });
  }
}

export class PublishSDKJob implements NormalJob {
  "runs-on" = "ubuntu-latest";
  needs = "publish";
  strategy = {
    "fail-fast": true,
    matrix: {
      goversion: [goVersion],
      dotnetversion: [dotnetVersion],
      pythonversion: [pythonVersion],
      nodeversion: [nodeVersion],
    },
  };
  steps = [
    steps.CheckoutRepoStep(),
    steps.CheckoutScriptsRepoStep(),
    steps.CheckoutTagsStep(),
    steps.InstallGo(),
    steps.InstallPulumiCtl(),
    steps.InstallPulumiCli(),
    steps.InstallNodeJS(),
    steps.InstallDotNet(),
    steps.InstallPython(),
    steps.DownloadSpecificSDKStep("python"),
    steps.UnzipSpecificSDKStep("python"),
    steps.DownloadSpecificSDKStep("dotnet"),
    steps.UnzipSpecificSDKStep("dotnet"),
    steps.DownloadSpecificSDKStep("nodejs"),
    steps.UnzipSpecificSDKStep("nodejs"),
    steps.RunCommand("python -m pip install pip twine"),
    steps.RunPublishSDK(),
    steps.NotifySlack("Failure in publishing SDK"),
  ];
  name: string;

  constructor(name: string) {
    this.name = name;
    Object.assign(this, { name });
  }
}

export class LintProviderJob implements NormalJob {
  "runs-on" = "ubuntu-latest";
  container = "golangci/golangci-lint:latest";
  strategy = {
    "fail-fast": true,
    matrix: {
      goversion: [goVersion],
    },
  };
  steps = [
    steps.CheckoutRepoStep(),
    steps.CheckoutScriptsRepoStep(),
    steps.CheckoutTagsStep(),
    steps.InstallGo(),
    steps.InstallPulumiCtl(),
    steps.InstallPulumiCli(),
    steps.RunCommand("make lint_provider"),
    steps.NotifySlack("Failure in linting provider"),
  ];
  name: string;
  if: NormalJob["if"];

  constructor(name: string) {
    this.name = name;
    Object.assign(this, { name });
  }

  addDispatchConditional(isWorkflowDispatch: boolean) {
    if (isWorkflowDispatch) {
      this.if =
        "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository";

      this.steps = this.steps.filter(
        (step: Step) => step.name !== "Checkout Repo"
      );
      this.steps.unshift(steps.CheckoutRepoStepAtPR());
    }
    return this;
  }
}

export class LintSDKJob implements NormalJob {
  "runs-on" = "ubuntu-latest";
  needs = "build_sdk";
  container = "golangci/golangci-lint:latest";
  strategy = {
    "fail-fast": true,
    matrix: {
      goversion: [goVersion],
    },
  };
  steps: NormalJob["steps"];
  name: string;
  if: NormalJob["if"];

  constructor(name: string, opts: WorkflowOpts) {
    this.name = name;
    Object.assign(this, { name });
    this.steps = [
      steps.CheckoutRepoStep(),
      steps.CheckoutScriptsRepoStep(),
      steps.CheckoutTagsStep(),
      steps.InstallGo(),
      steps.InstallPulumiCtl(),
      steps.InstallPulumiCli(),
      steps.RunCommand(
        `cd sdk/go/${opts.provider} && golangci-lint run -c ../../../.golangci.yml`
      ),
      steps.NotifySlack("Failure in linting go sdk"),
    ];
  }

  addDispatchConditional(isWorkflowDispatch: boolean) {
    if (isWorkflowDispatch) {
      this.if =
        "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository";

      this.steps = this.steps?.filter((step) => step.name !== "Checkout Repo");
      this.steps?.unshift(steps.CheckoutRepoStepAtPR());
    }
    return this;
  }
}

export class GenerateCoverageDataJob implements NormalJob {
  "runs-on" = "ubuntu-latest";
  "continue-on-error" = true;
  needs = "prerequisites";
  env = {
    COVERAGE_OUTPUT_DIR: "${{ secrets.COVERAGE_OUTPUT_DIR }}",
  };
  strategy = {
    "fail-fast": true,
    matrix: {
      goversion: [goVersion],
    },
  };
  steps = [
    // Setting up prerequisites needed to run the coverage tracker
    steps.CheckoutRepoStep(),
    steps.ConfigureAwsCredentialsForCoverageDataUpload(),
    steps.CheckoutScriptsRepoStep(),
    steps.CheckoutTagsStep(),
    steps.InstallGo(),
    steps.InstallPulumiCtl(),
    steps.InstallPulumiCli(),
    steps.InstallSchemaChecker(),

    // Generating and summarizing coverage data
    steps.EchoCoverageOutputDirStep(),
    steps.GenerateCoverageDataStep(),
    steps.PrintCoverageDataStep(),

    // Uploading coverage data
    steps.UploadCoverageDataStep(),
  ];
  name: string;
  if: NormalJob["if"];

  constructor(name: string) {
    this.name = name;
    Object.assign(this, { name });
  }

  addDispatchConditional(isWorkflowDispatch: boolean) {
    if (isWorkflowDispatch) {
      this.if =
        "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository";

      this.steps = this.steps.filter((step) => step.name !== "Checkout Repo");
      this.steps.unshift(steps.CheckoutRepoStepAtPR());
    }
    return this;
  }
}

export class WarnCodegenJob implements NormalJob {
  "runs-on" = "ubuntu-latest";
  steps = [
    steps.CheckoutRepoStep(),
    steps.SchemaFileChanged(),
    steps.SdkFilesChanged(),
    steps.SendCodegenWarnCommentPr(),
  ];
  name: string;

  constructor(name: string) {
    this.name = name;
    Object.assign(this, { name });
  }
}

export function ModerationWorkflow(
  name: string,
  opts: WorkflowOpts
): GithubWorkflow {
  const workflow: GithubWorkflow = {
    name,
    on: {
      pull_request_target: {
        branches: ["main", "master"],
        types: ["opened"],
      },
    },
    env: {
      GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
    },

    jobs: {
      warn_codegen: new WarnCodegenJob("warn_codegen"),
    },
  };
  return workflow;
}

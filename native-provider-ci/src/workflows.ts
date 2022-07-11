import { z } from "zod";
import { GithubWorkflow, NormalJob } from "./github-workflow";
import * as steps from "./steps";
import { Step } from "./steps";

const pythonVersion = "3.7";
const goVersion = "1.18.x";
const nodeVersion = "14.x";
const dotnetVersion = "3.1.301";

export const WorkflowOpts = z.object({
  provider: z.string(),
  env: z.record(z.any()).optional(),
  docker: z.boolean().default(false),
  aws: z.boolean().default(false),
  gcp: z.boolean().default(false),
  submodules: z.boolean().default(false),
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

// This section represents GHA files, sub-jobs are in a section below

// Creates command-dispatch.yml
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

// Creates pull-request.yml
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

// Creates run-acceptance-tests.yml
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
      workflow_dispatch: {},
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
        "prerequisites",
        opts
      ).addDispatchConditional(true),
      build_sdks: new BuildSdkJob("build_sdks", opts)
        .addDispatchConditional(true)
        .addRunsOn(opts.provider),
      test: new TestsJob("test", opts).addDispatchConditional(true),
    },
  };
  if (opts.provider === "kubernetes") {
    workflow.jobs = Object.assign(workflow.jobs, {
      "build-test-cluster": new BuildTestClusterJob(
        "build-test-cluster",
        opts
      ).addDispatchConditional(true),
    });
    workflow.jobs = Object.assign(workflow.jobs, {
      "destroy-test-cluster": new TeardownTestClusterJob(
        "teardown-test-cluster",
        opts
      ).addDispatchConditional(true),
    });
    workflow.jobs = Object.assign(workflow.jobs, {
      lint: new LintKubernetesJob("lint").addDispatchConditional(true),
    });
  }
  return workflow;
}

export function BuildWorkflow(
  name: string,
  opts: WorkflowOpts
): GithubWorkflow {
  const workflow: GithubWorkflow = {
    name: name,
    on: {
      push: {
        branches: ["master", "main", "feature-**"],
        "paths-ignore": ["CHANGELOG.md"],
        "tags-ignore": ["v*", "sdk/*", "**"],
      },
      workflow_dispatch: {},
    },
    env: env(opts),
    jobs: {
      prerequisites: new PrerequisitesJob("prerequisites", opts),
      build_sdks: new BuildSdkJob("build_sdks", opts).addRunsOn(opts.provider),
      test: new TestsJob("test", opts),
      publish: new PublishPrereleaseJob("publish", opts),
      publish_sdk: new PublishSDKsJob("publish_sdk", opts),
    },
  };
  if (opts.provider === "kubernetes") {
    workflow.jobs = Object.assign(workflow.jobs, {
      "build-test-cluster": new BuildTestClusterJob("build-test-cluster", opts),
    });
    workflow.jobs = Object.assign(workflow.jobs, {
      "destroy-test-cluster": new TeardownTestClusterJob(
        "teardown-test-cluster",
        opts
      ),
    });
    workflow.jobs = Object.assign(workflow.jobs, {
      lint: new LintKubernetesJob("lint").addDispatchConditional(true),
    });
  }
  return workflow;
}

export function WeeklyPulumiUpdate(
  name: string,
  opts: WorkflowOpts
): GithubWorkflow {
  return {
    name: name,
    on: {
      schedule: [
        {
          cron: "35 12 * * 4",
        },
      ],
      workflow_dispatch: {},
    },
    env: env(opts),
    jobs: {
      update_pulumi: new EmptyJob("update-pulumi")
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
        .addStep(steps.UpdatePulumi())
        .addStep(steps.ProviderWithPulumiUpgrade(opts.provider))
        .addStep(steps.CreateUpdatePulumiPR())
        .addStep(steps.UpdatePulumiPRAutoMerge()),
    },
  };
}

// This section represents sub-jobs that may be used in more than one workflow

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
      steps.DownloadProviderBinaries(opts.provider, name),
      steps.UnTarProviderBinaries(opts.provider, name),
      steps.RestoreBinaryPerms(opts.provider, name),
      steps.CodegenDuringSDKBuild(opts.provider),
      steps.InitializeSubModules(opts.submodules),
      steps.GenerateSDKs(opts.provider),
      steps.BuildSDKs(opts.provider),
      steps.CheckCleanWorkTree(),
      steps.Porcelain(),
      steps.ZipSDKsStep(),
      steps.UploadSDKs(),
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

  addRunsOn(provider: string) {
    if (provider === "azure-native") {
      this["runs-on"] =
        "${{ matrix.language == 'dotnet' && 'macos-latest' || 'ubuntu-latest' }}";
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
      steps.InstallSchemaChecker(opts.provider),
      steps.BuildK8sgen(opts.provider),
      steps.PrepareOpenAPIFile(opts.provider),
      steps.InitializeSubModules(opts.submodules),
      steps.BuildCodegenBinaries(opts.provider),
      steps.BuildSchema(opts.provider),
      steps.MakeKubernetesProvider(opts.provider),
      steps.CheckSchemaChanges(opts.provider),
      steps.CommentSchemaChangesOnPR(opts.provider),
      steps.LabelIfNoBreakingChanges(opts.provider),
      steps.BuildProvider(opts.provider),
      steps.CheckCleanWorkTree(),
      steps.Porcelain(),
      steps.TarProviderBinaries(),
      steps.UploadProviderBinaries(),
      steps.TestProviderLibrary(),
      steps.NotifySlack("Failure in building provider prerequisites"),
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

export class TestsJob implements NormalJob {
  "runs-on" = "ubuntu-latest";
  needs = ["build_sdks"];
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
    if (opts.provider === "kubernetes") {
      this.needs = ["build_sdks", "build-test-cluster"];
    }
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
      steps.DownloadProviderBinaries(opts.provider, name),
      steps.UnTarProviderBinaries(opts.provider, name),
      steps.RestoreBinaryPerms(opts.provider, name),
      steps.DownloadSDKs(),
      steps.UnzipSDKs(),
      steps.UpdatePath(),
      steps.InstallNodeDeps(),
      steps.SetNugetSource(),
      steps.InstallPythonDeps(),
      steps.InstallSDKDeps(),
      steps.MakeKubeDir(opts.provider),
      steps.DownloadKubeconfig(opts.provider),
      steps.ConfigureAwsCredentialsForTests(opts.aws),
      steps.ConfigureGcpCredentials(opts.gcp),
      steps.InstallKubectl(opts.provider),
      steps.InstallandConfigureHelm(opts.provider),
      steps.SetupGotestfmt(),
      steps.RunTests(opts.provider),
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

export class BuildTestClusterJob implements NormalJob {
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
  steps: NormalJob["steps"];
  name: string;
  if: NormalJob["if"];
  outputs: NormalJob["outputs"];

  constructor(name: string, opts: WorkflowOpts) {
    this.name = name;
    this.outputs = {
      "stack-name": "${{ steps.stackname.outputs.stack-name }}",
    };
    this.steps = [
      steps.CheckoutRepoStep(),
      steps.InstallGo(),
      steps.InstallPulumiCli(),
      steps.InstallNodeJS(),
      steps.InstallDotNet(),
      steps.InstallPython(),
      steps.InstallPythonDeps(),
      steps.ConfigureGcpCredentials(opts.gcp),
      steps.InstallKubectl(opts.provider),
      steps.LoginGoogleCloudRegistry(opts.provider),
      steps.SetStackName(opts.provider),
      steps.CreateTestCluster(opts.provider),
      steps.UploadKubernetesArtifacts(opts.provider),
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

export class TeardownTestClusterJob implements NormalJob {
  "runs-on" = "ubuntu-latest";
  strategy = {
    "fail-fast": false,
    matrix: {
      goversion: [goVersion],
      dotnetversion: [dotnetVersion],
      pythonversion: [pythonVersion],
      nodeversion: [nodeVersion],
    },
  };
  steps: NormalJob["steps"];
  name: string;
  if: NormalJob["if"];
  needs: NormalJob["needs"];

  constructor(name: string, opts: WorkflowOpts) {
    this.name = name;
    this.needs = ["build-test-cluster", "test"];
    this.if =
      "${{ always() }} && github.event.pull_request.head.repo.full_name == github.repository";
    this.steps = [
      steps.CheckoutRepoStep(),
      steps.InstallGo(),
      steps.InstallPulumiCli(),
      steps.InstallNodeJS(),
      steps.InstallDotNet(),
      steps.InstallPython(),
      steps.InstallPythonDeps(),
      steps.ConfigureGcpCredentials(opts.gcp),
      steps.InstallKubectl(opts.provider),
      steps.LoginGoogleCloudRegistry(opts.provider),
      steps.DestroyTestCluster(opts.provider),
      steps.DeleteArtifact(opts.provider),
    ].filter((step: Step) => step.uses !== undefined || step.run !== undefined);
    Object.assign(this, { name });
  }

  addDispatchConditional(isWorkflowDispatch: boolean) {
    if (isWorkflowDispatch) {
      this.steps = this.steps?.filter((step) => step.name !== "Checkout Repo");
      this.steps?.unshift(steps.CheckoutRepoStepAtPR());
    }
    return this;
  }
}

export class LintKubernetesJob implements NormalJob {
  "runs-on" = "ubuntu-latest";
  strategy = {
    "fail-fast": true,
    matrix: {
      goversion: [goVersion],
    },
  };
  steps = [steps.CheckoutRepoStep(), steps.InstallGo(), steps.GolangciLint()];
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

export class PublishPrereleaseJob implements NormalJob {
  "runs-on" = "ubuntu-latest";
  needs = "test";
  strategy = {
    matrix: {
      goversion: [goVersion],
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

export class PublishSDKsJob implements NormalJob {
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
    steps.InstallTwine(),
    steps.RunPublishSDK(),
    steps.NotifySlack("Failure in publishing SDK"),
  ];
  name: string;

  constructor(name: string) {
    this.name = name;
    Object.assign(this, { name });
  }
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

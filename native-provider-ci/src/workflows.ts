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
<<<<<<< HEAD
      build_sdks: new BuildSdkJob("build_sdks", opts)
        .addDispatchConditional(true)
        .addRunsOn(opts.provider),
=======
      build_sdks: new BuildSdkJob("build_sdks", opts).addDispatchConditional(
        true
      ),
>>>>>>> 3c548907 (Add pull request/comment on PR workflow)
      test: new TestsJob("test", opts).addDispatchConditional(true),
    },
  };
  if (opts.provider === "kubernetes") {
    workflow.jobs = Object.assign(workflow.jobs, {
<<<<<<< HEAD
      "build-test-cluster": new BuildTestClusterJob(
=======
      build_test_cluster: new BuildTestClusterJob(
>>>>>>> 3c548907 (Add pull request/comment on PR workflow)
        "build-test-cluster",
        opts
      ).addDispatchConditional(true),
    });
    workflow.jobs = Object.assign(workflow.jobs, {
<<<<<<< HEAD
      "destroy-test-cluster": new TeardownTestClusterJob(
=======
      destroy_test_cluster: new TeardownTestClusterJob(
>>>>>>> 3c548907 (Add pull request/comment on PR workflow)
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
<<<<<<< HEAD
      steps.DownloadProviderBinaries(opts.provider, name),
      steps.UnTarProviderBinaries(opts.provider, name),
      steps.RestoreBinaryPerms(opts.provider, name),
      steps.CodegenDuringSDKBuild(opts.provider),
=======
      steps.DownloadProviderBinaries(),
      steps.UnTarProviderBinaries(),
      steps.RestoreBinaryPerms(),
>>>>>>> 3c548907 (Add pull request/comment on PR workflow)
      steps.InitializeSubModules(opts.submodules),
      steps.GenerateSDKs(opts.provider),
      steps.BuildSDKs(opts.provider),
      steps.CheckCleanWorkTree(),
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
<<<<<<< HEAD

  addRunsOn(provider: string) {
    if (provider === "azure-native") {
      this["runs-on"] =
        "${{ matrix.language == 'dotnet' && 'macos-latest' || 'ubuntu-latest' }}";
    }
    return this;
  }
=======
>>>>>>> 3c548907 (Add pull request/comment on PR workflow)
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
      steps.TarProviderBinaries(),
      steps.UploadProviderBinaries(),
      steps.TestProviderLibrary(),
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
<<<<<<< HEAD
      steps.DownloadProviderBinaries(opts.provider, name),
      steps.UnTarProviderBinaries(opts.provider, name),
      steps.RestoreBinaryPerms(opts.provider, name),
=======
      steps.DownloadProviderBinaries(),
      steps.UnTarProviderBinaries(),
      steps.RestoreBinaryPerms(),
>>>>>>> 3c548907 (Add pull request/comment on PR workflow)
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
<<<<<<< HEAD
=======
      language: ["nodejs", "python", "dotnet", "go"],
>>>>>>> 3c548907 (Add pull request/comment on PR workflow)
    },
  };
  steps: NormalJob["steps"];
  name: string;
  if: NormalJob["if"];
  outputs: NormalJob["outputs"];

  constructor(name: string, opts: WorkflowOpts) {
    this.name = name;
<<<<<<< HEAD
    this.outputs = {
      "stack-name": "${{ steps.stackname.outputs.stack-name }}",
    };
=======
    this.outputs = { "stack-name": "${{ steps.vars.outputs.stack-name }}" };
>>>>>>> 3c548907 (Add pull request/comment on PR workflow)
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
    "fail-fast": true,
    matrix: {
      goversion: [goVersion],
      dotnetversion: [dotnetVersion],
      pythonversion: [pythonVersion],
      nodeversion: [nodeVersion],
<<<<<<< HEAD
=======
      language: ["nodejs", "python", "dotnet", "go"],
>>>>>>> 3c548907 (Add pull request/comment on PR workflow)
    },
  };
  steps: NormalJob["steps"];
  name: string;
  if: NormalJob["if"];
  needs: NormalJob["needs"];

  constructor(name: string, opts: WorkflowOpts) {
    this.name = name;
    this.needs = ["build-test-cluster", "test"];
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
<<<<<<< HEAD
      steps.DeleteArtifact(opts.provider),
=======
>>>>>>> 3c548907 (Add pull request/comment on PR workflow)
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

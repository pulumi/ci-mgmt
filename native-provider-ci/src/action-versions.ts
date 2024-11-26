import * as fs from "fs";
import * as yaml from "yaml";

const defaults = readDefaults();

// Languages
export const goLint = defaults["golangci/golangci-lint-action"];
export const setupGo = defaults["actions/setup-go"];
export const setupDotNet = defaults["actions/setup-dotnet"];
export const setupJava = defaults["actions/setup-java"];
export const setupGradle = defaults["gradle/gradle-build-action"];
export const setupNode = defaults["actions/setup-node"];
export const setupPython = defaults["actions/setup-python"];

// Cloud Auth
export const azureLogin = defaults["azure/login"];
export const configureAwsCredentials =
  defaults["aws-actions/configure-aws-credentials"];
export const setupGcloud = defaults["google-github-actions/setup-gcloud"];
export const googleAuth = defaults["google-github-actions/auth"];

// Tools
export const goReleaser = defaults["goreleaser/goreleaser-action"];
export const gradleBuildAction = defaults["gradle/gradle-build-action"];
export const installGhRelease = defaults["jaxxstorm/action-install-gh-release"];
export const installPulumiCli = defaults["pulumi/actions"];
export const codecov = defaults["codecov/codecov-action"];
export const providerVersion = defaults["pulumi/provider-version-action"];

// GHA Utilities
export const addAndCommit = defaults["EndBug/add-and-commit"];
export const addLabel = defaults["actions-ecosystem/action-add-labels"];
export const autoMerge = defaults["peter-evans/enable-pull-request-automerge"];
export const checkout = defaults["actions/checkout"];
export const gitStatusCheck = defaults["pulumi/git-status-check-action"];
export const cleanupArtifact = defaults["c-hive/gha-remove-artifacts"];
export const createOrUpdateComment =
  defaults["peter-evans/create-or-update-comment"];
export const deleteArtifact = defaults["geekyeggo/delete-artifact"];
export const downloadArtifact = defaults["actions/download-artifact"];
export const notifySlack = defaults["8398a7/action-slack"];
export const pathsFilter = defaults["dorny/paths-filter"];
export const pullRequest = defaults["repo-sync/pull-request"];
export const prComment = defaults["thollander/actions-comment-pull-request"];
export const slashCommand = defaults["peter-evans/slash-command-dispatch"];
export const uploadArtifact = defaults["actions/upload-artifact"];
export const githubScript = defaults["actions/github-script"];
export const upgradeProviderAction =
  defaults["pulumi/pulumi-upgrade-provider-action"];
export const slackNotification = defaults["rtCamp/action-slack-notify"];
export const freeDiskSpace = defaults["jlumbroso/free-disk-space"];
export const createKindCluster = defaults["helm/kind-action"];
export const githubStatusAction = defaults["guibranco/github-status-action-v2"];

function readDefaults() {
  const defaults: { [key: string]: string } = {};

  const parsed = yaml.parse(
    fs.readFileSync(
      __dirname + "/../../.github/workflows/default-action-versions.yml",
      "utf-8"
    )
  ) as workflow;

  for (const name in parsed.jobs) {
    parsed.jobs[name].steps.forEach((s) => {
      defaults[s.name] = s.uses;
    });
  }

  return defaults;
}

type workflow = {
  jobs: { [key: string]: job };
};

type job = {
  steps: step[];
};

type step = {
  name: string;
  uses: string;
};

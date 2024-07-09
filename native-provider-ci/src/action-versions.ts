// Languages
export const goLint = "golangci/golangci-lint-action@v4";
export const setupGo = "actions/setup-go@v5";
export const setupDotNet = "actions/setup-dotnet@v4";
export const setupJava = "actions/setup-java@v4";
export const setupGradle = "gradle/gradle-build-action@v3";
export const setupNode = "actions/setup-node@v4";
export const setupPython = "actions/setup-python@v5";

// Cloud Auth
export const azureLogin = "azure/login@v1";
export const configureAwsCredentials =
  "aws-actions/configure-aws-credentials@v4";
export const setupGcloud = "google-github-actions/setup-gcloud@v2";
export const googleAuth = "google-github-actions/auth@v0";

// Tools
export const goReleaser = "goreleaser/goreleaser-action@v5";
export const gradleBuildAction = "gradle/gradle-build-action@v3";
export const installGhRelease = "jaxxstorm/action-install-gh-release@v1.11.0";
export const installPulumiCli = "pulumi/actions@v5";
export const codecov = "codecov/codecov-action@v4";
export const providerVersion = "pulumi/provider-version-action@v1";

// GHA Utilities
export const addAndCommit = "EndBug/add-and-commit@v7";
export const addLabel = "actions-ecosystem/action-add-labels@v1.1.0";
export const autoMerge = "peter-evans/enable-pull-request-automerge@v1";
export const checkout = "actions/checkout@v4";
export const gitStatusCheck = "pulumi/git-status-check-action@v1";
export const cleanupArtifact = "c-hive/gha-remove-artifacts@v1";
export const createOrUpdateComment = "peter-evans/create-or-update-comment@v1";
export const deleteArtifact = "geekyeggo/delete-artifact@v5";
export const downloadArtifact = "actions/download-artifact@v4";
export const notifySlack = "8398a7/action-slack@v3";
export const pathsFilter = "dorny/paths-filter@v2";
export const pullRequest = "repo-sync/pull-request@v2.6.2";
export const prComment = "thollander/actions-comment-pull-request@v2";
export const slashCommand = "peter-evans/slash-command-dispatch@v2";
export const uploadArtifact = "actions/upload-artifact@v4";
export const githubScript = "actions/github-script@v6";
export const upgradeProviderAction =
  "pulumi/pulumi-upgrade-provider-action@v0.0.5";
export const slackNotification = "rtCamp/action-slack-notify@v2";
export const freeDiskSpace = "jlumbroso/free-disk-space@v1.3.1"; // action does not support major version pinning, so we need to pin to exact version
export const createKindCluster = "helm/kind-action@v1";
export const githubStatusAction =
  "guibranco/github-status-action-v2@0849440ec82c5fa69b2377725b9b7852a3977e76";

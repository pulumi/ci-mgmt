import * as shared from './lib/shared-workflows';
import * as wf from './lib/workflows';
import * as goreleaser from './lib/goreleaser';
import * as lint from './lib/golangci';
import * as param from '@jkcfg/std/param';


const getRequiredStringParam = (path) => {
  const value = param.String(path);
  if (!value) {
    throw new Error(`Config value "${path}" is required.`);
  }

  return value;
};

const provider = getRequiredStringParam('provider');
const upstreamProviderOrg = getRequiredStringParam('upstream-provider-org');
const upstreamProviderRepo = param.String('upstream-provider-repo', `terraform-provider-${provider}`);

// NOTE: The following code works against the JS in lib/ generated from the TS
// in src/. In order to have changes in e.g. workflows.ts be reflected in this
// code, run `make dist`.
//
// This design inconsistency should be fixed in the future, but cannot be at the
// time of writing due to schedule constraints.

// eslint-disable-next-line no-template-curly-in-string
const runAcceptanceTests = () => new wf.RunAcceptanceTestsWorkflow('run-acceptance-tests');
const pullRequest = () => new wf.PullRequestWorkflow('pull-request');
const master = () => new wf.DefaultBranchWorkflow('master');
const main = () => new wf.DefaultBranchWorkflow('main');
const cron = () => new wf.NightlyCronWorkflow('cron');
const preRelease = () => new wf.PrereleaseWorkflow('prerelease');
const release = () => new wf.ReleaseWorkflow('release');
const updatePulumiTerraformBridge = () => new wf.UpdatePulumiTerraformBridgeWorkflow();
const updateUpstreamProvider = () => new wf.UpdateUpstreamProviderWorkflow(upstreamProviderOrg, upstreamProviderRepo);
const commandDispatch = () => new wf.CommandDispatchWorkflow();
const pre = () => new goreleaser.PulumiGoreleaserPreConfig(provider);
const r = () => new goreleaser.PulumiGoreleaserConfig(provider);
const lintConfig = () => new lint.PulumiGolangCIConfig();
const cleanup = () => new shared.ArtifactCleanupWorkflow();
const automation = () => new shared.AutoMergeWorkflow();

export default [
  { value: runAcceptanceTests(), file: `providers/${provider}/repo/.github/workflows/run-acceptance-tests.yml` },
  { value: pullRequest(), file: `providers/${provider}/repo/.github/workflows/pull-request.yml` },
  { value: master(), file: `providers/${provider}/repo/.github/workflows/master.yml` },
  { value: main(), file: `providers/${provider}/repo/.github/workflows/main.yml` },
  { value: preRelease(), file: `providers/${provider}/repo/.github/workflows/prerelease.yml` },
  { value: release(), file: `providers/${provider}/repo/.github/workflows/release.yml` },
  { value: cron(), file: `providers/${provider}/repo/.github/workflows/nightly-test.yml` },
  { value: automation(), file: `providers/${provider}/repo/.github/workflows/pr-automation.yml` },
  { value: cleanup(), file: `providers/${provider}/repo/.github/workflows/artifact-cleanup.yml` },
  { value: commandDispatch(), file: `providers/${provider}/repo/.github/workflows/command-dispatch.yml` },
  { value: updatePulumiTerraformBridge(), file: `providers/${provider}/repo/.github/workflows/update-bridge.yml` },
  { value: updateUpstreamProvider(), file: `providers/${provider}/repo/.github/workflows/update-upstream-provider.yml` },
  { value: pre(), file: `providers/${provider}/repo/.goreleaser.prerelease.yml` },
  { value: r(), file: `providers/${provider}/repo/.goreleaser.yml` },
  { value: lintConfig(), file: `providers/${provider}/repo/.golangci.yml` },
];

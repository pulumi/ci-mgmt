import * as shared from './lib/shared-workflows';
import * as wf from './lib/workflows';
import * as goreleaser from './lib/goreleaser';
import * as lint from './lib/golangci';
import * as param from '@jkcfg/std/param';

const provider = param.String('provider');

// eslint-disable-next-line no-template-curly-in-string
const runAcceptanceTests = name => new wf.RunAcceptanceTestsWorkflow('run-acceptance-tests');
const pullRequest = name => new wf.PullRequestWorkflow('pull-request');
const master = name => new wf.DefaultBranchWorkflow('master');
const main = name => new wf.DefaultBranchWorkflow('main');
const cron = name => new wf.NightlyCronWorkflow('cron');
const preRelease = name => new wf.PrereleaseWorkflow('prerelease');
const release = name => new wf.ReleaseWorkflow('release');
const updatePulumiTerraformBridge = name => new wf.UpdatePulumiTerraformBridgeWorkflow();
const commandDispatch = name => new wf.CommandDispatchWorkflow();
const pre = name => new goreleaser.PulumiGoreleaserPreConfig(provider);
const r = name => new goreleaser.PulumiGoreleaserConfig(provider);
const lintConfig = name => new lint.PulumiGolangCIConfig();
const cleanup = name => new shared.ArtifactCleanupWorkflow();
const automation = name => new shared.AutoMergeWorkflow();

export default [
  { value: runAcceptanceTests('run-acceptance-tests'), file: `providers/${provider}/repo/.github/workflows/run-acceptance-tests.yml` },
  { value: pullRequest('pull-request'), file: `providers/${provider}/repo/.github/workflows/pull-request.yml` },
  { value: master('master'), file: `providers/${provider}/repo/.github/workflows/master.yml`},
  { value: main('main'), file: `providers/${provider}/repo/.github/workflows/main.yml`},
  { value: preRelease('prerelease'), file: `providers/${provider}/repo/.github/workflows/prerelease.yml` },
  { value: release('release'), file: `providers/${provider}/repo/.github/workflows/release.yml` },
  { value: cron('cron'), file: `providers/${provider}/repo/.github/workflows/nightly-test.yml` },
  { value: automation('automation'), file: `providers/${provider}/repo/.github/workflows/pr-automation.yml` },
  { value: cleanup('cleanup'), file: `providers/${provider}/repo/.github/workflows/artifact-cleanup.yml`},
  { value: commandDispatch('command-dispatch'), file: `providers/${provider}/repo/.github/workflows/command-dispatch.yml`},
  { value: updatePulumiTerraformBridge('update-pulumi-terraform-bridge'), file: `providers/${provider}/repo/.github/workflows/update-bridge.yml`},
  { value: pre(provider), file: `providers/${provider}/repo/.goreleaser.prerelease.yml` },
  { value: r(provider), file: `providers/${provider}/repo/.goreleaser.yml` },
  { value: lintConfig('lint'), file: `providers/${provider}/repo/.golangci.yml` },
];

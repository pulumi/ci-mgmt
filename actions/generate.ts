import * as wf from 'lib/workflow';
import * as goreleaser from 'lib/goreleaser';
import * as lint from 'lib/golangci';
import * as param from '@jkcfg/std/param';

const provider = param.String('provider');

// eslint-disable-next-line no-template-curly-in-string
const pullRequest = name => new wf.PulumiBaseWorkflow('pull-request');
const master = name => new wf.PulumiMasterWorkflow('master');
const preRelease = name => new wf.PulumiPreReleaseWorkflow('prerelease');
const release = name => new wf.PulumiReleaseWorkflow('release');
const automation = name => new wf.PulumiAutomationWorkflow('automation')
const pre = name => new goreleaser.PulumiGoreleaserPreConfig(provider);
const r = name => new goreleaser.PulumiGoreleaserConfig(provider);
const lintConfig = name => new lint.PulumiGolangCIConfig()


export default [
  { value: pullRequest('pull-request'), file: `providers/${provider}/repo/.github/workflows/pull-request.yml` },
  { value: master('master'), file: `providers/${provider}/repo/.github/workflows/master.yml`},
  { value: preRelease('prerelease'), file: `providers/${provider}/repo/.github/workflows/prerelease.yml` },
  { value: release('release'), file: `providers/${provider}/repo/.github/workflows/release.yml` },
  { value: automation('automation'), file: `providers/${provider}/repo/.github/workflows/pr-automation.yml` },
  { value: pre(provider), file: `providers/${provider}/repo/.goreleaser.prerelease.yml` },
  { value: r(provider), file: `providers/${provider}/repo/.goreleaser.yml` },
  { value: lintConfig('lint'), file: `providers/${provider}/repo/.golangci.yml` },
];

import * as wf from 'lib/workflow';
import * as goreleaser from 'lib/goreleaser';
import * as param from '@jkcfg/std/param';

const provider = param.String('provider');

// eslint-disable-next-line no-template-curly-in-string
const workflow = name => new wf.PulumiBaseWorkflow('branches');
const preRelease = name => new wf.PulumiPreReleaseWorkflow('prerelease');
const release = name => new wf.PulumiReleaseWorkflow('release');
const pre = name => new goreleaser.PulumiGoreleaserPreConfig(provider);
const r = name => new goreleaser.PulumiGoreleaserConfig(provider);


export default [
  { value: workflow('branches'), file: `providers/${provider}/repo/.github/workflows/branches.yml` },
  { value: preRelease('prerelease'), file: `providers/${provider}/repo/.github/workflows/prerelease.yml` },
  { value: release('release'), file: `providers/${provider}/repo/.github/workflows/release.yml` },
  { value: pre(provider), file: `providers/${provider}/repo/.goreleaser.prerelease.yml` },
  { value: r(provider), file: `providers/${provider}/repo/.goreleaser.yml` },

];

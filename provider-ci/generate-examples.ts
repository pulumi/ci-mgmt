import * as wf from './lib/examples';
import * as param from '@jkcfg/std/param';

const provider = param.String('provider');

// eslint-disable-next-line no-template-curly-in-string
const cron = name => new wf.CronWorkflow('Run Examples Cron Job');
const commandDispatch = name => new wf.CommandDispatchWorkflow();
const pr = name => new wf.PrWorkFlow('New Pull request Open');
const runTestsCommand = name => new wf.RunTestsCommandWorkflow('Run Examples Tests From PR');
const smokeTestCli = name => new wf.SmokeTestCliWorkflow('Smoke Test Specific Version of CLI');
const smokeTestProvider = name => new wf.SmokeTestProvidersWorkflow('Smoke Test Latest Provider Release');


export default [
  { value: cron('cron'), file: `platform/examples/repo/.github/workflows/cron.yml` },
  { value: commandDispatch('command-dispatch'), file: `platform/examples/repo/.github/workflows/command_dispatch.yml` },
  { value: pr('pr'), file: `platform/examples/repo/.github/workflows/pr.yml` },
  { value: runTestsCommand('run-tests-command'), file: `platform/examples/repo/.github/workflows/run-tests-command.yml` },
  { value: smokeTestCli('smoke-test-cli'), file: `platform/examples/repo/.github/workflows/smoke-test-cli-command.yml` },
  { value: smokeTestProvider('smoke-test-provider'), file: `platform/examples/repo/.github/workflows/smoke-test-provider-command.yml` },
];

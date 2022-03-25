import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import * as yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ProviderFile } from "../src/provider";
import * as wf from "../src/examples";

const args = yargs(hideBin(process.argv))
  .command("generate-examples", "generate examples files")
  .option("debug", {
    description: "Enable debug logging",
    type: "boolean",
  })
  .parseSync();

const debug = (message?: any, ...optionalParams: any[]) => {
  if (args.debug) {
    console.log(message, ...optionalParams);
  }
};

export const buildWorkflows = (): ProviderFile[] => {
  return [
    {
      path: "cron.yml",
      data: wf.CronWorkflow("Run Examples Cron Job"),
    },
    {
      path: "command_dispatch.yml",
      data: new wf.CommandDispatchWorkflow(),
    },
    {
      path: "pr.yml",
      data: wf.PrWorkFlow("New Pull request Open"),
    },
    {
      path: "run-tests-command.yml",
      data: wf.RunTestsCommandWorkflow("Run Examples Tests From PR"),
    },
    {
      path: "smoke-test-cli-command.yml",
      data: wf.SmokeTestCliWorkflow("Smoke Test Specific Version of CLI"),
    },
    {
      path: "smoke-test-provider-command.yml",
      data: wf.SmokeTestProvidersWorkflow("Smoke Test Latest Provider Release"),
    },
  ];
};

const writeProviderFiles = (files: ProviderFile[]) => {
  const examplesWorkflowsPath = path.join(
    "platform",
    "examples",
    "repo",
    ".github",
    "workflows"
  );
  for (const file of files) {
    const filePath = path.join(examplesWorkflowsPath, file.path);
    const yamlContent = yaml.stringify(file.data, {
      sortMapEntries: true,
      indentSeq: false,
    });
    debug("Writing", filePath);
    fs.writeFileSync(filePath, yamlContent, { encoding: "utf-8" });
  }
};

const workflows = buildWorkflows();
writeProviderFiles(workflows);

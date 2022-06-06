import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import * as yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ProviderFile } from "../src/provider";
import { generateExamplesFiles } from "../src/examples";

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

const writeProviderFiles = (files: ProviderFile[]) => {
  const examplesWorkflowsPath = path.join(
    "platform",
    "examples",
    "repo",
    ".github",
    "workflows"
  );
  if (fs.existsSync(examplesWorkflowsPath)) {
    fs.rmSync(examplesWorkflowsPath, { recursive: true });
  }
  fs.mkdirSync(examplesWorkflowsPath, { recursive: true });
  for (const file of files) {
    const filePath = path.join(examplesWorkflowsPath, file.path);
    const yamlContent = yaml.stringify(file.data, {
      sortMapEntries: true,
      indentSeq: false,
    });
    debug("Writing", filePath);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, yamlContent, { encoding: "utf-8" });
  }
};

const workflows = generateExamplesFiles();
writeProviderFiles(workflows);

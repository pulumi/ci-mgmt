import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import * as yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { parseConfig } from "../src/config";
import { generate, RepositoryFiles } from "../src/generate";

const args = yargs(hideBin(process.argv))
  .command("generate-providers", "generate the providers")
  .option("name", {
    description: "Project name to generate",
    type: "string",
    array: true,
    alias: "n",
  })
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

function getConfigs() {
  const includeAll = args.name === undefined || args.name.length === 0;
  const nameSet = new Set(args.name);
  const configNames = fs
    .readdirSync("config", { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".yaml"))
    .map((d) => d.name.substring(0, d.name.length - 5));
  return configNames
    .filter((name) => includeAll || nameSet.has(name))
    .map((name) => {
      const configContent = fs.readFileSync(
        path.join("config", `${name}.yaml`),
        "utf-8"
      );
      return { name, config: parseConfig(configContent) };
    });
}

const writeProviderFiles = (provider: RepositoryFiles) => {
  const providerRepoPath = path.join("repos", provider.repository);
  if (fs.existsSync(providerRepoPath)) {
    fs.rmSync(providerRepoPath, { recursive: true });
  }
  fs.mkdirSync(providerRepoPath, { recursive: true });
  for (const file of provider.files) {
    const filePath = path.join(providerRepoPath, file.path);
    const data =
      typeof file.data === "string"
        ? file.data
        : yaml.stringify(file.data, {
            sortMapEntries: true,
            indentSeq: false,
          });
    debug("Writing", filePath);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, data, { encoding: "utf-8" });
  }
};

const configs = getConfigs();
debug(
  "providers to generate",
  configs.map((c) => c.name)
);

const providerFiles = configs.map((config) => generate(config.config));
providerFiles.forEach(writeProviderFiles);

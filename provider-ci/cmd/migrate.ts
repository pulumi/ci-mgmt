import * as fs from "fs";
import * as path from "path";
import { providersDir } from "../src/config";

const providerNames = fs
  .readdirSync(providersDir, { withFileTypes: true })
  .filter((dir) => dir.isDirectory)
  .map((dir) => dir.name);

const schemaConfig = "# yaml-language-server: $schema=../config-schema.json\n";

providerNames.forEach((provider) => {
  const configYaml = fs.readFileSync(
    path.join("providers", provider, "config.yaml"),
    "utf-8"
  );
  const configWithSchema = schemaConfig + configYaml;
  const outputPath = path.join("config", `${provider}.yaml`);
  fs.writeFileSync(outputPath, configWithSchema);
});

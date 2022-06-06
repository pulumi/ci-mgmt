import * as fs from "fs";
import * as path from "path";
import { providersDir } from "../src/config";

const providerNames = fs
  .readdirSync(providersDir, { withFileTypes: true })
  .filter((dir) => dir.isDirectory)
  .map((dir) => dir.name);

const schemaConfig =
  "# yaml-language-server: $schema=../ci-config-schema.json\n";

providerNames.forEach((provider) => {
  const configYaml = fs.readFileSync(
    path.join("providers", provider, "config.yaml"),
    "utf-8"
  );
  const configWithSchema = schemaConfig + configYaml;
  fs.writeFileSync(path.join("config", `${provider}.yaml`), configWithSchema);
});

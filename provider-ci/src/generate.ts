import { Config } from "./config";
import { generateExamplesFiles } from "./examples";
import { generateProviderFiles } from "./provider";

export interface RepositoryFile {
  path: string;
  data: unknown;
}

export interface RepositoryFiles {
  repository: string;
  files: RepositoryFile[];
}

export function generate(config: Config): RepositoryFiles {
  switch (config.template) {
    case "bridged":
      return {
        repository: `pulumi-${config.provider}`,
        files: generateProviderFiles(config),
      };
    case "examples":
      return {
        repository: "examples",
        files: generateExamplesFiles(),
      };
  }
}

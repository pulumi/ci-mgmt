import { Config } from "./config";
import { render } from "./make";
import { bridgedProvider } from "./make-bridged-provider";

type MakefileConfig = Pick<Config, "makeTemplate" | "provider" | "plugins">;

export function buildMakefile(config: MakefileConfig): string {
  switch (config.makeTemplate) {
    case "bridged":
      return render(bridgedProvider(config));
    default:
      throw new Error(`Unknown makefile template: ${config.makeTemplate}`);
  }
}

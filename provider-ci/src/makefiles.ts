import { BridgedConfig } from "./config";
import { render } from "./make";
import { bridgedProvider } from "./make-bridged-provider";

export function buildMakefile(config: BridgedConfig): string {
  switch (config.makeTemplate) {
    case "bridged":
      return render(bridgedProvider(config));
    default:
      throw new Error(`Unknown makefile template: ${config.makeTemplate}`);
  }
}

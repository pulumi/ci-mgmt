import { BridgedConfig } from "./config";
import { render } from "./make";
import { bridgedProvider } from "./make-bridged-provider";
import { bridgedProviderV2 } from "./make-bridged-provider-2";

export function buildMakefile(config: BridgedConfig): string {
  switch (config.makeTemplate) {
    case "bridged":
      return render(bridgedProvider(config));
    case "bridged-v2":
      return render(bridgedProviderV2(config));
    default:
      throw new Error(`Unknown makefile template: ${config.makeTemplate}`);
  }
}

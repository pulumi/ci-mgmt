import { render } from "./make";
import { bridgedProvider } from "./make-bridged-provider";

export function buildMakefile(config: {
  provider: string;
  makeTemplate: string;
}): string {
  switch (config.makeTemplate) {
    case "bridged":
      return render(bridgedProvider({ ...config, org: "pulumi" }));
    default:
      throw new Error(`Unknown makefile template: ${config.makeTemplate}`);
  }
}

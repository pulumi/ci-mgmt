import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { z } from "zod";

export const providersDir = "providers";

export const Config = z.object({
  provider: z.string(),
  // Workflow options
  env: z.record(z.any()).optional(),
  docker: z.boolean().default(false),
  aws: z.boolean().default(false),
  gcp: z.boolean().default(false),
  lint: z.boolean().default(true),
  "setup-script": z.string().optional(),
  parallel: z.number().default(3),
  timeout: z.number().default(60),
  // Provider options
  "upstream-provider-org": z.string(),
  "upstream-provider-repo": z.string().optional(),
  "fail-on-extra-mapping": z.boolean().default(true),
  "fail-on-missing-mapping": z.boolean().default(true),
  "upstream-provider-major-version": z.string().default(""),
  "provider-default-branch": z.string().default("master"),
  "golangci-timeout": z.string().default("20m"),
  "major-version": z.number().default(2),
  skipTfGen: z.boolean().default(false),
  providerVersion: z.string().default(""),
  skipWindowsArmBuild: z.boolean().default(false),
  // Makefile options
  makeTemplate: z.literal("bridged").optional(),
  plugins: z
    .array(z.object({ name: z.string(), version: z.string() }))
    .optional(),
});

const parseConfig = (provider: string, content: string) => {
  const parsed = Config.parse(yaml.parse(content));
  const upstreamProviderRepo =
    parsed["upstream-provider-repo"] ?? `terraform-provider-${provider}`;
  return {
    ...parsed,
    "upstream-provider-repo": upstreamProviderRepo,
  };
};

export type Config = Readonly<ReturnType<typeof parseConfig>>;

export const getConfig = (provider: string): Config => {
  const configPath = path.join(providersDir, provider, "config.yaml");
  const content = fs.readFileSync(configPath, { encoding: "utf-8" });
  return parseConfig(provider, content);
};

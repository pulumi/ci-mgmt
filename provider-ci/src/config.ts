import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import z from "zod";
import * as wf from "./workflows";
import { providersDir } from "../cmd/generate-providers";

const Config = z.object({
  provider: z.string(),
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
  makeTemplate: z.literal("bridged").optional(),
  plugins: z
    .array(z.object({ name: z.string(), version: z.string() }))
    .optional(),
});

export const getProviderConfig = (provider: string) => {
  const configPath = path.join(providersDir, provider, "config.yaml");
  const content = fs.readFileSync(configPath, { encoding: "utf-8" });
  const parsed = z
    .intersection(Config, wf.WorkflowOpts)
    .parse(yaml.parse(content));
  const upstreamProviderRepo =
    parsed["upstream-provider-repo"] ?? `terraform-provider-${provider}`;
  return {
    ...parsed,
    "upstream-provider-repo": upstreamProviderRepo,
  };
};

export type Config = ReturnType<typeof getProviderConfig>;

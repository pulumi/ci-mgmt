import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import z from "zod";
import * as shared from "./shared-workflows";
import * as wf from "./workflows";
import { providersDir } from "../cmd/generate-providers";

const Config = z.object({
  provider: z.string(),
  "provider-default-branch": z.string().default("master"),
  "golangci-timeout": z.string().default("20m"),
  "major-version": z.number().default(0),
  customLdFlag: z.string().default(""),
  skipWindowsArmBuild: z.boolean().default(false),
});

const getProviderConfig = (provider: string) => {
  const configPath = path.join(providersDir, provider, "config.yaml");
  const content = fs.readFileSync(configPath, { encoding: "utf-8" });
  const parsed = z
    .intersection(Config, wf.WorkflowOpts)
    .parse(yaml.parse(content));
  return {
    ...parsed,
  };
};

export interface ProviderFile {
  path: string;
  data: unknown;
}

export const buildProviderFiles = (provider: string): ProviderFile[] => {
  const config = getProviderConfig(provider);
  const githubWorkflowsDir = path.join(path.join(".github", "workflows"));
  return [
    {
      path: path.join(githubWorkflowsDir, "artifact-cleanup.yml"),
      data: new shared.ArtifactCleanupWorkflow(),
    },
    {
      path: path.join(githubWorkflowsDir, "command-dispatch.yml"),
      data: wf.CommandDispatchWorkflow("command-dispatch", config),
    },
    {
      path: path.join(githubWorkflowsDir, "pull-request.yml"),
      data: wf.PullRequestWorkflow("pull-request", config),
    },
    {
      path: path.join(githubWorkflowsDir, "run-acceptance-tests.yml"),
      data: wf.RunAcceptanceTestsWorkflow("run-acceptance-tests", config),
    },
  ];
};

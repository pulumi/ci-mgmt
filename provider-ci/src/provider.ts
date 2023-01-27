import * as path from "path";
import * as lint from "./golangci";
import * as goreleaser from "./goreleaser";
import * as shared from "./shared-workflows";
import * as wf from "./workflows";
import { buildMakefile } from "./makefiles";
import { BridgedConfig, getConfig } from "./config";

export interface ProviderFile {
  path: string;
  data: unknown;
}

export const buildProviderFiles = (provider: string): ProviderFile[] => {
  const config = getConfig(provider);
  if (config.template !== "bridged") {
    throw new Error(
      `Expected bridged template config, found "${config.template}"`,
    );
  }
  return generateProviderFiles(config);
};

export function generateProviderFiles(config: BridgedConfig) {
  const githubWorkflowsDir = path.join(path.join(".github", "workflows"));
  const files: ProviderFile[] = [
    {
      path: path.join(githubWorkflowsDir, "run-acceptance-tests.yml"),
      data: wf.RunAcceptanceTestsWorkflow("run-acceptance-tests", config),
    },
    {
      path: path.join(githubWorkflowsDir, "pull-request.yml"),
      data: wf.PullRequestWorkflow("pull-request", config),
    },
    {
      path: path.join(githubWorkflowsDir, "master.yml"),
      data: wf.DefaultBranchWorkflow("master", config),
    },
    {
      path: path.join(githubWorkflowsDir, "main.yml"),
      data: wf.DefaultBranchWorkflow("main", config),
    },
    {
      path: path.join(githubWorkflowsDir, "prerelease.yml"),
      data: wf.PrereleaseWorkflow("prerelease", config),
    },
    {
      path: path.join(githubWorkflowsDir, "release.yml"),
      data: wf.ReleaseWorkflow("release", config),
    },
    {
      path: path.join(githubWorkflowsDir, "artifact-cleanup.yml"),
      data: new shared.ArtifactCleanupWorkflow(),
    },
    {
      path: path.join(githubWorkflowsDir, "command-dispatch.yml"),
      data: wf.CommandDispatchWorkflow("command-dispatch", config),
    },
    {
      path: path.join(githubWorkflowsDir, "update-bridge.yml"),
      data: wf.UpdatePulumiTerraformBridgeWorkflow({
        providerDefaultBranch: config["provider-default-branch"],
      }),
    },
    {
      path: path.join(githubWorkflowsDir, "resync-build.yml"),
      data: wf.ResyncBuildWorkflow(config),
    },
    {
      path: path.join(githubWorkflowsDir, "update-upstream-provider.yml"),
      data: wf.UpdateUpstreamProviderWorkflow(config),
    },
    {
      path: path.join(githubWorkflowsDir, "community-moderation.yml"),
      data: wf.ModerationWorkflow("warn-codegen", config),
    },
    {
      path: ".goreleaser.prerelease.yml",
      data: new goreleaser.PulumiGoreleaserPreConfig(config),
    },
    {
      path: ".goreleaser.yml",
      data: new goreleaser.PulumiGoreleaserConfig(config),
    },
    {
      path: ".golangci.yml",
      data: new lint.PulumiGolangCIConfig(config["golangci-timeout"]),
    },
    {
      path: path.join("provider", "pkg", "version", "go.mod"),
      data:
        `module github.com/pulumi-${config.provider}/provider/pkg/version\n\ngo 1.19\n`,
    },
    ...(config["generate-nightly-test-workflow"]
      ? [
        {
          path: path.join(githubWorkflowsDir, "nightly-test.yml"),
          data: wf.NightlyCronWorkflow("cron", config),
        },
      ]
      : []),
  ];

  if (config.makeTemplate !== "none") {
    files.push({
      path: "Makefile",
      data: buildMakefile(config),
    });
    if (config.makeTemplate === "bridged-v2") {
      files.push(
        {
          path: ".version.pulumictl.txt",
          data: "v0.0.32",
        },
        {
          path: ".version.javagen.txt",
          data: "v0.5.4",
        },
      );
    }
  }

  return files;
}

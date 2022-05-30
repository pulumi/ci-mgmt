import { Makefile, Target } from "./make";
import { goBuild, genSchema, yarnInstall, cwd } from "./make-targets";

type BridgedProviderConfig = {
  provider: string;
  org: string;
};

export function bridgedProvider(config: BridgedProviderConfig): Makefile {
  const PACK = config.provider;
  const ORG = config.org;
  const PROJECT = `github.com/${ORG}/pulumi-${PACK}`;
  const NODE_MODULE_NAME = `@pulumi/${PACK}`;
  const TF_NAME = PACK;
  const PROVIDER_PATH = `provider/v5`;
  const SDK_PATH = `sdk/v5`;
  const VERSION_PATH = `${PROVIDER_PATH}/pkg/version.Version`;
  const TF_GEN = `pulumi-tfgen-${PACK}`;
  const PROVIDER = `pulumi-resource-${PACK}`;
  const VERSION = "$(shell pulumictl get version)";
  const TESTPARALLELISM = "10";
  const WORKING_DIR = "$(shell pwd)";

  const variables = {
    PACK,
    ORG,
    PROJECT,
    NODE_MODULE_NAME,
    TF_NAME,
    PROVIDER_PATH,
    SDK_PATH,
    VERSION_PATH,
    TF_GEN,
    PROVIDER,
    VERSION,
    TESTPARALLELISM,
    WORKING_DIR,
  } as const;

  const install_plugins: Target = {
    name: "install_plugins",
    commands: [
      "[ -x $(shell which pulumi) ] || curl -fsSL https://get.pulumi.com | sh",
      "pulumi plugin install resource tls 4.1.0",
      "pulumi plugin install resource github 4.10.0",
      "pulumi plugin install resource kubernetes 3.17.0",
      "pulumi plugin install resource random 4.4.1",
    ],
  };
  const development: Target = {
    name: "development",
    dependencies: [install_plugins],
  };
  const tfgen: Target = { name: "tfgen", dependencies: [install_plugins] };
  const provider: Target = {
    name: "provider",
    dependencies: [tfgen, install_plugins],
  };
  const build_nodejs: Target = { name: "build_nodejs" };
  const build_python: Target = { name: "build_python" };
  const build_go: Target = { name: "build_go" };
  const build_dotnet: Target = { name: "build_dotnet" };
  const build_sdks: Target = {
    name: "build_sdks",
    dependencies: [build_nodejs, build_python, build_go, build_dotnet],
  };
  const lint_provider: Target = {
    name: "lint_provider",
    dependencies: [provider],
  };
  const cleanup: Target = { name: "cleanup" };
  const help: Target = { name: "help" };
  const clean: Target = { name: "clean" };
  const install_dotnet_sdk: Target = { name: "install_dotnet_sdk" };
  const install_python_sdk: Target = { name: "install_python_sdk" };
  const install_go_sdk: Target = { name: "install_go_sdk" };
  const install_nodejs_sdk: Target = { name: "install_nodejs_sdk" };
  const install_sdks: Target = {
    name: "install_sdks",
    dependencies: [install_dotnet_sdk, install_python_sdk, install_nodejs_sdk],
  };
  const build: Target = {
    name: "build",
    dependencies: [install_plugins, provider, build_sdks, install_sdks],
  };
  const only_build: Target = { name: "only_build", dependencies: [build] };
  const test: Target = { name: "test" };
  return {
    variables,
    targets: [
      development,
      build,
      only_build,
      tfgen,
      provider,
      build_sdks,
      build_nodejs,
      build_python,
      build_go,
      build_dotnet,
      lint_provider,
      cleanup,
      help,
      clean,
      install_plugins,
      install_dotnet_sdk,
      install_python_sdk,
      install_go_sdk,
      install_nodejs_sdk,
      install_sdks,
      test,
    ],
  };
}

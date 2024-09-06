import * as action from "./action-versions";
import { NormalJob } from "./github-workflow";

export type Step = Required<NormalJob>["steps"][0];

export function CheckoutRepoStep(): Step {
  return {
    name: "Checkout Repo",
    uses: action.checkout,
    with: {
      lfs: true,
    },
  };
}

export function SetProviderVersionStep(): Step {
  return {
    id: "version",
    name: "Set Provider Version",
    uses: action.providerVersion,
    with: {
      "set-env": "PROVIDER_VERSION",
    },
  };
}

export function CommandDispatchStep(providerName: string): Step {
  return {
    uses: action.slashCommand,
    with: {
      token: "${{ secrets.PULUMI_BOT_TOKEN }}",
      "reaction-token": "${{ secrets.GITHUB_TOKEN }}",
      commands: "run-acceptance-tests",
      permission: "write",
      "issue-type": "pull-request",
      repository: `pulumi/pulumi-${providerName}`,
    },
  };
}

export function CommentPRWithSlashCommandStep(): Step {
  return {
    name: "Comment PR",
    uses: action.prComment,
    with: {
      message:
        "PR is now waiting for a maintainer to run the acceptance tests.\n" +
        "**Note for the maintainer:** To run the acceptance tests, please comment */run-acceptance-tests* on the PR\n",
      GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
    },
  };
}

export function CreateCommentsUrlStep(): Step {
  return {
    name: "Create URL to the run output",
    id: "vars",
    run: 'echo run-url=https://github.com/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID >> "$GITHUB_OUTPUT"',
  };
}

export function SetGitSubmoduleCommitHash(provider: string): Step {
  let dir;
  if (provider === "azure-native") {
    dir = "azure-rest-api-specs";
  }
  if (provider === "aws-native") {
    dir = "aws-cloudformation-user-guide";
  }
  if (provider === "google-native") {
    return {};
  }
  return {
    name: "Git submodule commit hash",
    id: "vars",
    run: 'echo commit-hash=$(git rev-parse HEAD) >> "$GITHUB_OUTPUT"',
    "working-directory": dir,
  };
}

export function CommitAutomatedSDKUpdates(provider: string): Step {
  let dir;
  if (provider === "azure-native") {
    dir = "azure-rest-api-specs";
  }
  if (provider === "aws-native") {
    dir = "aws-cloudformation-user-guide";
  }
  if (provider === "google-native") {
    return {
      name: "Commit changes",
      run:
        "git add discovery\n" +
        `git commit -m "Discovery documents"\n` +
        "git add .\n" +
        `git commit -m "Regenerating based on discovery"\n` +
        "git push origin generate-sdk/${{ github.run_id }}-${{ github.run_number }}",
    };
  }
  return {
    name: "Commit changes",
    run:
      "git add sdk\n" +
      `git commit -m "Regenerating SDKs based on ${dir} @ \${{ steps.vars.outputs.commit-hash }}" || echo "ignore commit failure, may be empty"\n` +
      "git add .\n" +
      `git commit -m "Regenerating based on ${dir} @ \${{ steps.vars.outputs.commit-hash }}" || echo "ignore commit failure, may be empty"\n` +
      "git push origin generate-sdk/${{ github.run_id }}-${{ github.run_number }}",
  };
}

export function EchoSuccessStep(): Step {
  return {
    name: "Is workflow a success",
    run: "echo yes",
  };
}

export function SentinelStep(): Step {
  return {
    name: "Mark workflow as successful",
    uses: action.githubStatusAction,
    with: {
      authToken: "${{ secrets.GITHUB_TOKEN }}",
      context: "Sentinel",
      state: "success",
      description: "Sentinel checks passed",
      sha: "${{ github.event.pull_request.head.sha || github.sha }}",
    },
  };
}

export function UpdatePRWithResultsStep(): Step {
  return {
    name: "Update with Result",
    uses: action.createOrUpdateComment,
    with: {
      token: "${{ secrets.PULUMI_BOT_TOKEN }}",
      repository:
        "${{ github.event.client_payload.github.payload.repository.full_name }}",
      "issue-number":
        "${{ github.event.client_payload.github.payload.issue.number }}",
      body: "Please view the PR build: ${{ steps.vars.outputs.run-url }}",
    },
  };
}

export function CheckoutRepoStepAtPR(): Step {
  return {
    name: "Checkout Repo",
    uses: action.checkout,
    with: {
      lfs: true,
      ref: "${{ env.PR_COMMIT_SHA }}",
    },
  };
}

export function CheckoutScriptsRepoSteps(): Step[] {
  return [
    {
      name: "Checkout Scripts Repo",
      uses: action.checkout,
      with: {
        path: "ci-scripts",
        repository: "pulumi/scripts",
      },
    },
    {
      run: 'echo "ci-scripts" >> .git/info/exclude', // actions/checkout#197
    },
  ];
}

export function GoogleAuth(requiresGcp?: boolean): Step {
  if (requiresGcp) {
    return {
      name: "Authenticate to Google Cloud",
      uses: action.googleAuth,
      with: {
        workload_identity_provider:
          "projects/${{ env.GOOGLE_PROJECT_NUMBER }}/locations/global/workloadIdentityPools/${{ env.GOOGLE_CI_WORKLOAD_IDENTITY_POOL }}/providers/${{ env.GOOGLE_CI_WORKLOAD_IDENTITY_PROVIDER }}",
        service_account: "${{ env.GOOGLE_CI_SERVICE_ACCOUNT_EMAIL }}",
      },
    };
  }
  return {};
}

export function SetupGCloud(requiresGcp?: boolean): Step {
  if (requiresGcp) {
    return {
      name: "Setup gcloud auth",
      uses: action.setupGcloud,
      with: {
        install_components: "gke-gcloud-auth-plugin",
      },
    };
  }
  return {};
}

export function ConfigureAwsCredentialsForTests(requiresAws?: boolean): Step {
  if (requiresAws) {
    return {
      name: "Configure AWS Credentials",
      uses: action.configureAwsCredentials,
      with: {
        "aws-access-key-id": "${{ secrets.AWS_ACCESS_KEY_ID }}",
        "aws-region": "${{ env.AWS_REGION }}",
        "aws-secret-access-key": "${{ secrets.AWS_SECRET_ACCESS_KEY }}",
        "role-duration-seconds": 3600,
        "role-session-name": "${{ env.PROVIDER }}@githubActions",
        "role-to-assume": "${{ secrets.AWS_CI_ROLE_ARN }}",
      },
    };
  }
  return {};
}

export function ConfigureAwsCredentialsForPublish(): Step {
  return {
    name: "Configure AWS Credentials",
    uses: action.configureAwsCredentials,
    with: {
      "aws-access-key-id": "${{ secrets.AWS_ACCESS_KEY_ID }}",
      "aws-region": "us-east-2",
      "aws-secret-access-key": "${{ secrets.AWS_SECRET_ACCESS_KEY }}",
      "role-duration-seconds": 7200,
      "role-session-name": "${{ env.PROVIDER }}@githubActions",
      "role-external-id": "upload-pulumi-release",
      "role-to-assume": "${{ secrets.AWS_UPLOAD_ROLE_ARN }}",
    },
  };
}

export function InstallGo(version?: string): Step {
  return {
    name: "Install Go",
    uses: action.setupGo,
    with: {
      "go-version": version || "${{ env.GOVERSION }}",
      "cache-dependency-path": "**/*.sum",
    },
  };
}

export function InstallNodeJS(version?: string): Step {
  return {
    name: "Setup Node",
    uses: action.setupNode,
    with: {
      "node-version": version || "${{ env.NODEVERSION }}",
      "registry-url": "https://registry.npmjs.org",
    },
  };
}

export function InstallDotNet(version?: string): Step {
  return {
    name: "Setup DotNet",
    uses: action.setupDotNet,
    with: {
      "dotnet-version": version || "${{ env.DOTNETVERSION }}",
    },
  };
}

export function InstallJava(version?: string): Step {
  return {
    name: "Setup Java",
    uses: action.setupJava,
    with: {
      "java-version": version || "${{ env.JAVAVERSION }}",
      distribution: "temurin",
      cache: "gradle",
    },
  };
}

export function InstallGradle(version: string): Step {
  return {
    name: "Setup Gradle",
    uses: action.setupGradle,
    with: {
      "gradle-version": version,
    },
  };
}

export function InstallPython(version?: string): Step {
  return {
    name: "Setup Python",
    uses: action.setupPython,
    with: {
      "python-version": version || "${{ env.PYTHONVERSION }}",
    },
  };
}

export function InstallPlugins(): Step {
  return {
    name: "Install plugins",
    run: "make install_plugins",
  };
}

export function InstallPythonDeps(): Step {
  return {
    name: "Install Python deps",
    run: "pip3 install virtualenv==20.0.23\n" + "pip3 install pipenv",
  };
}

export function InstallSDKDeps(): Step {
  return {
    name: "Install dependencies",
    run: "make install_${{ matrix.language}}_sdk",
  };
}

export function InstallPulumiCtl(): Step {
  return {
    name: "Install pulumictl",
    uses: action.installGhRelease,
    with: {
      repo: "pulumi/pulumictl",
    },
  };
}

export function InstallSchemaChecker(provider: string): Step {
  if (provider === "command") {
    return {};
  }
  return {
    if: "github.event_name == 'pull_request'",
    name: "Install Schema Tools",
    uses: action.installGhRelease,
    with: {
      repo: "pulumi/schema-tools",
    },
  };
}

export function DispatchDocsBuildEvent(): Step {
  return {
    name: "Dispatch Event",
    run: "pulumictl create docs-build pulumi-${{ env.PROVIDER }} ${GITHUB_REF#refs/tags/}",
    env: {
      GITHUB_TOKEN: "${{ secrets.PULUMI_BOT_TOKEN }}",
    },
  };
}

export function InstallPulumiCli(version?: string, versionFile?: string): Step {
  if (version && versionFile) {
    throw new Error(
      'only one of "version" or "versionFile" can be provided, not both'
    );
  }
  let withBlock: { [key: string]: string } | undefined = undefined;
  if (version) {
    withBlock = { "pulumi-version": version };
  }
  if (versionFile) {
    withBlock = { "pulumi-version-file": versionFile };
  }
  return {
    name: "Install Pulumi CLI",
    uses: action.installPulumiCli,
    with: withBlock,
  };
}

export function RunDockerComposeStep(required?: boolean): Step {
  if (required) {
    return {
      name: "Run docker compose",
      run: "docker compose -f testing/docker-compose.yml up --build -d",
    };
  }
  return {};
}

export function RunSetUpScriptStep(setupScript?: string): Step {
  if (setupScript) {
    return {
      name: "Run setup script",
      run: `${setupScript}`,
    };
  }
  return {};
}

export function BuildCodegenBinaries(provider: string): Step {
  if (provider === "kubernetes") {
    return {};
  }
  return {
    name: "Build codegen binaries",
    run: "make codegen",
  };
}

export function BuildSDKs(provider: string): Step {
  if (provider === "command" || provider === "kubernetes") {
    return {};
  }
  return {
    name: "Build SDK",
    run: "make build_${{ matrix.language }}",
  };
}

export function UploadProviderBinaries(): Step {
  return {
    name: "Upload artifacts",
    uses: action.uploadArtifact,
    with: {
      name: "pulumi-${{ env.PROVIDER }}-provider.tar.gz",
      path: "${{ github.workspace }}/bin/provider.tar.gz",
    },
  };
}

export function UploadSDKs(tag: boolean): Step {
  if (tag === false) {
    return {
      name: "Upload artifacts",
      uses: action.uploadArtifact,
      with: {
        name: "${{ matrix.language  }}-sdk.tar.gz",
        path: "${{ github.workspace}}/sdk/${{ matrix.language }}.tar.gz",
        "retention-days": 30,
      },
    };
  }
  return {
    name: "Upload artifacts",
    uses: action.uploadArtifact,
    with: {
      name: "${{ matrix.language  }}-sdk.tar.gz",
      path: "${{ github.workspace}}/sdk/${{ matrix.language }}.tar.gz",
    },
  };
}

export function DownloadProviderBinaries(provider: string, job: string): Step {
  if (provider === "azure-native" && job === "build_sdks") {
    return {
      name: "Download provider + tfgen binaries",
      if: "${{ matrix.language != 'dotnet' }}",
      uses: action.downloadArtifact,
      with: {
        name: "pulumi-${{ env.PROVIDER }}-provider.tar.gz",
        path: "${{ github.workspace }}/bin",
      },
    };
  }
  return {
    name: "Download provider + tfgen binaries",
    uses: action.downloadArtifact,
    with: {
      name: "pulumi-${{ env.PROVIDER }}-provider.tar.gz",
      path: "${{ github.workspace }}/bin",
    },
  };
}

export function DownloadSDKs(): Step {
  return {
    name: "Download SDK",
    uses: action.downloadArtifact,
    with: {
      name: "${{ matrix.language }}-sdk.tar.gz",
      path: "${{ github.workspace}}/sdk/",
    },
  };
}

export function UnzipSDKs(): Step {
  return {
    name: "UnTar SDK folder",
    run: "tar -zxf ${{ github.workspace}}/sdk/${{ matrix.language}}.tar.gz -C ${{ github.workspace}}/sdk/${{ matrix.language}}",
  };
}

export function ZipSDKsStep(): Step {
  return {
    name: "Tar SDK folder",
    run: "tar -zcf sdk/${{ matrix.language }}.tar.gz -C sdk/${{ matrix.language }} .",
  };
}

export function CheckCleanWorkTree(): Step {
  return {
    name: "Check worktree clean",
    uses: action.gitStatusCheck,
    with: {
      "allowed-changes": `\
sdk/**/pulumi-plugin.json
sdk/dotnet/Pulumi.*.csproj
sdk/go/**/pulumiUtilities.go
sdk/nodejs/package.json
sdk/python/pyproject.toml`,
    },
  };
}

export function SetNugetSource(): Step {
  return {
    run: "dotnet nuget add source ${{ github.workspace }}/nuget",
  };
}

export function RunTests(provider: string, name: string): Step {
  if (provider === "kubernetes") {
    const shortMode = name === "run-acceptance-tests" ? " -short" : "";
    const testCmd = `cd tests/sdk/\${{ matrix.language }} && go test -v -count=1 -cover -timeout 2h -parallel 4${shortMode} ./...`;
    return {
      name: "Run tests",
      run: testCmd,
    };
  }
  return {
    name: "Run tests",
    run:
      "set -euo pipefail\n" +
      "cd examples && go test -count=1 -cover -timeout 2h -tags=${{ matrix.language }} -parallel 4 .",
  };
}

export function CommitEmptySDK(): Step {
  return {
    name: "Commit Empty SDK",
    run:
      "git add . \n" +
      'git commit -m "Preparing the SDK folder for regeneration"',
  };
}

export function PullRequestSdkGeneration(
  provider: string,
  branch: string
): Step {
  let dir;
  if (provider === "azure-native") {
    dir = "azure-rest-api-specs";
  }
  if (provider === "aws-native") {
    dir = "aws-cloudformation-user-guide";
  }
  const result = {
    name: "Create PR",
    id: "create-pr",
    uses: action.pullRequest,
    with: {
      destination_branch: branch,
      github_token: "${{ secrets.PULUMI_BOT_TOKEN }}",
      pr_body: "*Automated PR*",
      pr_title: `Automated SDK generation @ ${dir} \${{ steps.vars.outputs.commit-hash }}`,
      author_name: "pulumi-bot",
      source_branch:
        "generate-sdk/${{ github.run_id }}-${{ github.run_number }}",
    },
  };
  if (provider === "google-native") {
    result.with.pr_title = "Automated SDK generation";
  }
  return result;
}

export function CheckSchemaChanges(provider: string): Step {
  if (provider === "command") {
    return {};
  }
  return {
    if: "github.event_name == 'pull_request'",
    name: "Check Schema is Valid",
    run:
      "echo 'SCHEMA_CHANGES<<EOF' >> $GITHUB_ENV\n" +
      "schema-tools compare -p ${{ env.PROVIDER }} -o ${{ github.event.repository.default_branch }} -n --local-path=provider/cmd/pulumi-resource-${{ env.PROVIDER }}/schema.json >> $GITHUB_ENV\n" +
      "echo 'EOF' >> $GITHUB_ENV",
    env: {
      GITHUB_TOKEN: "${{ secrets.PULUMI_BOT_TOKEN }}",
    },
  };
}

export function LabelIfNoBreakingChanges(provider: string): Step {
  if (provider === "command") {
    return {};
  }
  return {
    if: "contains(env.SCHEMA_CHANGES, 'Looking good! No breaking changes found.') && github.actor == 'pulumi-bot'",
    name: "Add label if no breaking changes",
    uses: action.addLabel,
    with: {
      labels: "impact/no-changelog-required",
      number: "${{ github.event.issue.number }}",
      github_token: "${{ secrets.GITHUB_TOKEN }}",
    },
  };
}

export function CommentSchemaChangesOnPR(provider: string): Step {
  if (provider === "command") {
    return {};
  }
  return {
    if: "github.event_name == 'pull_request'",
    name: "Comment on PR with Details of Schema Check",
    uses: action.prComment,
    with: {
      message: "${{ env.SCHEMA_CHANGES }}\n",
      comment_tag: "schemaCheck",
      GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
    },
  };
}

export function SchemaFileChanged(provider: string): Step {
  if (provider === "command") {
    return {};
  }
  return {
    name: "Check for diff in schema",
    uses: action.pathsFilter,
    id: "schema_changed",
    with: {
      filters: "changed: 'provider/cmd/**/schema.json'",
    },
  };
}

export function SetupGotestfmt(): Step {
  return {
    name: "Install gotestfmt",
    uses: "GoTestTools/gotestfmt-action@v2",
    with: {
      version: "v2.5.0",
      token: "${{ secrets.GITHUB_TOKEN }}",
    },
  };
}

export function SdkFilesChanged(): Step {
  return {
    name: "Check for diff in sdk/*",
    id: "sdk_changed",
    if: "steps.schema_changed.outputs.changed == 'false'",
    uses: action.pathsFilter,
    with: {
      filters: `changed: 'sdk/*'`,
    },
  };
}

export function InitializeSubModules(submodules?: boolean): Step {
  if (submodules) {
    return {
      name: "Initialize submodules",
      run: "make init_submodules",
    };
  }
  return {};
}

export function BuildSchema(provider: string): Step {
  if (provider === "command") {
    return {};
  }
  if (provider === "kubernetes") {
    return {
      name: "Prepare Schema",
      run: "make schema",
    };
  }
  return {
    name: "Build Schema",
    run: "make generate_schema",
  };
}

export function BuildProvider(provider: string): Step {
  if (provider === "kubernetes") {
    return {};
  }
  return {
    name: "Build Provider",
    run: "make provider",
  };
}

export function TestProviderLibrary(): Step {
  return {
    name: "Test Provider Library",
    run: "make test_provider",
  };
}

export function RestoreBinaryPerms(provider: string, job: string): Step {
  if (provider === "azure-native" && job === "build_sdks") {
    return {
      name: "Restore Binary Permissions",
      if: "${{ matrix.language != 'dotnet' }}",
      run: 'find ${{ github.workspace }} -name "pulumi-*-${{ env.PROVIDER }}" -print -exec chmod +x {} \\;',
    };
  }
  return {
    name: "Restore Binary Permissions",
    run: 'find ${{ github.workspace }} -name "pulumi-*-${{ env.PROVIDER }}" -print -exec chmod +x {} \\;',
  };
}

export function GenerateSDKs(provider: string): Step {
  if (provider === "command" || provider === "kubernetes") {
    return {
      name: "Generate SDK",
      run: "make ${{ matrix.language }}_sdk",
    };
  }
  return {
    name: "Generate SDK",
    run: "make generate_${{ matrix.language }}",
  };
}

export function UpdatePath(): Step {
  return {
    name: "Update path",
    run: 'echo "${{ github.workspace }}/bin" >> $GITHUB_PATH',
  };
}

export function InstallNodeDeps(): Step {
  return {
    name: "Install Node dependencies",
    run: "yarn global add typescript",
  };
}

export function InstallKubectl(provider: string): Step {
  if (provider === "kubernetes") {
    return {
      name: "Install Kubectl",
      run:
        "curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable-1.28.txt)/bin/linux/amd64/kubectl\n" +
        "chmod +x ./kubectl\n" +
        "sudo mv kubectl /usr/local/bin\n",
    };
  }
  return {};
}

export function LoginGoogleCloudRegistry(provider: string): Step {
  if (provider === "kubernetes") {
    return {
      name: "Login to Google Cloud Registry",
      run: "gcloud --quiet auth configure-docker",
    };
  }
  return {};
}

export function SetStackName(provider: string): Step {
  if (provider === "kubernetes") {
    return {
      name: "Set stack name in output",
      id: "stackname",
      run: "echo 'stack-name=${{ env.PULUMI_TEST_OWNER }}/${{ github.sha }}-${{ github.run_id }}-${{ github.run_attempt }}' >> \"$GITHUB_OUTPUT\"",
    };
  }
  return {};
}

export function CreateTestCluster(provider: string): Step {
  if (provider === "kubernetes") {
    return {
      name: "Create test infrastructure",
      run: "./scripts/ci-cluster-create.sh ${{ steps.stackname.outputs.stack-name }}",
    };
  }
  return {};
}

export function UploadKubernetesArtifacts(provider: string): Step {
  if (provider === "kubernetes") {
    return {
      name: "Upload Kubernetes Artifacts",
      uses: action.uploadArtifact,
      with: {
        name: "config",
        path: "~/.kube/config",
      },
    };
  }
  return {};
}

export function DestroyTestCluster(provider: string): Step {
  if (provider === "kubernetes") {
    return {
      name: "Destroy test infra",
      run: "./scripts/ci-cluster-destroy.sh ${{ needs.build-test-cluster.outputs.stack-name }}",
    };
  }
  return {};
}

export function DeleteArtifact(provider: string): Step {
  if (provider === "kubernetes") {
    return {
      uses: action.deleteArtifact,
      with: {
        name: "config",
      },
    };
  }
  return {};
}

export function BuildK8sgen(provider: string): Step {
  if (provider === "kubernetes") {
    return {
      name: "Build K8sgen",
      run: "make k8sgen",
    };
  }
  return {};
}

export function PrepareOpenAPIFile(provider: string): Step {
  if (provider === "kubernetes") {
    return {
      name: "Prepare OpenAPI file",
      run: "make openapi_file",
    };
  }
  return {};
}

export function MakeKubernetesProvider(provider: string): Step {
  if (provider === "kubernetes") {
    return {
      name: "Make Kubernetes provider",
      run: "make k8sprovider",
    };
  }
  return {};
}

export function TarProviderBinaries(hasGenBinary: boolean): Step {
  return {
    name: "Tar provider binaries",
    run:
      "tar -zcf ${{ github.workspace }}/bin/provider.tar.gz -C ${{ github.workspace}}/bin/ pulumi-resource-${{ env.PROVIDER }}" +
      (hasGenBinary ? " pulumi-gen-${{ env.PROVIDER}}" : ""),
  };
}

export function UnTarProviderBinaries(provider: string, job: string): Step {
  if (provider === "azure-native" && job === "build_sdks") {
    return {
      name: "UnTar provider binaries",
      if: "${{ matrix.language != 'dotnet' }}",
      run: "tar -zxf ${{ github.workspace }}/bin/provider.tar.gz -C ${{ github.workspace}}/bin",
    };
  }
  return {
    name: "UnTar provider binaries",
    run: "tar -zxf ${{ github.workspace }}/bin/provider.tar.gz -C ${{ github.workspace}}/bin",
  };
}

export function MakeKubeDir(provider: string, name: string): Step {
  if (provider === "kubernetes" && name !== "run-acceptance-tests") {
    return {
      name: "Make Kube Directory",
      run: 'mkdir -p "~/.kube/"',
    };
  }
  return {};
}

export function DownloadKubeconfig(provider: string, name: string): Step {
  if (provider === "kubernetes" && name !== "run-acceptance-tests") {
    return {
      name: "Download Kubeconfig",
      uses: action.downloadArtifact,
      with: {
        name: "config",
        path: "~/.kube/",
      },
    };
  }
  return {};
}

export function InstallandConfigureHelm(provider: string): Step {
  if (provider === "kubernetes") {
    return {
      name: "Install and configure Helm",
      run:
        "curl -LO  https://get.helm.sh/helm-v3.8.0-linux-amd64.tar.gz\n" +
        "tar -xvf helm-v3.8.0-linux-amd64.tar.gz\n" +
        "sudo mv linux-amd64/helm /usr/local/bin\n" +
        "helm repo add stable https://charts.helm.sh/stable\n" +
        "helm repo update\n",
    };
  }
  return {};
}

export function GolangciLint(): Step {
  return {
    name: "golangci-lint provider pkg",
    uses: action.goLint,
    with: {
      version: "${{ env.GOLANGCI_LINT_VERSION }}",
      args: "-c ../.golangci.yml",
      "working-directory": "provider",
    },
  };
}

export function CodegenDuringSDKBuild(provider: string) {
  if (provider === "azure-native") {
    return {
      name: "Build Codegen",
      if: "${{ matrix.language == 'dotnet' }}",
      run: "make codegen",
    };
  }
  return {};
}

export function UpdatePulumi(): Step {
  return {
    name: "Update Pulumi/Pulumi",
    id: "gomod",
    run:
      "git config --local user.email 'bot@pulumi.com'\n" +
      "git config --local user.name 'pulumi-bot'\n" +
      "git checkout -b update-pulumi/${{ github.run_id }}-${{ github.run_number }}\n" +
      "for MODFILE in $(find . -name go.mod); do pushd $(dirname $MODFILE); go get github.com/pulumi/pulumi/pkg/v3 github.com/pulumi/pulumi/sdk/v3; go mod tidy; popd; done\n" +
      // Fetch latest release version of Pulumi, remove the leading 'v' and store it to the `.pulumi.version` file.
      "gh repo view pulumi/pulumi --json latestRelease --jq .latestRelease.tagName | sed 's/^v//' > .pulumi.version\n" +
      "git update-index -q --refresh\n" +
      'if ! git diff-files --quiet; then echo changes=1 >> "$GITHUB_OUTPUT"; fi',
  };
}

export function ProviderWithPulumiUpgrade(provider: string): Step {
  let buildProvider = "make codegen && make local_generate\n";
  if (provider === "command" || provider === "kubernetes") {
    buildProvider = "make build\n";
  }
  return {
    name: "Provider with Pulumi Upgrade",
    if: "steps.gomod.outputs.changes != 0",
    run:
      buildProvider +
      "git add sdk/nodejs\n" +
      'git commit -m "Regenerating Node.js SDK based on updated modules" || echo "ignore commit failure, may be empty"\n' +
      "git add sdk/python\n" +
      'git commit -m "Regenerating Python SDK based on updated modules" || echo "ignore commit failure, may be empty"\n' +
      "git add sdk/dotnet\n" +
      'git commit -m "Regenerating .NET SDK based on updated modules" || echo "ignore commit failure, may be empty"\n' +
      "git add sdk/go*\n" +
      'git commit -m "Regenerating Go SDK based on updated modules" || echo "ignore commit failure, may be empty"\n' +
      "git add sdk/java*\n" +
      'git commit -m "Regenerating Java SDK based on updated modules" || echo "ignore commit failure, may be empty"\n' +
      "git add .\n" +
      'git commit -m "Updated modules" || echo "ignore commit failure, may be empty"\n' +
      "git push origin update-pulumi/${{ github.run_id }}-${{ github.run_number }}",
  };
}

export function CreateUpdatePulumiPR(branch: string): Step {
  return {
    name: "Create PR",
    id: "create-pr",
    if: "steps.gomod.outputs.changes != 0",
    run:
      "ver=$(cat .pulumi.version)" +
      "\n" +
      'msg="Automated upgrade: bump pulumi/pulumi to ${ver}"' +
      "\n" +
      'gh pr create -t "$msg" -b "$msg" -B ' +
      branch +
      "\n",
    env: {
      GITHUB_TOKEN: "${{ secrets.PULUMI_BOT_TOKEN }}",
    },
  };
}

export function SetPRAutoMerge(provider?: string): Step {
  if (provider === "kubernetes") {
    // Temporarily disabled until https://github.com/pulumi/pulumi-kubernetes/issues/2169 is fixed.
    return {};
  }
  return {
    name: "Set AutoMerge",
    if: "steps.create-pr.outputs.has_changed_files",
    uses: action.autoMerge,
    with: {
      token: "${{ secrets.PULUMI_BOT_TOKEN }}",
      "pull-request-number": "${{ steps.create-pr.outputs.pr_number }}",
      repository: "${{ github.repository }}",
      "merge-method": "squash",
    },
  };
}

export function RunGoReleaserWithArgs(args?: string): Step {
  return {
    name: "Run GoReleaser",
    uses: action.goReleaser,
    env: {
      GORELEASER_CURRENT_TAG: "v${{ steps.version.outputs.version }}",
    },
    with: {
      args: `${args}`,
      version: "latest",
    },
  };
}

export function PublishGoSdk(sdkModuleDir: string): Step {
  return {
    name: "Publish Go SDK",
    uses: "pulumi/publish-go-sdk-action@v1",
    with: {
      repository: "${{ github.repository }}",
      "base-ref": "${{ github.sha }}",
      source: sdkModuleDir,
      path: sdkModuleDir,
      version: "${{ steps.version.outputs.version }}",
      additive: false,
      // TODO(https://github.com/pulumi/pulumi/issues/5403): go.mod should be scoped to only the Go SDK.
      files:
        sdkModuleDir == "sdk"
          ? `\
go.*
go/**
!*.tar.gz`
          : "**",
    },
  };
}

export function NotifySlack(name: string): Step {
  return {
    if: "failure() && github.event_name == 'push'",
    name: "Notify Slack",
    uses: action.notifySlack,
    with: {
      author_name: `${name}`,
      fields: "repo,commit,author,action",
      status: "${{ job.status }}",
    },
  };
}

export function DownloadSpecificSDKStep(name: string): Step {
  return {
    name: `Download ${name} SDK`,
    uses: action.downloadArtifact,
    with: {
      name: `${name}-sdk.tar.gz`,
      path: "${{ github.workspace}}/sdk/",
    },
  };
}

export function UnzipSpecificSDKStep(name: string): Step {
  return {
    name: `Uncompress ${name} SDK`,
    run: `tar -zxf \${{github.workspace}}/sdk/${name}.tar.gz -C \${{github.workspace}}/sdk/${name}`,
  };
}

export function InstallTwine(): Step {
  return {
    name: "Install Twine",
    run: "python -m pip install twine==5.0.0",
  };
}

export function RunPublishSDK(): Step {
  return {
    name: "Publish SDKs",
    run: "./ci-scripts/ci/publish-tfgen-package ${{ github.workspace }}",
    env: {
      NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}",
      // See https://github.com/pulumi/scripts/pull/138/files
      // Possible values: "all", "wheel".
      PYPI_PUBLISH_ARTIFACTS: "all",
    },
  };
}

export function RunPublishJavaSDK(): Step {
  return {
    name: "Publish Java SDK",
    uses: action.gradleBuildAction,
    env: {
      PACKAGE_VERSION: "${{ env.PROVIDER_VERSION }}",
    },
    with: {
      arguments: "publishToSonatype closeAndReleaseSonatypeStagingRepository",
      "build-root-directory": "./sdk/java",
      "gradle-version": "7.4.1",
    },
  };
}

export function Porcelain(): Step {
  return {
    run: "git status --porcelain",
  };
}

export function ChocolateyPackageDeployment(): Step {
  return {
    name: "Chocolatey Package Deployment",
    env: {
      CURRENT_TAG: "${{ env.PROVIDER_VERSION }}",
    },
    run: "pulumictl create choco-deploy -a cf2pulumi ${CURRENT_TAG}",
  };
}

export function AzureLogin(provider: string): Step {
  if (provider === "azure-native") {
    return {
      uses: action.azureLogin,
      with: {
        creds: "${{ secrets.AZURE_RBAC_SERVICE_PRINCIPAL }}",
      },
    };
  }
  return {};
}

export function AwsCredentialsForArmCoverageReport(): Step {
  return {
    name: "Configure AWS Credentials",
    uses: action.configureAwsCredentials,
    with: {
      "aws-access-key-id": "${{ secrets.AWS_ACCESS_KEY_ID }}",
      "aws-region": "us-west-2",
      "aws-secret-access-key": "${{ secrets.AWS_SECRET_ACCESS_KEY }}",
      "role-duration-seconds": 3600,
      "role-session-name": "arm2pulumiCvg@githubActions",
      "role-to-assume": "${{ secrets.AWS_CI_ROLE_ARN }}",
    },
  };
}

export function MakeClean(): Step {
  return {
    name: "Cleanup SDK Folder",
    run: "make clean",
  };
}

export function MakeLocalGenerate(): Step {
  return {
    name: "Build Schema + SDKs",
    run: "make local_generate",
  };
}

export function GenerateCoverageReport(): Step {
  return {
    name: "Generate coverage report",
    run: "make arm2pulumi_coverage_report",
  };
}

export function TestResultsJSON(): Step {
  return {
    name: "Test usage of results.json",
    run: "cat provider/pkg/arm2pulumi/internal/test/results.json",
  };
}

export function UploadArmCoverageToS3(): Step {
  return {
    name: "Upload results to S3",
    run: "cd provider/pkg/arm2pulumi/internal/test && bash s3-upload-script.sh",
  };
}

export function PrepareGitBranchForSdkGeneration(): Step {
  return {
    name: "Preparing Git Branch",
    run:
      'git config --local user.email "bot@pulumi.com"\n' +
      'git config --local user.name "pulumi-bot"\n' +
      "git checkout -b generate-sdk/${{ github.run_id }}-${{ github.run_number }}\n",
  };
}

export function UpdateSubmodules(provider: string): Step {
  if (provider !== "azure-native") {
    return {};
  }
  return {
    name: "Update Submodules",
    run: "make update_submodules",
  };
}

export function MakeDiscovery(provider: string): Step {
  if (provider === "aws-native") {
    return {
      name: "Discovery",
      run: "make discovery",
    };
  }
  if (provider === "google-native") {
    return {
      name: "Discovery",
      id: "discovery",
      run: "make discovery\n" + "git update-index -q --refresh",
    };
  }
  return {};
}

export function Codecov(): Step {
  return {
    name: "Upload coverage reports to Codecov",
    uses: action.codecov,
    env: {
      CODECOV_TOKEN: "${{ secrets.CODECOV_TOKEN }}",
    },
  };
}

export function FreeDiskSpace(runner: string): Step {
  if (!runner.includes("ubuntu")) {
    // This step is only relevant for the Ubuntu runner.
    return {};
  }

  return {
    name: "Clear GitHub Actions Ubuntu runner disk space",
    uses: action.freeDiskSpace,
    with: {
      "tool-cache": false,
      dotnet: false,
      android: true,
      haskell: true,
      "swap-storage": true,
      "large-packages": false,
    },
  };
}

export function CreateKindCluster(provider: string, name: string): Step {
  if (provider === "kubernetes" && name === "run-acceptance-tests") {
    return {
      name: "Setup KinD cluster",
      uses: action.createKindCluster,
      with: {
        cluster_name: "kind-integration-tests-${{ matrix.language }}",
        node_image: "kindest/node:v1.29.2",
      },
    };
  }

  return {};
}

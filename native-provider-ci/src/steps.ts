import { stripVTControlCharacters } from "util";
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
    run: "echo ::set-output name=run-url::https://github.com/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID",
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

export function CheckoutScriptsRepoStep(): Step {
  return {
    name: "Checkout Scripts Repo",
    uses: action.checkout,
    with: {
      path: "ci-scripts",
      repository: "pulumi/scripts",
    },
  };
}

export function CheckoutTagsStep(): Step {
  return {
    name: "Unshallow clone for tags",
    run: "git fetch --prune --unshallow --tags",
  };
}

export function ConfigureGcpCredentials(requiresGcp?: boolean): Step {
  if (requiresGcp) {
    return {
      name: "Configure GCP credentials",
      uses: action.setupGcloud,
      with: {
        project_id: "${{ env.GOOGLE_PROJECT }}",
        service_account_email: "${{ secrets.GCP_SA_EMAIL }}",
        service_account_key: "${{ secrets.GCP_SA_KEY }}",
        export_default_credentials: true,
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

export function ConfigureAwsCredentialsForCoverageDataUpload(): Step {
  return {
    name: "Configure AWS Credentials",
    uses: action.configureAwsCredentials,
    with: {
      "aws-access-key-id": "${{ secrets.AWS_CORP_S3_UPLOAD_ACCESS_KEY_ID }}",
      "aws-region": "us-west-2",
      "aws-secret-access-key":
        "${{ secrets.AWS_CORP_S3_UPLOAD_SECRET_ACCESS_KEY }}",
    },
  };
}

export function InstallGo(version?: string): Step {
  return {
    name: "Install Go",
    uses: action.setupGo,
    with: {
      "go-version": version || "${{matrix.goversion}}",
    },
  };
}

export function InstallNodeJS(version?: string): Step {
  return {
    name: "Setup Node",
    uses: action.setupNode,
    with: {
      "node-version": version || "${{matrix.nodeversion}}",
      "registry-url": "https://registry.npmjs.org",
    },
  };
}

export function InstallDotNet(version?: string): Step {
  return {
    name: "Setup DotNet",
    uses: action.setupDotNet,
    with: {
      "dotnet-version": version || "${{matrix.dotnetversion}}",
    },
  };
}

export function InstallPython(version?: string): Step {
  return {
    name: "Setup Python",
    uses: action.setupPython,
    with: {
      "python-version": version || "${{matrix.pythonversion}}",
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
      repo: "mikhailshilkov/schema-tools",
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

export function InstallPulumiCli(): Step {
  return {
    name: "Install Pulumi CLI",
    uses: action.installPulumiCli,
  };
}

export function RunDockerComposeStep(required?: boolean): Step {
  if (required) {
    return {
      name: "Run docker-compose",
      run: "docker-compose -f testing/docker-compose.yml up --build -d",
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
  if (provider == "kubernetes") {
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

export function UploadSDKs(): Step {
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
    run: "./ci-scripts/ci/check-worktree-is-clean",
  };
}

export function SetNugetSource(): Step {
  return {
    run: "dotnet nuget add source ${{ github.workspace }}/nuget",
  };
}

export function RunTests(provider: string): Step {
  if (provider === "kubernetes") {
    return {
      name: "Run tests",
      run:
        "set -euo pipefail\n" +
        "cd tests/sdk/${{ matrix.language }} && go test -v -json -count=1 -cover -timeout 2h -parallel 4 ./... 2>&1 | tee /tmp/gotest.log | gotestfmt",
    };
  }
  return {
    name: "Run tests",
    run:
      "set -euo pipefail\n" +
      "cd examples && go test -v -json -count=1 -cover -timeout 2h -tags=${{ matrix.language }} -parallel 4 . 2>&1 | tee /tmp/gotest.log | gotestfmt",
  };
}

export function CommitChanges(refName: string): Step {
  return {
    name: "commit changes",
    uses: action.addAndCommit,
    with: {
      author_email: "bot@pulumi.com",
      author_name: "pulumi-bot",
      ref: `${refName}`,
    },
  };
}

export function PullRequest(
  refName: string,
  prTitle: string,
  user: string
): Step {
  return {
    name: "pull-request",
    uses: action.pullRequest,
    with: {
      destination_branch: "master",
      github_token: "${{ secrets.PULUMI_BOT_TOKEN }}",
      pr_allow_empty: "true",
      pr_assignee: `${user}`,
      pr_body: "*Automated PR*",
      pr_reviewer: `${user}`,
      pr_title: `${prTitle}`,
      author_name: "pulumi-bot",
      source_branch: `${refName}`,
    },
    env: {
      GITHUB_TOKEN: "${{ secrets.PULUMI_BOT_TOKEN }}",
    },
  };
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
      "schema-tools compare ${{ env.PROVIDER }} master --local-path=provider/cmd/pulumi-resource-${{ env.PROVIDER }}/schema.json >> $GITHUB_ENV\n" +
      "echo 'EOF' >> $GITHUB_ENV",
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
      message:
        "### Does the PR have any schema changes?\n\n" +
        "${{ env.SCHEMA_CHANGES }}\n",
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
    uses: action.installGhRelease,
    with: {
      repo: "haveyoudebuggedit/gotestfmt",
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
  if (provider == "kubernetes") {
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
        "curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl\n" +
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
      run: "echo '::set-output name=stack-name::${{ secrets.PULUMI_TEST_OWNER }}/${{ github.sha }}-$(date +%s)'",
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

export function TarProviderBinaries(): Step {
  return {
    name: "Tar provider binaries",
    run: "tar -zcf ${{ github.workspace }}/bin/provider.tar.gz -C ${{ github.workspace}}/bin/ pulumi-resource-${{ env.PROVIDER }} pulumi-gen-${{ env.PROVIDER}}",
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

export function MakeKubeDir(provider: string): Step {
  if (provider === "kubernetes") {
    return {
      name: "Make Kube Directory",
      run: 'mkdir -p "~/.kube/"',
    };
  }
  return {};
}

export function DownloadKubeconfig(provider: string): Step {
  if (provider === "kubernetes") {
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
      args: "-c ../../.golangci.yml --timeout ${{ env.GOLANGCI_LINT_TIMEOUT }}",
      "working-directory": "provider/pkg",
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

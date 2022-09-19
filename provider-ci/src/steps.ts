import * as action from "./action-versions";
import { NormalJob } from "./github-workflow";

export type Step = Required<NormalJob>["steps"][0];

export function CheckoutRepoStep(): Step {
  return {
    name: "Checkout Repo",
    uses: action.checkout,
  };
}

export function CheckoutRepoStepAtPR(): Step {
  return {
    name: "Checkout Repo",
    uses: action.checkout,
    with: {
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

export function InstallJava(version?: string): Step {
  return {
    name: "Setup Java",
    uses: action.setupJava,
    with: {
      "java-version": version || "${{matrix.javaversion}}",
      distribution: "temurin",
      cache: "gradle",
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

export function InstallSchemaChecker(): Step {
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

export function InstallPulumiCli(version?: string): Step {
  const step: Step = {
    name: "Install Pulumi CLI",
    uses: action.installPulumiCli,
  };
  if (version) {
    step.with = {
      "pulumi-version": version,
    }
  }
  return step;
}

export function PrintPulumiCliVersion(): Step {
  return {
    name: "Print CLI version",
    run: 'echo "Currently Pulumi $(pulumi version) is installed"',
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

export function BuildBinariesStep(): Step {
  return {
    name: "Build tfgen & provider binaries",
    run: "make provider",
  };
}

export function BuildSdksStep(): Step {
  return {
    name: "Build SDK",
    run: "make build_${{ matrix.language }}",
  };
}

export function UploadProviderBinariesStep(): Step {
  return {
    name: "Upload artifacts",
    uses: action.uploadArtifact,
    with: {
      name: "${{ env.PROVIDER }}-provider.tar.gz",
      path: "${{ github.workspace }}/bin/provider.tar.gz",
    },
  };
}

export function UploadSdkStep(): Step {
  return {
    name: "Upload artifacts",
    uses: action.uploadArtifact,
    with: {
      name: "${{ matrix.language  }}-sdk.tar.gz",
      path: "${{ github.workspace}}/sdk/${{ matrix.language }}.tar.gz",
    },
  };
}

export function DownloadProviderStep(): Step {
  return {
    name: "Download provider + tfgen binaries",
    uses: action.downloadArtifact,
    with: {
      name: "${{ env.PROVIDER }}-provider.tar.gz",
      path: "${{ github.workspace }}/bin",
    },
  };
}

export function DownloadSDKsStep(): Step {
  return {
    name: "Download SDK",
    uses: action.downloadArtifact,
    with: {
      name: "${{ matrix.language }}-sdk.tar.gz",
      path: "${{ github.workspace}}/sdk/",
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

export function UnzipProviderBinariesStep(): Step {
  return {
    name: "Untar provider binaries",
    run:
      "tar -zxf ${{ github.workspace }}/bin/provider.tar.gz -C ${{ github.workspace}}/bin\n" +
      'find ${{ github.workspace }} -name "pulumi-*-${{ env.PROVIDER }}" -print -exec chmod +x {} \\;',
  };
}

export function UnzipSDKsStep(): Step {
  return {
    name: "Uncompress SDK folder",
    run: "tar -zxf ${{ github.workspace }}/sdk/${{ matrix.language }}.tar.gz -C ${{ github.workspace }}/sdk/${{ matrix.language }}",
  };
}

export function UnzipSpecificSDKStep(name: string): Step {
  return {
    name: `Uncompress ${name} SDK`,
    run: `tar -zxf \${{github.workspace}}/sdk/${name}.tar.gz -C \${{github.workspace}}/sdk/${name}`,
  };
}

export function ZipProviderBinariesStep(): Step {
  return {
    name: "Tar provider binaries",
    run: "tar -zcf ${{ github.workspace }}/bin/provider.tar.gz -C ${{ github.workspace }}/bin/ pulumi-resource-${{ env.PROVIDER }} pulumi-tfgen-${{ env.PROVIDER }}",
  };
}

export function ZipSDKsStep(): Step {
  return {
    name: "Compress SDK folder",
    run: "tar -zcf sdk/${{ matrix.language }}.tar.gz -C sdk/${{ matrix.language }} .",
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

export function CheckCleanWorkTreeStep(): Step {
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

export function SetProvidersToPATH(): Step {
  return {
    name: "Update path",
    run: 'echo "${{ github.workspace }}/bin" >> $GITHUB_PATH',
  };
}

export function SetPackageVersionToEnv(): Step {
  return {
    // This is required for the Java Provider Build + Publish Steps
    name: "Set PACKAGE_VERSION to Env",
    run: 'echo "PACKAGE_VERSION=$(pulumictl get version --language generic)" >> $GITHUB_ENV',
  };
}

export function RunTests(): Step {
  return {
    name: "Run tests",
    run: "cd examples && go test -v -json -count=1 -cover -timeout 2h -tags=${{ matrix.language }} -parallel 4 . 2>&1 | tee /tmp/gotest.log | gotestfmt",
  };
}

export function SetPreReleaseVersion(): Step {
  return {
    name: "Set PreRelease Version",
    run: 'echo "GORELEASER_CURRENT_TAG=v$(pulumictl get version --language generic)" >> $GITHUB_ENV',
  };
}

export function RunGoReleaserWithArgs(args?: string): Step {
  return {
    name: "Run GoReleaser",
    uses: action.goReleaser,
    with: {
      args: `${args}`,
      version: "latest",
    },
  };
}

export function RunCommand(command: string): Step {
  return {
    run: `${command}`,
  };
}

export function RunPublishSDK(): Step {
  return {
    name: "Publish SDKs",
    run: "./ci-scripts/ci/publish-tfgen-package ${{ github.workspace }}",
    env: {
      NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}",
    },
  };
}

export function RunPublishJavaSDK(): Step {
  return {
    name: "Publish Java SDK",
    uses: action.gradleBuildAction,
    with: {
      arguments: "publishToSonatype closeAndReleaseSonatypeStagingRepository",
      "build-root-directory": "./sdk/java",
      "gradle-version": "7.4.1",
    },
  };
}

export function TagSDKTag(): Step {
  return {
    name: "Add SDK version tag",
    run: "git tag sdk/v$(pulumictl get version --language generic) && git push origin sdk/v$(pulumictl get version --language generic)",
  };
}

export function UpdatePulumiTerraformBridgeDependency(): Step {
  return {
    name: "Update Pulumi Terraform Bridge Dependency",
    run: "cd provider && go mod edit -require github.com/pulumi/pulumi-terraform-bridge/v3@${{ github.event.client_payload.ref }} && go mod tidy && cd ../",
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

export function CheckSchemaChanges(): Step {
  return {
    if: "github.event_name == 'pull_request'",
    name: "Check Schema is Valid",
    run:
      "echo 'SCHEMA_CHANGES<<EOF' >> $GITHUB_ENV\n" +
      "schema-tools compare ${{ env.PROVIDER }} master --local-path=provider/cmd/pulumi-resource-${{ env.PROVIDER }}/schema.json >> $GITHUB_ENV\n" +
      "echo 'EOF' >> $GITHUB_ENV",
  };
}

export function CommentSchemaChangesOnPR(): Step {
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

export function CreateCommentsUrlStep(): Step {
  return {
    name: "Create URL to the run output",
    id: "run-url",
    run: "echo ::set-output name=run-url::https://github.com/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID",
  };
}

export function EchoSuccessStep(): Step {
  return {
    name: "Is workflow a success",
    run: "echo yes",
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
      body: "Please view the PR build: ${{ steps.run-url.outputs.run-url }}",
    },
  };
}

export function CommentPRWithSlashCommandStep(command?: string): Step {
  const val = command ?? "/run-acceptance-tests";
  return {
    name: "Comment PR",
    uses: action.prComment,
    with: {
      message:
        "PR is now waiting for a maintainer to run the acceptance tests.\n" +
        `**Note for the maintainer:** To run the acceptance tests, please comment *${val}* on the PR\n`,
      GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
    },
  };
}

export function EchoCoverageOutputDirStep(): Step {
  return {
    name: "Echo Coverage Output Dir",
    run: 'echo "Coverage output directory: ${{ env.COVERAGE_OUTPUT_DIR }}"',
  };
}

export function GenerateCoverageDataStep(): Step {
  return {
    name: "Generate Coverage Data",
    run: "make tfgen",
  };
}

export function PrintCoverageDataStep(): Step {
  return {
    name: "Summarize Provider Coverage Results",
    run: "cat ${{ env.COVERAGE_OUTPUT_DIR }}/shortSummary.txt",
  };
}

export function UploadCoverageDataStep(): Step {
  return {
    name: "Upload coverage data to S3",
    run: `summaryName="\${PROVIDER}_summary_\`date +"%Y-%m-%d_%H-%M-%S"\`.json"
s3FullURI="s3://\${{ secrets.S3_COVERAGE_BUCKET_NAME }}/summaries/\${summaryName}"
aws s3 cp \${{ env.COVERAGE_OUTPUT_DIR }}/summary.json \${s3FullURI} --acl bucket-owner-full-control`,
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

export function SchemaFileChanged(): Step {
  return {
    name: "Check for diff in schema",
    uses: action.pathsFilter,
    id: "schema_changed",
    with: {
      filters: "changed: 'provider/cmd/**/schema.json'",
    },
  };
}

export function SdkFilesChanged(): Step {
  return {
    name: "Check for diff in sdk/**",
    id: "sdk_changed",
    if: "steps.schema_changed.outputs.changed == 'false'",
    uses: action.pathsFilter,
    with: {
      filters: `changed: 'sdk/**'`,
    },
  };
}

export function SendCodegenWarnCommentPr(): Step {
  return {
    name: "Send codegen warning as comment on PR",
    if: "steps.sdk_changed.outputs.changed == 'true' && github.event.pull_request.head.repo.full_name != github.repository",
    uses: action.prComment,
    with: {
      message:
        "Hello and thank you for your pull request! :heart: :sparkles:\n" +
        "It looks like you're directly modifying files in the language SDKs, many of which are autogenerated.\n" +
        "Be sure any files you're editing do not begin with a code generation warning.\n" +
        "For generated files, you will need to make changes in `resources.go` instead, and " +
        "[generate the code](https://github.com/pulumi/${{ github.event.repository.name }}/blob/master/CONTRIBUTING.md#committing-generated-code).\n",
      GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
    },
  };
}

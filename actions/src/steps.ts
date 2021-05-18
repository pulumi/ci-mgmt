import * as step from '@jaxxstorm/gh-actions/lib/step';
import * as action from "./action-versions";

export class CheckoutRepoStep extends step.Step {
    constructor() {
        super();
        return {
            name: "Checkout Repo",
            uses: action.checkout,
        }
    }
}

export class CheckoutScriptsRepoStep extends step.Step {
    constructor() {
        super();
        return {
            name: 'Checkout Scripts Repo',
            uses: action.checkout,
            with: {
                path: 'ci-scripts',
                repository: 'pulumi/scripts',
            },
        }
    }
}

export class CheckoutTagsStep extends step.Step {
    constructor() {
        super();
        return {
            name: 'Unshallow clone for tags',
            run: 'git fetch --prune --unshallow --tags',
        }
    }
}

export class ConfigureGcpCredentials extends step.Step {
    constructor(requiresGcp?: boolean) {
        super();
        if (requiresGcp) {
            return {
                name: 'Configure GCP credentials',
                uses: action.setupGcloud,
                with: {
                    'version': '285.0.0',
                    'project_id': '${{ env.GOOGLE_PROJECT }}',
                    'service_account_email': '${{ secrets.GCP_SA_EMAIL }}',
                    'service_account_key': '${{ secrets.GCP_SA_KEY }}',
                    'export_default_credentials': true,
                }
            }
        }
    }
}

export class ConfigureAwsCredentialsForTests extends step.Step {
    constructor(requiresAws?: boolean) {
        super();
        if (requiresAws) {
            return {
                name: 'Configure AWS Credentials',
                uses: action.configureAwsCredentials,
                with: {
                    'aws-access-key-id': '${{ secrets.AWS_ACCESS_KEY_ID }}',
                    'aws-region': '${{ env.AWS_REGION }}',
                    'aws-secret-access-key': '${{ secrets.AWS_SECRET_ACCESS_KEY }}',
                    'role-duration-seconds': 3600,
                    'role-session-name': '${{ env.PROVIDER }}@githubActions',
                    'role-to-assume': '${{ secrets.AWS_CI_ROLE_ARN }}'
                }
            }
        }
    }
}

export class ConfigureAwsCredentialsForPublish extends step.Step {
    constructor() {
        super();
        return {
            name: 'Configure AWS Credentials',
            uses: action.configureAwsCredentials,
            with: {
                'aws-access-key-id': '${{ secrets.AWS_ACCESS_KEY_ID }}',
                'aws-region': 'us-east-2',
                'aws-secret-access-key': '${{ secrets.AWS_SECRET_ACCESS_KEY }}',
                'role-duration-seconds': 3600,
                'role-session-name': '${{ env.PROVIDER }}@githubActions',
                'role-external-id': 'upload-pulumi-release',
                'role-to-assume': '${{ secrets.AWS_UPLOAD_ROLE_ARN }}'
            }
        }
    }
}

export class InstallGo extends step.Step {
    constructor(version?: string) {
        super();
        return {
            name: 'Install Go',
            uses: action.setupGo,
            with: {
                'go-version': version || '${{matrix.goversion}}',
            },
        }
    }
}

export class InstallNodeJS extends step.Step {
    constructor(version?: string) {
        super();
        return {
            name: 'Setup Node',
            uses: action.setupNode,
            with: {
                'node-version': version || '${{matrix.nodeversion}}',
                'registry-url': 'https://registry.npmjs.org',
            },
        }
    }
}

export class InstallDotNet extends step.Step {
    constructor(version?: string) {
        super();
        return {
            name: 'Setup DotNet',
            uses: action.setupDotNet,
            with: {
                'dotnet-version': version || '${{matrix.dotnetversion}}'
            },
        }
    }
}

export class InstallPython extends step.Step {
    constructor(version?: string) {
        super();
        return {
            name: 'Setup Python',
            uses: action.setupPython,
            with: {
                'python-version': version || '${{matrix.pythonversion}}'
            },
        }
    }
}

export class InstallPythonDeps extends step.Step {
    constructor() {
        super();
        return {
            name: 'Install Python deps',
            run: 'pip3 install virtualenv==20.0.23\n' +
                'pip3 install pipenv',
        }
    }
}

export class InstallSDKDeps extends step.Step {
    constructor() {
        super();
        return {
            name: 'Install dependencies',
            run: 'make install_${{ matrix.language}}_sdk',
        }
    }
}

export class InstallPulumiCtl extends step.Step {
    constructor() {
        super();
        return {
            name: 'Install pulumictl',
            uses: action.installPulumictl,
            with: {
                repo: 'pulumi/pulumictl',
            },
        }
    }
}

export class DispatchDocsBuildEvent extends step.Step {
    constructor() {
        super();
        return {
            name: "Dispatch Event",
            run: 'pulumictl create docs-build pulumi-${{ env.PROVIDER }} ${GITHUB_REF#refs/tags/}',
            env: {
                GITHUB_TOKEN: '${{ secrets.PULUMI_BOT_TOKEN }}'
            }
        }
    }

}

export class InstallPulumiCli extends step.Step {
    constructor() {
        super();
        return {
            name: 'Install Pulumi CLI',
            uses: action.installPulumiCli,
        }
    }
}

export class RunDockerComposeStep extends step.Step {
    constructor(required?: boolean) {
        super();
        if (required) {
            return {
                name: 'Run docker-compose',
                run: 'docker-compose -f testing/docker-compose.yml up --build -d'
            }
        }
    }
}

export class RunSetUpScriptStep extends step.Step {
    constructor(setupScript?: string) {
        super();
        if (setupScript) {
            return {
                name: 'Run setup script',
                run: `${setupScript}`,
            }
        }
        return
    }
}

export class BuildBinariesStep extends step.Step {
    constructor() {
        super();
        return {
            name: 'Build tfgen & provider binaries',
            run: 'make provider'
        }
    }
}

export class BuildSdksStep extends step.Step {
    constructor() {
        super();
        return {
            name: 'Build SDK',
            run: 'make build_${{ matrix.language }}'
        }
    }
}

export class UploadProviderBinariesStep extends step.Step {
    constructor() {
        super();
        return {
            name: 'Upload artifacts',
            uses: action.uploadArtifact,
            with: {
                name: '${{ env.PROVIDER }}-provider.tar.gz',
                path: '${{ github.workspace }}/bin/provider.tar.gz',
            }
        }
    }
}

export class UploadSdkStep extends step.Step {
    constructor() {
        super();
        return {
            name: 'Upload artifacts',
            uses: action.uploadArtifact,
            with: {
                name: '${{ matrix.language  }}-sdk.tar.gz',
                path: '${{ github.workspace}}/sdk/${{ matrix.language }}.tar.gz',
            }
        }
    }
}

export class DownloadProviderStep extends step.Step {
    constructor() {
        super();
        return {
            name: 'Download provider + tfgen binaries',
            uses: action.downloadArtifact,
            with: {
                name: '${{ env.PROVIDER }}-provider.tar.gz',
                path: '${{ github.workspace }}/bin',
            }
        }
    }
}

export class DownloadSDKsStep extends step.Step {
    constructor() {
        super();
        return {
            name: 'Download SDK',
            uses: action.downloadArtifact,
            with: {
                name: '${{ matrix.language }}-sdk.tar.gz',
                path: '${{ github.workspace}}/sdk/',
            }
        }
    }
}

export class DownloadSpecificSDKStep extends step.Step {
    constructor(name: string) {
        super();
        return {
            name: `Download ${name} SDK`,
            uses: action.downloadArtifact,
            with: {
                name: `${name}-sdk.tar.gz`,
                path: '${{ github.workspace}}/sdk/',
            }
        }
    }
}

export class UnzipProviderBinariesStep extends step.Step {
    constructor() {
        super();
        return {
            name: 'Untar provider binaries',
            run: 'tar -zxf ${{ github.workspace }}/bin/provider.tar.gz -C ${{ github.workspace}}/bin\n' +
                'find ${{ github.workspace }} -name "pulumi-*-${{ env.PROVIDER }}" -print -exec chmod +x {} \\;',
        }
    }
}

export class UnzipSDKsStep extends step.Step {
    constructor() {
        super();
        return {
            name: 'Uncompress SDK folder',
            run: 'tar -zxf ${{ github.workspace }}/sdk/${{ matrix.language }}.tar.gz -C ${{ github.workspace }}/sdk/${{ matrix.language }}',
        }
    }
}

export class UnzipSpecificSDKStep extends step.Step {
    constructor(name: string) {
        super();
        return {
            name: `Uncompress ${name} SDK`,
            run: `tar -zxf \${{github.workspace}}/sdk/${name}.tar.gz -C \${{github.workspace}}/sdk/${name}`,
        }
    }
}

export class ZipProviderBinariesStep extends step.Step {
    constructor() {
        super();
        return {
            name: 'Tar provider binaries',
            run: 'tar -zcf ${{ github.workspace }}/bin/provider.tar.gz -C ${{ github.workspace }}/bin/ pulumi-resource-${{ env.PROVIDER }} pulumi-tfgen-${{ env.PROVIDER }}'
        }
    }
}

export class ZipSDKsStep extends step.Step {
    constructor() {
        super();
        return {
            name: 'Compress SDK folder',
            run: 'tar -zcf sdk/${{ matrix.language }}.tar.gz -C sdk/${{ matrix.language }} .'
        }
    }
}

export class NotifySlack extends step.Step {
    constructor(name: string) {
        super();
        return {
            if: 'failure()',
            name: 'Notify Slack',
            uses: action.notifySlack,
            with: {
                author_name: `${name}`,
                fields: 'repo,commit,author,action',
                status: '${{ job.status }}'
            }
        }
    }
}

export class CheckCleanWorkTreeStep extends step.Step {
    constructor() {
        super();
        return {
            name: 'Check worktree clean',
            run: './ci-scripts/ci/check-worktree-is-clean'
        }
    }
}

export class SetNugetSource extends step.Step {
    constructor() {
        super();
        return {
            run: 'dotnet nuget add source ${{ github.workspace }}/nuget'
        }
    }
}

export class SetProvidersToPATH extends step.Step {
    constructor() {
        super();
        return {
            name: 'Update path',
            run: 'echo "${{ github.workspace }}/bin" >> $GITHUB_PATH'
        }
    }
}

export class RunTests extends step.Step {
    constructor() {
        super();
        return {
            name: 'Run tests',
            run: 'cd examples && go test -v -count=1 -cover -timeout 2h -tags=${{ matrix.language }} -parallel 4 .'
        }
    }
}

export class SetPreReleaseVersion extends step.Step {
    constructor() {
        super();
        return {
            name: 'Set PreRelease Version',
            run: 'echo "GORELEASER_CURRENT_TAG=v$(pulumictl get version --language generic)" >> $GITHUB_ENV'
        }
    }
}

export class RunGoReleaserWithArgs extends step.Step {
    constructor(args?: string) {
        super();
        return {
            name: 'Run GoReleaser',
            uses: action.goReleaser,
            with: {
                args: `${args}`,
                version: 'latest'
            }
        }
    }
}

export class RunCommand extends step.Step {
    constructor(command: string) {
        super();
        return {
            run: `${command}`,
        }
    }
}

export class RunPublishSDK extends step.Step {
    constructor() {
        super();
        return {
            name: 'Publish SDKs',
            run: './ci-scripts/ci/publish-tfgen-package ${{ github.workspace }}',
            env: {
                'NODE_AUTH_TOKEN': '${{ secrets.NPM_TOKEN }}'
            }
        }
    }
}

export class UpdatePulumiTerraformBridgeDependency extends step.Step {
    constructor() {
        super();
        return {
            name: 'Update Pulumi Terraform Bridge Dependency',
            run: 'cd provider && go mod edit -require github.com/pulumi/pulumi-terraform-bridge/v3@${{ github.event.client_payload.ref }} && go mod tidy && cd ../',
        }
    }
}

export class CommitChanges extends step.Step {
    constructor(refName: string) {
        super();
        return {
            name: 'commit changes',
            uses: action.addAndCommit,
            with: {
                author_email: "bot@pulumi.com",
                author_name: "pulumi-bot",
                ref: `${refName}`
            }
        }
    }
}

export class PullRequest extends step.Step {
    constructor(refName: string, prTitle: string, user: string) {
        super();
        return {
            name: 'pull-request',
            uses: action.pullRequest,
            with: {
                destination_branch: "master",
                github_token: "${{ secrets.PULUMI_BOT_TOKEN }}",
                pr_allow_empty: "true",
                pr_assignee: `${user}`,
                pr_body: '*Automated PR*',
                pr_label: "automation/merge",
                pr_reviewer: `${user}`,
                pr_title: `${prTitle}`,
                author_name: "pulumi-bot",
                source_branch: `${refName}`
            },
            env: {
                GITHUB_TOKEN: '${{ secrets.PULUMI_BOT_TOKEN }}'
            }
        }
    }
}
import * as g from '@jaxxstorm/gh-actions';
import * as job from '@jaxxstorm/gh-actions/lib/job';
import * as param from '@jkcfg/std/param';
import * as steps from './steps';
const pythonVersion = "3.7";
const goVersion = "1.16.x";
const nodeVersion = "14.x";
const dotnetVersion = "3.1.301";
const provider = param.String('provider');
const extraEnv = param.Object('env');
const docker = param.Boolean('docker', false);
const aws = param.Boolean('aws');
const gcp = param.Boolean('gcp');
const lint = param.Boolean('lint', true);
const setupScript = param.String('setup-script');
const parallelism = param.Number('parallel', 3);
const env = Object.assign({
    GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
    PROVIDER: provider,
    PULUMI_ACCESS_TOKEN: '${{ secrets.PULUMI_ACCESS_TOKEN }}',
    PULUMI_API: 'https://api.pulumi-staging.io',
    PULUMI_LOCAL_NUGET: '${{ github.workspace }}/nuget',
    NPM_TOKEN: '${{ secrets.NPM_TOKEN }}',
    NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}',
    NUGET_PUBLISH_KEY: '${{ secrets.NUGET_PUBLISH_KEY }}',
    PYPI_PASSWORD: '${{ secrets.PYPI_PASSWORD }}',
    TRAVIS_OS_NAME: 'linux',
    SLACK_WEBHOOK_URL: '${{ secrets.SLACK_WEBHOOK_URL }}',
}, extraEnv);
export class MasterWorkflow extends g.GithubWorkflow {
    constructor(name, jobs) {
        super(name, jobs, {
            push: {
                branches: ["master"],
                'tags-ignore': ['v*', 'sdk/*', '**'],
                'paths-ignore': [
                    "*.md"
                ]
            },
        }, {
            env,
        });
        this.jobs = {
            'prerequisites': new PrerequisitesJob('prerequisites'),
            'build_sdk': new BuildSdkJob('build_sdk'),
            'test': new TestsJob('test'),
            'publish': new PublishPrereleaseJob('publish'),
            'publish_sdk': new PublishSDKJob('publish_sdk'),
        };
        if (lint) {
            this.jobs = Object.assign(this.jobs, {
                'lint': new LintProviderJob('lint'),
                'lint_sdk': new LintSDKJob('lint-sdk'),
            });
        }
    }
}
export class ReleaseWorkflow extends g.GithubWorkflow {
    constructor(name, jobs) {
        super(name, jobs, {
            push: {
                tags: ["v*.*.*", "!v*.*.*-**"],
            },
        }, {
            env,
        });
        this.jobs = {
            'prerequisites': new PrerequisitesJob('prerequisites'),
            'build_sdk': new BuildSdkJob('build_sdk'),
            'test': new TestsJob('test'),
            'publish': new PublishJob('publish'),
            'publish_sdk': new PublishSDKJob('publish_sdk'),
            'create_docs_build': new DocsBuildJob('create_docs_build'),
        };
        if (lint) {
            this.jobs = Object.assign(this.jobs, {
                'lint': new LintProviderJob('lint'),
                'lint_sdk': new LintSDKJob('lint-sdk'),
            });
        }
    }
}
export class PrereleaseWorkflow extends g.GithubWorkflow {
    constructor(name, jobs) {
        super(name, jobs, {
            push: {
                tags: ["v*.*.*-**"],
            },
        }, {
            env,
        });
        this.jobs = {
            'prerequisites': new PrerequisitesJob('prerequisites'),
            'build_sdk': new BuildSdkJob('build_sdk'),
            'test': new TestsJob('test'),
            'publish': new PublishPrereleaseJob('publish'),
            'publish_sdk': new PublishSDKJob('publish_sdk'),
        };
        if (lint) {
            this.jobs = Object.assign(this.jobs, {
                'lint': new LintProviderJob('lint'),
                'lint_sdk': new LintSDKJob('lint-sdk'),
            });
        }
    }
}
export class PullRequestWorkflow extends g.GithubWorkflow {
    constructor(name, jobs) {
        super(name, jobs, {
            pull_request: {
                branches: ["master"],
                'paths-ignore': [
                    "CHANGELOG.md"
                ]
            },
        }, {
            env,
        });
        this.jobs = {
            'prerequisites': new PrerequisitesJob('prerequisites'),
            'build_sdk': new BuildSdkJob('build_sdk'),
            'test': new TestsJob('test'),
        };
        if (lint) {
            this.jobs = Object.assign(this.jobs, {
                'lint': new LintProviderJob('lint'),
                'lint_sdk': new LintSDKJob('lint-sdk'),
            });
        }
    }
}
export class UpdatePulumiTerraformBridgeWorkflow extends g.GithubWorkflow {
    constructor(name, jobs) {
        super(name, jobs, {
            repository_dispatch: {
                types: ["update-bridge"],
            },
        }, {
            env,
        });
        this.jobs = {
            'update_bridge': new EmptyJob('update-bridge')
                .addStrategy({
                'fail-fast': true,
                matrix: {
                    goversion: [goVersion],
                    dotnetversion: [dotnetVersion],
                    pythonversion: [pythonVersion],
                    nodeversion: [nodeVersion],
                },
            })
                .addStep(new steps.CheckoutRepoStep())
                .addStep(new steps.CheckoutScriptsRepoStep())
                .addStep(new steps.CheckoutTagsStep())
                .addStep(new steps.InstallGo())
                .addStep(new steps.InstallPulumiCtl())
                .addStep(new steps.InstallPulumiCli())
                .addStep(new steps.InstallDotNet())
                .addStep(new steps.InstallNodeJS())
                .addStep(new steps.InstallPython())
                .addStep(new steps.RunCommand('sudo npm install -g chg'))
                .addStep(new steps.UpdatePulumiTerraformBridgeDependency())
                .addStep(new steps.RunCommand('make build_sdks'))
                .addStep(new steps.RunCommand('chg add "Upgrading pulumi-terraform-bridge to ${{ github.event.client_payload.ref }}'))
                .addStep(new steps.CommitChanges('update-bridge/${{ github.event.client_payload.ref }}-${{ github.run_id }}'))
                .addStep(new steps.PullRequest('update-bridge/${{ github.event.client_payload.ref }}-${{ github.run_id }}', 'Upgrade to ${{ github.event.client_payload.ref }} of pulumi-terraform-bridge', 'stack72'))
        };
    }
}
export class EmptyJob extends job.Job {
    constructor(name, params) {
        super();
        this.steps = [];
        this.strategy = {};
        this.name = name;
        Object.assign(this, { name }, params);
    }
    addStep(step) {
        this.steps.push(step);
        return this;
    }
    addStrategy(strategy) {
        this.strategy = strategy;
        return this;
    }
}
export class BuildSdkJob extends job.Job {
    constructor(name) {
        super();
        this.needs = 'prerequisites';
        this['runs-on'] = 'ubuntu-latest';
        this.strategy = {
            'fail-fast': true,
            matrix: {
                goversion: [goVersion],
                dotnetversion: [dotnetVersion],
                pythonversion: [pythonVersion],
                nodeversion: [nodeVersion],
                language: ['nodejs', 'python', 'dotnet', 'go'],
            },
        };
        this.steps = [
            new steps.CheckoutRepoStep(),
            new steps.CheckoutScriptsRepoStep(),
            new steps.CheckoutTagsStep(),
            new steps.InstallGo(),
            new steps.InstallPulumiCtl(),
            new steps.InstallPulumiCli(),
            new steps.InstallNodeJS(),
            new steps.InstallDotNet(),
            new steps.InstallPython(),
            new steps.DownloadProviderStep(),
            new steps.UnzipProviderBinariesStep(),
            new steps.BuildSdksStep(),
            new steps.CheckCleanWorkTreeStep(),
            new steps.ZipSDKsStep(),
            new steps.UploadSdkStep(),
            new steps.NotifySlack('Failure in building ${{ matrix.language }} sdk'),
        ];
        this.name = name;
        Object.assign(this, { name });
    }
}
export class PrerequisitesJob extends job.Job {
    constructor(name) {
        super();
        this['runs-on'] = 'ubuntu-latest';
        this.strategy = {
            'fail-fast': true,
            matrix: {
                goversion: ['1.16.x'],
                dotnetversion: ['3.1.301'],
                pythonversion: ['3.7'],
                nodeversion: ['13.x'],
            },
        };
        this.steps = [
            new steps.CheckoutRepoStep(),
            new steps.CheckoutScriptsRepoStep(),
            new steps.CheckoutTagsStep(),
            new steps.InstallGo(),
            new steps.InstallPulumiCtl(),
            new steps.InstallPulumiCli(),
            new steps.BuildBinariesStep(),
            new steps.ZipProviderBinariesStep(),
            new steps.UploadProviderBinariesStep(),
            new steps.NotifySlack('Failure in building provider prerequisites'),
        ];
        this.name = name;
        Object.assign(this, { name });
    }
}
export class TestsJob extends job.Job {
    constructor(name) {
        super();
        this['runs-on'] = 'ubuntu-latest';
        this.needs = 'build_sdk';
        this.strategy = {
            'fail-fast': true,
            matrix: {
                goversion: [goVersion],
                dotnetversion: [dotnetVersion],
                pythonversion: [pythonVersion],
                nodeversion: [nodeVersion],
                language: ['nodejs', 'python', 'dotnet', 'go'],
            },
        };
        this.steps = [
            new steps.CheckoutRepoStep(),
            new steps.CheckoutScriptsRepoStep(),
            new steps.CheckoutTagsStep(),
            new steps.InstallGo(),
            new steps.InstallPulumiCtl(),
            new steps.InstallPulumiCli(),
            new steps.InstallNodeJS(),
            new steps.InstallDotNet(),
            new steps.InstallPython(),
            new steps.DownloadProviderStep(),
            new steps.UnzipProviderBinariesStep(),
            new steps.SetNugetSource(),
            new steps.DownloadSDKsStep(),
            new steps.UnzipSDKsStep(),
            new steps.SetProvidersToPATH(),
            new steps.InstallPythonDeps(),
            new steps.RunDockerComposeStep(docker),
            new steps.RunSetUpScriptStep(setupScript),
            new steps.ConfigureAwsCredentials(aws),
            new steps.ConfigureGcpCredentials(gcp),
            new steps.InstallSDKDeps(),
            new steps.RunTests(),
            new steps.NotifySlack('Failure in running ${{ matrix.language }} tests'),
        ];
        this.name = name;
        Object.assign(this, { name });
    }
}
export class PublishPrereleaseJob extends job.Job {
    constructor(name) {
        super();
        this['runs-on'] = 'ubuntu-latest';
        this.needs = 'publish';
        this.strategy = {
            'fail-fast': true,
            matrix: {
                goversion: [goVersion],
                dotnetversion: [dotnetVersion],
                pythonversion: [pythonVersion],
                nodeversion: [nodeVersion],
            },
        };
        this.steps = [
            new steps.CheckoutRepoStep(),
            new steps.CheckoutTagsStep(),
            new steps.InstallGo(),
            new steps.InstallPulumiCtl(),
            new steps.InstallPulumiCli(),
            new steps.ConfigureAwsCredentials(true),
            new steps.SetPreReleaseVersion(),
            new steps.RunGoReleaserWithArgs(`-p ${parallelism} -f .goreleaser.prerelease.yml --rm-dist --skip-validate`),
        ];
        this.name = name;
        Object.assign(this, { name });
    }
}
export class PublishJob extends job.Job {
    constructor(name) {
        super();
        this['runs-on'] = 'ubuntu-latest';
        this.needs = 'test';
        this.strategy = {
            'fail-fast': true,
            matrix: {
                goversion: [goVersion],
                dotnetversion: [dotnetVersion],
                pythonversion: [pythonVersion],
                nodeversion: [nodeVersion],
            },
        };
        this.steps = [
            new steps.CheckoutRepoStep(),
            new steps.CheckoutTagsStep(),
            new steps.InstallGo(),
            new steps.InstallPulumiCtl(),
            new steps.InstallPulumiCli(),
            new steps.ConfigureAwsCredentials(true),
            new steps.SetPreReleaseVersion(),
            new steps.RunGoReleaserWithArgs(`-p ${parallelism} release --rm-dist --timeout 60m0s`),
        ];
        this.name = name;
        Object.assign(this, { name });
    }
}
export class DocsBuildJob extends job.Job {
    constructor(name) {
        super();
        this['runs-on'] = 'ubuntu-latest';
        this.needs = 'publish_sdk';
        this.steps = [
            new steps.InstallPulumiCtl(),
            new steps.DispatchDocsBuildEvent(),
        ];
        this.name = name;
        Object.assign(this, { name });
    }
}
export class PublishSDKJob extends job.Job {
    constructor(name) {
        super();
        this['runs-on'] = 'ubuntu-latest';
        this.needs = 'publish';
        this.strategy = {
            'fail-fast': true,
            matrix: {
                goversion: [goVersion],
                dotnetversion: [dotnetVersion],
                pythonversion: [pythonVersion],
                nodeversion: [nodeVersion],
            },
        };
        this.steps = [
            new steps.CheckoutRepoStep(),
            new steps.CheckoutScriptsRepoStep(),
            new steps.CheckoutTagsStep(),
            new steps.InstallGo(),
            new steps.InstallPulumiCtl(),
            new steps.InstallPulumiCli(),
            new steps.InstallNodeJS(),
            new steps.InstallDotNet(),
            new steps.InstallPython(),
            new steps.DownloadSpecificSDKStep('python'),
            new steps.UnzipSpecificSDKStep('python'),
            new steps.DownloadSpecificSDKStep('dotnet'),
            new steps.UnzipSpecificSDKStep('dotnet'),
            new steps.DownloadSpecificSDKStep('nodejs'),
            new steps.UnzipSpecificSDKStep('nodejs'),
            new steps.RunCommand('python -m pip install pip twine'),
            new steps.RunPublishSDK(),
            new steps.NotifySlack('Failure in publishing SDK'),
        ];
        this.name = name;
        Object.assign(this, { name });
    }
}
export class LintProviderJob extends job.Job {
    constructor(name) {
        super();
        this['runs-on'] = 'ubuntu-latest';
        this.container = 'golangci/golangci-lint:latest';
        this.strategy = {
            'fail-fast': true,
            matrix: {
                goversion: [goVersion],
            },
        };
        this.steps = [
            new steps.CheckoutRepoStep(),
            new steps.CheckoutScriptsRepoStep(),
            new steps.CheckoutTagsStep(),
            new steps.InstallGo(),
            new steps.InstallPulumiCtl(),
            new steps.InstallPulumiCli(),
            new steps.RunCommand('make lint_provider'),
            new steps.NotifySlack('Failure in linting provider'),
        ];
        this.name = name;
        Object.assign(this, { name });
    }
}
export class LintSDKJob extends job.Job {
    constructor(name) {
        super();
        this['runs-on'] = 'ubuntu-latest';
        this.needs = 'build_sdk';
        this.container = 'golangci/golangci-lint:latest';
        this.strategy = {
            'fail-fast': true,
            matrix: {
                goversion: [goVersion],
            },
        };
        this.steps = [
            new steps.CheckoutRepoStep(),
            new steps.CheckoutScriptsRepoStep(),
            new steps.CheckoutTagsStep(),
            new steps.InstallGo(),
            new steps.InstallPulumiCtl(),
            new steps.InstallPulumiCli(),
            new steps.RunCommand(`cd sdk/go/${provider} && golangci-lint run -c ../../../.golangci.yml`),
            new steps.NotifySlack('Failure in linting go sdk'),
        ];
        this.name = name;
        Object.assign(this, { name });
    }
}

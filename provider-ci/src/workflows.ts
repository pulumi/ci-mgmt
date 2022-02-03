import * as g from '@jaxxstorm/gh-actions';
import * as job from '@jaxxstorm/gh-actions/lib/job';
import * as param from '@jkcfg/std/param';
import * as steps from './steps';

const pythonVersion = "3.7";
const goVersion = "1.17.x";
const nodeVersion = "14.x";
const dotnetVersion = "3.1.301";

const provider = param.String('provider');
const extraEnv = param.Object('env');
const docker = param.Boolean('docker', false);
const aws = param.Boolean('aws', false);
const gcp = param.Boolean('gcp', false);
const lint = param.Boolean('lint', true);
const setupScript = param.String('setup-script');
const parallelism = param.Number('parallel', 3);
const goReleaserTimeout = param.Number('timeout', 60);

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
    PULUMI_GO_DEP_ROOT: '${{ github.workspace }}/..',
}, extraEnv);

export class DefaultBranchWorkflow extends g.GithubWorkflow {
    jobs: { [k: string]: job.Job; };

    constructor(name: string, jobs: { [k: string]: job.Job; }) {
        super(name, jobs, {
            push: {
                branches: [name],
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
            'generate_coverage_data': new GenerateCoverageDataJob('generate_coverage_data'),
        };

        if (lint) {
            this.jobs = Object.assign(this.jobs, {
                'lint': new LintProviderJob('lint'),
                'lint_sdk': new LintSDKJob('lint-sdk'),
            });
        }
    }
}

export class NightlyCronWorkflow extends g.GithubWorkflow {
    jobs: { [k: string]: job.Job; };

    constructor(name: string, jobs: { [k: string]: job.Job; }) {
        super(name, jobs, {
            schedule: [{
                "cron": "0 6 * * *",
            }],
        }, {
            env,
        });
        this.jobs = {
            'prerequisites': new PrerequisitesJob('prerequisites'),
            'build_sdk': new BuildSdkJob('build_sdk'),
            'test': new TestsJob('test'),
        };
    }
}

export class ReleaseWorkflow extends g.GithubWorkflow {
    jobs: { [k: string]: job.Job; };

    constructor(name: string, jobs: { [k: string]: job.Job; }) {
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
    jobs: { [k: string]: job.Job; };

    constructor(name: string, jobs: { [k: string]: job.Job; }) {
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

export class RunAcceptanceTestsWorkflow extends g.GithubWorkflow {
    jobs: { [k: string]: job.Job; };

    constructor(name: string, jobs: { [k: string]: job.Job; }) {
        super(name, jobs, {
            repository_dispatch: {
                types: ['run-acceptance-tests-command']
            },
            pull_request: {
                branches: ["master", "main"],
                'paths-ignore': [
                    "CHANGELOG.md"
                ]
            },
        }, {
            env: {
                ...env,
                'PR_COMMIT_SHA': '${{ github.event.client_payload.pull_request.head.sha }}',
            }
        });
        this.jobs = {
            'comment-notification': new EmptyJob('comment-notification')
                .addConditional('github.event_name == \'repository_dispatch\'')
                .addStep(new steps.CreateCommentsUrlStep())
                .addStep(new steps.UpdatePRWithResultsStep()),
            'prerequisites': new PrerequisitesJob('prerequisites').addDispatchConditional(true),
            'build_sdk': new BuildSdkJob('build_sdk').addDispatchConditional(true),
            'test': new TestsJob('test').addDispatchConditional(true),
        };

        if (lint) {
            this.jobs = Object.assign(this.jobs, {
                'lint': new LintProviderJob('lint').addDispatchConditional(true),
                'lint_sdk': new LintSDKJob('lint-sdk').addDispatchConditional(true),
            });
        }
    }
}

export class PullRequestWorkflow extends g.GithubWorkflow {
    jobs: { [k: string]: job.Job; };

    constructor(name: string, jobs: { [k: string]: job.Job; }) {
        super(name, jobs, {
            pull_request_target: {},
        }, {
            env,
        });
        this.jobs = {
            'comment-on-pr': new EmptyJob('comment-on-pr')
                .addConditional('github.event.pull_request.head.repo.full_name != github.repository')
                .addStep(new steps.CheckoutRepoStep())
                .addStep(new steps.CommentPRWithSlashCommandStep()),
        };
    }
}

export class UpdatePulumiTerraformBridgeWorkflow extends g.GithubWorkflow {
    jobs: { [k: string]: job.Job; };

    constructor(name: string, jobs: { [k: string]: job.Job; }) {
        super(name, jobs, {
            workflow_dispatch: {
                inputs: {
                    bridge_version: {
                        required: true,
                        description: "The version of pulumi/pulumi-terraform-bridge to update to. Do not include the 'v' prefix. Must be major version 3.",
                        type: "string",
                    },
                    sdk_version: {
                        required: true,
                        description: "The version of pulumi/pulumi/sdk to update to. Do not include the 'v' prefix. Must be major version 3.",
                        type: "string"
                    },
                }
            }
        }, {
            env: {
                GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
                // If there are missing or extra mappings, they can not have been
                // introduced by updating the bridge, so for this workflow we'll
                // ignore mapping errors.
                PULUMI_EXTRA_MAPPING_ERROR: false,
                PULUMI_MISSING_MAPPING_ERROR: false,
            }
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
                .addStep(new steps.CheckoutTagsStep())
                .addStep(new steps.InstallGo())
                .addStep(new steps.InstallPulumiCtl())
                .addStep(new steps.InstallPulumiCli())
                .addStep(new steps.InstallDotNet())
                .addStep(new steps.InstallNodeJS())
                .addStep(new steps.InstallPython())
                .addStep({
                    name: "Update pulumi-terraform-bridge",
                    run: "cd provider && go mod edit -require github.com/pulumi/pulumi-terraform-bridge/v3@v${{ github.event.inputs.bridge_version }} && go mod tidy",
                })
                .addStep({
                    name: "Update Pulumi SDK (provider/go.mod)",
                    run: "cd provider && go mod edit -require github.com/pulumi/pulumi/sdk/v3@v${{ github.event.inputs.sdk_version }} && go mod tidy",
                })
                .addStep({
                    name: "Update Pulumi SDK (sdk/go.mod)",
                    run: "cd sdk && go mod edit -require github.com/pulumi/pulumi/sdk/v3@v${{ github.event.inputs.sdk_version }} && go mod tidy",
                })
                .addStep(new steps.RunCommand('make tfgen'))
                .addStep(new steps.RunCommand('make build_sdks'))
                .addStep({
                    name: "Create PR",
                    uses: "peter-evans/create-pull-request@v3.12.0",
                    with: {
                        "commit-message": "Update pulumi-terraform-bridge to v${{ github.event.inputs.bridge_version }}",
                        committer: "pulumi-bot <bot@pulumi.com>",
                        author: "pulumi-bot <bot@pulumi.com>",
                        branch: "pulumi-bot/bridge-v${{ github.event.inputs.bridge_version }}-${{ github.run_id}}",
                        base: "master",
                        labels: "impact/no-changelog-required",
                        title: "Update pulumi-terraform-bridge to v${{ github.event.inputs.bridge_version }}",
                        body: "This pull request was generated automatically by the update-bridge workflow in this repository.",
                        "team-reviewers": "platform-integrations",
                        token: "${{ secrets.PULUMI_BOT_TOKEN }}",
                    }
                })
        };
    }
}

class UpdateUpstreamProviderArgs {
    upstreamProviderOrg: string;
    upstreamProviderRepo: string;
    failOnExtraMapping: boolean;
    failOnMissingMapping: boolean;
}

export class UpdateUpstreamProviderWorkflow extends g.GithubWorkflow {
    jobs: { [k: string]: job.Job; };

    constructor(args: UpdateUpstreamProviderArgs, jobs: { [k: string]: job.Job; }) {
        super('Update upstream provider', jobs, {
            workflow_dispatch: {
                inputs: {
                    version: {
                        required: true,
                        description: "The new version of the upstream provider. Do not include the 'v' prefix.",
                        type: "string",
                    },
                    linked_issue_number: {
                        required: false,
                        description: "The issue number of a PR in this repository to which the generated pull request should be linked.",
                        type: "string"
                    },
                }
            }
        }, {
            env: {
                ...env,
                PULUMI_EXTRA_MAPPING_ERROR: args.failOnExtraMapping,
                PULUMI_MISSING_MAPPING_ERROR: args.failOnMissingMapping,
                UPSTREAM_PROVIDER_ORG: args.upstreamProviderOrg,
                UPSTREAM_PROVIDER_REPO: args.upstreamProviderRepo,
            }
        });

        const prStepOptions = {
            "commit-message": "Update ${{ env.UPSTREAM_PROVIDER_REPO }} to v${{ github.event.inputs.version }}",
            committer: "pulumi-bot <bot@pulumi.com>",
            author: "pulumi-bot <bot@pulumi.com>",
            branch: "pulumi-bot/v${{ github.event.inputs.version }}-${{ github.run_id}}",
            base: "master",
            // TODO: Add auto-merge.
            labels: "impact/no-changelog-required",
            title: "Update ${{ env.UPSTREAM_PROVIDER_REPO }} to v${{ github.event.inputs.version }}",
            body: "This pull request was generated automatically by the update-upstream-provider workflow in this repository.",
            "team-reviewers": "platform-integrations",
            token: "${{ secrets.PULUMI_BOT_TOKEN }}",
        };

        this.jobs = {
            'update_upstream_provider': new EmptyJob('update-upstream_provider')
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
                .addStep(new steps.CheckoutTagsStep())
                .addStep(new steps.InstallGo())
                .addStep(new steps.InstallPulumiCtl())
                .addStep(new steps.InstallPulumiCli())
                .addStep(new steps.InstallDotNet())
                .addStep(new steps.InstallNodeJS())
                .addStep(new steps.InstallPython())
                .addStep({
                    name: "Get upstream provider sha",
                    run: "echo \"UPSTREAM_PROVIDER_SHA=$(curl https://api.github.com/repos/${{ env.UPSTREAM_PROVIDER_ORG }}/${{ env.UPSTREAM_PROVIDER_REPO }}/git/ref/tags/v${{ github.event.inputs.version }} | jq .object.sha -r)\" >> $GITHUB_ENV",
                })
                .addStep({
                    name: "Update shim/go.mod",
                    if: "${{ hashFiles('provider/shim/go.mod') != '' }}",
                    run: "cd provider/shim && go mod edit -require github.com/${{ env.UPSTREAM_PROVIDER_ORG }}/${{ env.UPSTREAM_PROVIDER_REPO }}@${{ env.UPSTREAM_PROVIDER_SHA }} && go mod tidy"
                })
                .addStep({
                    name: "Update go.mod",
                    run: "cd provider && go mod edit -require github.com/${{ env.UPSTREAM_PROVIDER_ORG }}/${{ env.UPSTREAM_PROVIDER_REPO }}@${{ env.UPSTREAM_PROVIDER_SHA }} && go mod tidy",
                })
                .addStep(new steps.RunCommand('make tfgen'))
                .addStep(new steps.RunCommand('make build_sdks'))
                .addStep({
                    name: "Create PR (no linked issue)",
                    uses: "peter-evans/create-pull-request@v3.12.0",
                    if: "${{ !github.event.inputs.linked_issue_number }}",
                    with: {
                        ...prStepOptions,
                        body: "This pull request was generated automatically by the update-upstream-provider workflow in this repository.",
                    }
                })
                // Identical to the previous step, except that it links to the
                // issue if one is suppled:
                .addStep({
                    name: "Create PR (with linked issue)",
                    uses: "peter-evans/create-pull-request@v3.12.0",
                    if: "${{ github.event.inputs.linked_issue_number }}",
                    with: {
                        ...prStepOptions,
                        body: "Fixes #${{ github.event.inputs.linked_issue_number }}\n\nThis pull request was generated automatically by the update-upstream-provider workflow in this repository.",
                    }
                })
        };
    }
}

export class CommandDispatchWorkflow extends g.GithubWorkflow {
    jobs: { [k: string]: job.Job; };

    constructor(name: string, jobs: { [k: string]: job.Job; }) {
        super(name, jobs, {
            issue_comment: {
                types: ["created", "edited"],
            },
        }, {
            env,
        });
        this.jobs = {
            'command-dispatch-for-testing': new EmptyJob('command-dispatch-for-testing')
                .addStep(new steps.CheckoutRepoStep())
                .addStep(new steps.CommandDispatchStep(`${provider}`))
        };
    }
}

export class EmptyJob extends job.Job {
    steps = [] as any;
    'runs-on' = 'ubuntu-latest';
    strategy = {};

    constructor(name: string, params?: Partial<EmptyJob>) {
        super();
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

    addConditional(conditional) {
        this.if = conditional;
        return this;
    }
}

export class BuildSdkJob extends job.Job {
    needs = 'prerequisites';
    'runs-on' = 'ubuntu-latest';
    strategy = {
        'fail-fast': true,
        matrix: {
            goversion: [goVersion],
            dotnetversion: [dotnetVersion],
            pythonversion: [pythonVersion],
            nodeversion: [nodeVersion],
            language: ['nodejs', 'python', 'dotnet', 'go'],
        },
    };
    steps = [
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
        new steps.InstallPlugins(),
        new steps.SetProvidersToPATH(),
        new steps.BuildSdksStep(),
        new steps.CheckCleanWorkTreeStep(),
        new steps.ZipSDKsStep(),
        new steps.UploadSdkStep(),
        new steps.NotifySlack('Failure in building ${{ matrix.language }} sdk'),
    ] as any;

    constructor(name: string) {
        super();
        this.name = name;
        Object.assign(this, { name });
    }

    addDispatchConditional(isWorkflowDispatch) {
        if (isWorkflowDispatch) {
            this.if = "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository";

            this.steps = this.steps.filter(step => step.name !== 'Checkout Repo') as any;
            this.steps.unshift(new steps.CheckoutRepoStepAtPR());
        }
        return this;
    }
}

export class PrerequisitesJob extends job.Job {
    'runs-on' = 'ubuntu-latest';
    strategy = {
        'fail-fast': true,
        matrix: {
            goversion: [goVersion],
            dotnetversion: [dotnetVersion],
            pythonversion: [pythonVersion],
            nodeversion: [nodeVersion],
        },
    };
    steps = [
        new steps.CheckoutRepoStep(),
        new steps.CheckoutScriptsRepoStep(),
        new steps.CheckoutTagsStep(),
        new steps.InstallGo(),
        new steps.InstallPulumiCtl(),
        new steps.InstallPulumiCli(),
        new steps.InstallSchemaChecker(),
        new steps.BuildBinariesStep(),
        new steps.CheckSchemaChanges(),
        new steps.CommentSchemaChangesOnPR(),
        new steps.ZipProviderBinariesStep(),
        new steps.UploadProviderBinariesStep(),
        new steps.NotifySlack('Failure in building provider prerequisites'),
    ].filter(step => step.uses !== undefined || step.run !== undefined) as any;

    constructor(name: string) {
        super();
        this.name = name;
        Object.assign(this, { name });
    }

    addDispatchConditional(isWorkflowDispatch) {
        if (isWorkflowDispatch) {
            this.if = "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository";

            this.steps = this.steps.filter(step => step.name !== 'Checkout Repo') as any;
            this.steps.unshift(new steps.CheckoutRepoStepAtPR());
        }
        return this;
    }
}

export class TestsJob extends job.Job {
    'runs-on' = 'ubuntu-latest';
    needs = 'build_sdk';
    strategy = {
        'fail-fast': true,
        matrix: {
            goversion: [goVersion],
            dotnetversion: [dotnetVersion],
            pythonversion: [pythonVersion],
            nodeversion: [nodeVersion],
            language: ['nodejs', 'python', 'dotnet', 'go'],
        },
    };
    steps = [
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
        new steps.ConfigureAwsCredentialsForTests(aws),
        new steps.ConfigureGcpCredentials(gcp),
        new steps.InstallSDKDeps(),
        new steps.SetupGotestfmt(),
        new steps.RunTests(),
        new steps.NotifySlack('Failure in running ${{ matrix.language }} tests'),
    ].filter(step => step.uses !== undefined || step.run !== undefined) as any;

    constructor(name: string) {
        super();
        this.name = name;
        Object.assign(this, { name });
    }

    addDispatchConditional(isWorkflowDispatch) {
        if (isWorkflowDispatch) {
            this.if = "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository";

            this.steps = this.steps.filter(step => step.name !== 'Checkout Repo') as any;
            this.steps.unshift(new steps.CheckoutRepoStepAtPR());
        }
        return this;
    }
}

export class PublishPrereleaseJob extends job.Job {
    'runs-on' = 'ubuntu-latest';
    needs = 'test';
    strategy = {
        'fail-fast': true,
        matrix: {
            goversion: [goVersion],
            dotnetversion: [dotnetVersion],
            pythonversion: [pythonVersion],
            nodeversion: [nodeVersion],
        },
    };
    steps = [
        new steps.CheckoutRepoStep(),
        new steps.CheckoutTagsStep(),
        new steps.InstallGo(),
        new steps.InstallPulumiCtl(),
        new steps.InstallPulumiCli(),
        new steps.ConfigureAwsCredentialsForPublish(),
        new steps.SetPreReleaseVersion(),
        new steps.RunGoReleaserWithArgs(`-p ${parallelism} -f .goreleaser.prerelease.yml --rm-dist --skip-validate --timeout ${goReleaserTimeout}m0s`),
        new steps.NotifySlack('Failure in publishing binaries'),
    ] as any;

    constructor(name: string) {
        super();
        this.name = name;
        Object.assign(this, { name });
    }
}

export class PublishJob extends job.Job {
    'runs-on' = 'ubuntu-latest';
    needs = 'test';
    strategy = {
        'fail-fast': true,
        matrix: {
            goversion: [goVersion],
            dotnetversion: [dotnetVersion],
            pythonversion: [pythonVersion],
            nodeversion: [nodeVersion],
        },
    };
    steps = [
        new steps.CheckoutRepoStep(),
        new steps.CheckoutTagsStep(),
        new steps.InstallGo(),
        new steps.InstallPulumiCtl(),
        new steps.InstallPulumiCli(),
        new steps.ConfigureAwsCredentialsForPublish(),
        new steps.SetPreReleaseVersion(),
        new steps.RunGoReleaserWithArgs(`-p ${parallelism} release --rm-dist --timeout ${goReleaserTimeout}m0s`),
        new steps.NotifySlack('Failure in publishing binaries'),
    ] as any;

    constructor(name: string) {
        super();
        this.name = name;
        Object.assign(this, { name });
    }
}

export class DocsBuildJob extends job.Job {
    'runs-on' = 'ubuntu-latest';
    needs = 'publish_sdk';
    steps = [
        new steps.InstallPulumiCtl(),
        new steps.DispatchDocsBuildEvent(),
    ] as any;

    constructor(name: string) {
        super();
        this.name = name;
        Object.assign(this, { name });
    }
}

export class PublishSDKJob extends job.Job {
    'runs-on' = 'ubuntu-latest';
    needs = 'publish';
    strategy = {
        'fail-fast': true,
        matrix: {
            goversion: [goVersion],
            dotnetversion: [dotnetVersion],
            pythonversion: [pythonVersion],
            nodeversion: [nodeVersion],
        },
    };
    steps = [
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
    ] as any;

    constructor(name: string) {
        super();
        this.name = name;
        Object.assign(this, { name });
    }
}

export class LintProviderJob extends job.Job {
    'runs-on' = 'ubuntu-latest';
    container = 'golangci/golangci-lint:latest';
    strategy = {
        'fail-fast': true,
        matrix: {
            goversion: [goVersion],
        },
    };
    steps = [
        new steps.CheckoutRepoStep(),
        new steps.CheckoutScriptsRepoStep(),
        new steps.CheckoutTagsStep(),
        new steps.InstallGo(),
        new steps.InstallPulumiCtl(),
        new steps.InstallPulumiCli(),
        new steps.RunCommand('make lint_provider'),
        new steps.NotifySlack('Failure in linting provider'),
    ];

    constructor(name: string) {
        super();
        this.name = name;
        Object.assign(this, { name });
    }

    addDispatchConditional(isWorkflowDispatch) {
        if (isWorkflowDispatch) {
            this.if = "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository";

            this.steps = this.steps.filter(step => step.name !== 'Checkout Repo') as any;
            this.steps.unshift(new steps.CheckoutRepoStepAtPR());
        }
        return this;
    }
}

export class LintSDKJob extends job.Job {
    'runs-on' = 'ubuntu-latest';
    needs = 'build_sdk';
    container = 'golangci/golangci-lint:latest';
    strategy = {
        'fail-fast': true,
        matrix: {
            goversion: [goVersion],
        },
    };
    steps = [
        new steps.CheckoutRepoStep(),
        new steps.CheckoutScriptsRepoStep(),
        new steps.CheckoutTagsStep(),
        new steps.InstallGo(),
        new steps.InstallPulumiCtl(),
        new steps.InstallPulumiCli(),
        new steps.RunCommand(`cd sdk/go/${provider} && golangci-lint run -c ../../../.golangci.yml`),
        new steps.NotifySlack('Failure in linting go sdk'),
    ] as any;

    constructor(name: string) {
        super();
        this.name = name;
        Object.assign(this, { name });
    }

    addDispatchConditional(isWorkflowDispatch) {
        if (isWorkflowDispatch) {
            this.if = "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository";

            this.steps = this.steps.filter(step => step.name !== 'Checkout Repo') as any;
            this.steps.unshift(new steps.CheckoutRepoStepAtPR());
        }
        return this;
    }
}

export class GenerateCoverageDataJob extends job.Job {
    'runs-on' = 'ubuntu-latest';
    'continue-on-error' = true;
    needs = 'prerequisites';
    env = {
        COVERAGE_OUTPUT_DIR: '${{ secrets.COVERAGE_OUTPUT_DIR }}'
    };
    strategy = {
        'fail-fast': true,
        matrix: {
            goversion: [goVersion],
        },
    };
    steps = [
        // Setting up prerequisites needed to run the coverage tracker
        new steps.CheckoutRepoStep(),
        new steps.ConfigureAwsCredentialsForCoverageDataUpload(),
        new steps.CheckoutScriptsRepoStep(),
        new steps.CheckoutTagsStep(),
        new steps.InstallGo(),
        new steps.InstallPulumiCtl(),
        new steps.InstallPulumiCli(),
        new steps.InstallSchemaChecker(),

        // Generating and summarizing coverage data
        new steps.EchoCoverageOutputDirStep(),
        new steps.GenerateCoverageDataStep(),
        new steps.PrintCoverageDataStep(),

        // Uploading coverage data
        new steps.UploadCoverageDataStep(),
    ] as any;

    constructor(name: string) {
        super();
        this.name = name;
        Object.assign(this, { name });
    }

    addDispatchConditional(isWorkflowDispatch) {
        if (isWorkflowDispatch) {
            this.if = "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository";

            this.steps = this.steps.filter(step => step.name !== 'Checkout Repo') as any;
            this.steps.unshift(new steps.CheckoutRepoStepAtPR());
        }
        return this;
    }
};;

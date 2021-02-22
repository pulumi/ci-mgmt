import * as g from '@jaxxstorm/gh-actions';
import * as job from '@jaxxstorm/gh-actions/lib/job';
import * as param from '@jkcfg/std/param';
import * as action from "./action-versions";
import * as stepLibrary from "./steps";

const provider = param.String('provider');
const extraEnv = param.Object('env');
const docker = param.Boolean('docker');
const aws = param.Boolean('aws');
const gcp = param.Boolean('gcp');
const lint = param.Boolean('lint', true);
const setupScript = param.String('setup-script');
const parallelism = param.Number('parallel', 4)
const triggerReleaseSmokeTest = param.Boolean('trigger-smoke-test', false)

const env = Object.assign({
    // eslint-disable-next-line no-template-curly-in-string
    GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
    GO111MODULE: 'on',
    PROVIDER: provider,
    // eslint-disable-next-line no-template-curly-in-string
    PULUMI_ACCESS_TOKEN: '${{ secrets.PULUMI_ACCESS_TOKEN }}',
    PULUMI_API: 'https://api.pulumi-staging.io',
    // eslint-disable-next-line no-template-curly-in-string
    PULUMI_LOCAL_NUGET: '${{ github.workspace }}/nuget',
    // eslint-disable-next-line no-template-curly-in-string
    NPM_TOKEN: '${{ secrets.NPM_TOKEN }}',
    // eslint-disable-next-line no-template-curly-in-string
    NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}',
    // eslint-disable-next-line no-template-curly-in-string
    NUGET_PUBLISH_KEY: '${{ secrets.NUGET_PUBLISH_KEY }}',
    // eslint-disable-next-line no-template-curly-in-string
    PYPI_PASSWORD: '${{ secrets.PYPI_PASSWORD }}',
    TRAVIS_OS_NAME: 'linux',
    SLACK_WEBHOOK_URL: '${{ secrets.SLACK_WEBHOOK_URL }}',
}, extraEnv);

export class BaseJob extends job.Job {
    strategy = {
        'fail-fast': true,
    };
    steps = [
        new stepLibrary.CheckoutRepoStep(),
        new stepLibrary.CheckoutScriptsRepoStep(),
        new stepLibrary.CheckoutTagsStep(),
        new stepLibrary.InstallGo("1.15.x"),
        new stepLibrary.InstallPulumiCtl(),
        new stepLibrary.InstallPulumiCli(),
    ] as any;
    'runs-on' = 'ubuntu-latest'

    constructor(name: string, params?: Partial<BaseJob>) {
        super();
        this.name = name;
        Object.assign(this, {name}, params)
    }

    addStep(step) {
        this.steps.push(step);
        return this;
    }

    addDocker(docker) {
        if (docker) {
            this.steps.push(new stepLibrary.RunDockerComposeStep())
        }
        return this;
    }

    addAWS(aws) {
        if (aws) {
            this.steps.push(new stepLibrary.ConfigureAwsCredentials())
        }
        return this;
    }

    addGCP(gcp) {
        if (gcp) {
            this.steps.push(new stepLibrary.ConfigureGcpCredentials())
        }
        return this;
    }

    addSetupScript(setupScript) {
        if (setupScript) {
            this.steps.push(new stepLibrary.RunSetUpScriptStep(setupScript))
        }
        return this;
    }
}

export class MultilangJob extends BaseJob {
    strategy = {
        'fail-fast': true,
        matrix: {
            language: ['nodejs', 'python', 'dotnet', 'go'],
            goversion: ['1.15.x'],
            dotnetversion: ['3.1.301'],
            pythonversion: ['3.7'],
            nodeversion: ['13.x'],
        },
    };
    steps = this.steps.concat([
        {
            name: 'Setup Node',
            uses: action.setupNode,
            with: {
                'node-version': '${{matrix.nodeversion}}',
                'registry-url': 'https://registry.npmjs.org',
            },
        },
        {
            name: 'Setup DotNet',
            uses: action.setupDotNet,
            with: {
                'dotnet-version': '${{matrix.dotnetverson}}',
            },
        },
        {
            name: 'Setup Python',
            uses: action.setupPython,
            with: {
                'python-version': '${{matrix.pythonversion}}',
            },
        },
        {
            name: 'Download provider + tfgen binaries',
            uses: action.downloadArtifact,
            with: {
                // eslint-disable-next-line no-template-curly-in-string
                name: '${{ env.PROVIDER }}-provider.tar.gz',
                // eslint-disable-next-line no-template-curly-in-string
                path: '${{ github.workspace }}/bin',
            },
        },
        {
            name: 'Untar provider binaries',
            run: 'tar -zxf ${{ github.workspace }}/bin/provider.tar.gz -C ${{ github.workspace }}/bin'
        },
        {
            name: 'Restore binary perms',
            // eslint-disable-next-line no-template-curly-in-string
            run: 'find ${{ github.workspace }} -name "pulumi-*-${{ env.PROVIDER }}" -print -exec chmod +x {} \\;',
        },
    ]);
}

export class BasicScaffold extends BaseJob {
    strategy = {
        'fail-fast': true,
        matrix: {
            goversion: ['1.15.x'],
            dotnetversion: ['3.1.301'],
            pythonversion: ['3.7'],
            nodeversion: ['13.x'],
        },
    };
    steps = this.steps.concat([
        {
            name: 'Setup Node',
            uses: action.setupNode,
            with: {
                'node-version': '${{matrix.nodeversion}}',
                'registry-url': 'https://registry.npmjs.org',
            },
        },
        {
            name: 'Setup DotNet',
            uses: action.setupDotNet,
            with: {
                'dotnet-version': '${{matrix.dotnetverson}}',
            },
        },
        {
            name: 'Setup Python',
            uses: action.setupPython,
            with: {
                'python-version': '${{matrix.pythonversion}}',
            },
        },
    ]);
}

export class PulumiBaseWorkflow extends g.GithubWorkflow {
    jobs: { [k: string]: job.Job }

    constructor(name: string, jobs: { [k: string]: job.Job }) {
        super(name, jobs, {
            pull_request: {branches: ['master']},
        }, {
            env,
        });

        this.jobs = {
            prerequisites: new BaseJob('prerequisites')
                .addStep(
                    {
                        name: 'Build tfgen & provider binaries',
                        run: 'make provider',
                    },
                )
                .addStep({
                    name: 'Tar provider binaries',
                    run: 'tar -zcf ${{ github.workspace }}/bin/provider.tar.gz -C ${{ github.workspace }}/bin/ pulumi-resource-${{ env.PROVIDER }} pulumi-tfgen-${{ env.PROVIDER }}',
                })
                .addStep(
                    {
                        name: 'Upload artifacts',
                        uses: action.uploadArtifact,
                        with: {
                            // eslint-disable-next-line no-template-curly-in-string
                            name: '${{ env.PROVIDER }}-provider.tar.gz',
                            // eslint-disable-next-line no-template-curly-in-string
                            path: '${{ github.workspace }}/bin/provider.tar.gz',
                        },
                    },
                )
                .addStep(
                    {
                        name: 'Notify Slack',
                        uses: action.notifySlack,
                        with: {
                            author_name: "Failure in building provider prerequisites",
                            status: '${{ job.status }}',
                            fields: 'repo,commit,author,action',
                        },
                        if: 'failure() && github.event_name == \'push\'',
                    }
                ),
            build_sdk: new MultilangJob('build_sdk', {
                needs: 'prerequisites'
            })
                .addStep({
                    name: 'Build SDK',
                    // eslint-disable-next-line no-template-curly-in-string
                    run: 'make build_${{ matrix.language }}',
                })
                .addStep({
                    name: 'Check worktree clean',
                    run: './ci-scripts/ci/check-worktree-is-clean',
                })
                .addStep({
                    name: 'Compress SDK folder',
                    run: 'tar -zcf sdk/${{ matrix.language }}.tar.gz -C sdk/${{ matrix.language }} .'
                })
                .addStep({
                    name: 'Upload artifacts',
                    uses: action.uploadArtifact,
                    with: {
                        // eslint-disable-next-line no-template-curly-in-string
                        name: '${{ matrix.language  }}-sdk.tar.gz',
                        // eslint-disable-next-line no-template-curly-in-string
                        path: '${{ github.workspace}}/sdk/${{ matrix.language }}.tar.gz',
                    },
                })
                .addStep(
                    {
                        name: 'Notify Slack',
                        uses: action.notifySlack,
                        with: {
                            author_name: "Failure in building ${{ matrix.language }} sdk",
                            status: '${{ job.status }}',
                            fields: 'repo,commit,author,action',
                        },
                        if: 'failure() && github.event_name == \'push\'',
                    }
                ),
            test: new MultilangJob('test', {needs: 'build_sdk'})
                .addStep({
                    name: 'Download SDK',
                    uses: action.downloadArtifact,
                    with: {
                        // eslint-disable-next-line no-template-curly-in-string
                        name: '${{ matrix.language  }}-sdk.tar.gz',
                        // eslint-disable-next-line no-template-curly-in-string
                        path: '${{ github.workspace}}/sdk/',
                    },
                })
                .addStep({
                    name: 'Uncompress SDK folder',
                    run: 'tar -zxf ${{ github.workspace}}/sdk/${{ matrix.language}}.tar.gz -C ${{ github.workspace}}/sdk/${{ matrix.language}}',
                })
                .addStep({
                    name: 'Update path',
                    // eslint-disable-next-line no-template-curly-in-string
                    run: 'echo "${{ github.workspace }}/bin" >> $GITHUB_PATH',
                })
                .addStep({
                    name: 'Install Python deps',
                    run: `pip3 install virtualenv==20.0.23
pip3 install pipenv`,
                })
                .addStep({
                    name: 'Install dependencies',
                    // eslint-disable-next-line no-template-curly-in-string
                    run: 'make install_${{ matrix.language}}_sdk',
                })
                .addAWS(aws)
                .addGCP(gcp)
                .addDocker(docker)
                .addSetupScript(setupScript)
                .addStep({
                    name: 'Run tests',
                    // eslint-disable-next-line no-template-curly-in-string
                    run: 'cd examples && go test -v -count=1 -cover -timeout 2h -tags=${{ matrix.language }} -parallel 4 .',
                })
                .addStep(
                    {
                        name: 'Notify Slack',
                        uses: action.notifySlack,
                        with: {
                            author_name: "Failure in running ${{ matrix.language }} tests",
                            status: '${{ job.status }}',
                            fields: 'repo,commit,author,action',
                        },
                        if: 'failure() && github.event_name == \'push\'',
                    }
                ),
        };

        if (lint) {
            this.jobs = Object.assign(this.jobs, {
                lint: new BaseJob('lint', {
                    container: 'golangci/golangci-lint:latest',
                })
                    .addStep(
                        {
                            name: 'Run golangci',
                            run: 'make lint_provider',
                        },
                    )
                    .addStep(
                        {
                            name: 'Notify Slack',
                            uses: action.notifySlack,
                            with: {
                                author_name: "Failure in linting provider",
                                status: '${{ job.status }}',
                                fields: 'repo,commit,author,action',
                            },
                            if: 'failure() && github.event_name == \'push\'',
                        }
                    ),
            }, {
                lint_sdk: new BaseJob('lint-sdk', {
                    container: 'golangci/golangci-lint:latest',
                    needs: 'build_sdk'
                })
                    .addStep(
                        {
                            name: 'Run golangci',
                            run: 'cd sdk/go/' + provider + " && golangci-lint run -c ../../../.golangci.yml",
                        },
                    )
                    .addStep(
                        {
                            name: 'Notify Slack',
                            uses: action.notifySlack,
                            with: {
                                author_name: "Failure in linting go sdk",
                                status: '${{ job.status }}',
                                fields: 'repo,commit,author,action',
                            },
                            if: 'failure() && github.event_name == \'push\'',
                        }
                    ),
            })
        }
    }
}

export class UpdatePulumiTerraformBridgeWorkflow extends g.GithubWorkflow {
    jobs: { [k: string]: job.Job }

    constructor(name: string, jobs: { [k: string]: job.Job }) {
        super(name, jobs, {
            repository_dispatch: {
                types: ['update-bridge'],
            },
        }, {
            env,
        });
        this.jobs = {
            update_bridge: new BasicScaffold('update-bridge', {})
            .addStep(
                {
                    name: 'Install Chg for changelog',
                    run: 'sudo npm install -g chg',
                },
            )
            .addStep({
                name: "Update Dependency",
                run: "cd provider && go mod edit -require github.com/pulumi/pulumi-terraform-bridge/v2@${{ github.event.client_payload.ref }} && go mod tidy && cd ../",
                "working-directory": "${{ github.workspace }}"
            })
            .addStep(
                {
                    name: "Build tfgen & provider binaries",
                    run: "make build_sdks",
                }
            )
            .addStep(
                {
                    name: "Create changelog entry",
                    run: `chg add "Upgrading pulumi-terraform-bridge to \${{ github.event.client_payload.ref }}"`
                }
            )
            .addStep(
                {
                    run: "git status"
                }
            )
            .addStep(
                {
                    name: "commit changes",
                    uses: action.addAndCommit,
                    with: {
                        ref: "update-bridge/${{ github.event.client_payload.ref }}-${{ github.run_id }}",
                        author_name: "pulumi-bot",
                        author_email: "bot@pulumi.com",
                    }
                }
            )
            .addStep(
                {
                    name: "pull-request",
                    uses: action.pullRequest,
                    with: {
                        source_branch: "update-bridge/${{ github.event.client_payload.ref }}-${{ github.run_id }}",
                        destination_branch: "master",
                        pr_title: "Upgrade to ${{ github.event.client_payload.ref }} of pulumi-terraform-bridge",
                        pr_body: "*Automated PR*",
                        pr_label: "automation/merge",
                        pr_allow_empty: true,
                        github_token: "${{ secrets.PULUMI_BOT_TOKEN }}",
                        pr_assignee: "stack72",
                        pr_reviewer: "stack72",
                    },
                    env: {
                        GITHUB_TOKEN: "${{ secrets.PULUMI_BOT_TOKEN }}"
                    }
                }
            )
        }
    }
}

export class PulumiMasterWorkflow extends PulumiBaseWorkflow {
    constructor(name: string, jobs: { [k: string]: job.Job }) {
        super(name, jobs);
        this.jobs = Object.assign(this.jobs, {
                publish_sdk: new BaseJob('publish_sdk', {needs: 'publish'})
                    .addStep({
                        name: 'Setup Node',
                        uses: action.setupNode,
                        with: {
                            'registry-url': 'https://registry.npmjs.org',
                            'always-auth': true,
                        },
                    })
                    .addStep({
                        name: 'Setup DotNet',
                        uses: action.setupDotNet,
                    })
                    .addStep({
                        name: 'Setup Python',
                        uses: action.setupPython,
                    })
                    .addStep({
                        name: 'Download Python SDK',
                        uses: action.downloadArtifact,
                        with: {
                            name: 'python-sdk.tar.gz',
                            path: '${{ github.workspace}}/sdk'
                        }
                    })
                    .addStep({
                        name: 'Unzip Python SDK',
                        run: 'tar -zxf ${{ github.workspace}}/sdk/python.tar.gz -C ${{ github.workspace}}/sdk/python',
                    })
                    .addStep({
                        name: 'Install Twine',
                        run: 'python -m pip install pip twine',
                    })
                    .addStep({
                        name: 'Download NodeJS SDK',
                        uses: action.downloadArtifact,
                        with: {
                            name: 'nodejs-sdk.tar.gz',
                            path: '${{ github.workspace}}/sdk'
                        }
                    })
                    .addStep({
                        name: 'Unzip NodeJS SDK',
                        run: 'tar -zxf ${{ github.workspace}}/sdk/nodejs.tar.gz -C ${{ github.workspace}}/sdk/nodejs',
                    })
                    .addStep({
                        name: 'Download DotNet SDK',
                        uses: action.downloadArtifact,
                        with: {
                            name: 'dotnet-sdk.tar.gz',
                            path: '${{ github.workspace}}/sdk'
                        }
                    })
                    .addStep({
                        name: 'Unzip DotNet SDK',
                        run: 'tar -zxf ${{ github.workspace}}/sdk/dotnet.tar.gz -C ${{ github.workspace}}/sdk/dotnet',
                    })
                    .addStep({
                        name: 'Publish SDKs',
                        run: './ci-scripts/ci/publish-tfgen-package ${{ github.workspace }}',
                        env: {
                            NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}'
                        }
                    })
                    .addStep(
                        {
                            name: 'Notify Slack',
                            uses: action.notifySlack,
                            with: {
                                author_name: "Failure in publishing SDK",
                                status: '${{ job.status }}',
                                fields: 'repo,commit,author,action',
                            },
                            if: 'failure() && github.event_name == \'push\'',
                        }
                    ),
            }, {
                publish: {
                    name: 'publish',
                    'runs-on': 'ubuntu-latest',
                    needs: 'test',
                    steps: [
                        {
                            name: 'Checkout Repo',
                            uses: action.checkout,
                        },
                        {
                            name: 'Unshallow clone for tags',
                            run: 'git fetch --prune --unshallow --tags',
                        },
                        {
                            name: 'Checkout Scripts Repo',
                            uses: action.checkout,
                            with: {
                                path: 'ci-scripts',
                                repository: 'pulumi/scripts',
                            },
                        },
                        {
                            name: 'Configure AWS Credentials',
                            uses: action.configureAwsCredentials,
                            with: {
                                // eslint-disable-next-line no-template-curly-in-string
                                'aws-access-key-id': '${{ secrets.AWS_ACCESS_KEY_ID }}',
                                'aws-region': 'us-east-2',
                                // eslint-disable-next-line no-template-curly-in-string
                                'aws-secret-access-key': '${{ secrets.AWS_SECRET_ACCESS_KEY }}',
                                'role-duration-seconds': 3600,
                                'role-external-id': 'upload-pulumi-release',
                                // eslint-disable-next-line no-template-curly-in-string
                                'role-session-name': '${{ env.PROVIDER}}@githubActions',
                                // eslint-disable-next-line no-template-curly-in-string
                                'role-to-assume': '${{ secrets.AWS_UPLOAD_ROLE_ARN }}',
                            },
                        },
                        {
                            name: 'Setup Go',
                            uses: action.setupGo,
                            with: {
                                'go-version': '1.15.x',
                            },
                        },
                        {
                            name: 'Install pulumictl',
                            uses: action.installPulumictl,
                            with: {
                                repo: 'pulumi/pulumictl'
                            }
                        },
                        {
                            name: 'Install Pulumi CLI',
                            uses: action.installPulumiCli,
                        },
                        {
                            name: 'Set PreRelease Version',
                            run: `echo "GORELEASER_CURRENT_TAG=v$(pulumictl get version --language generic)" >> $GITHUB_ENV`
                        },
                        {
                            name: 'Run GoReleaser',
                            uses: action.goReleaser,
                            with: {
                                args: `-p ${parallelism} -f .goreleaser.prerelease.yml --rm-dist --skip-validate`,
                                version: 'latest',
                            },
                        },
                    ],
                },
            }
        )
    }

    on = {
        workflow_dispatch: {},
        push: {
            branches: ["master"],
            'tags-ignore': ['v*', 'sdk/*', '**'],
            'paths-ignore': [
                "CHANGELOG.md"
            ]
        },
    }
}

export class PulumiReleaseWorkflow extends PulumiBaseWorkflow {
    constructor(name: string, jobs: { [k: string]: job.Job }) {
        super(name, jobs);
        this.jobs = Object.assign(this.jobs, {
            publish: {
                name: 'publish',
                'runs-on': 'ubuntu-latest',
                needs: 'test',
                steps: [
                    {
                        name: 'Checkout Repo',
                        uses: action.checkout,
                    },
                    {
                        name: 'Checkout Scripts Repo',
                        uses: action.checkout,
                        with: {
                            path: 'ci-scripts',
                            repository: 'pulumi/scripts',
                        },
                    },
                    {
                        name: 'Configure AWS Credentials',
                        uses: action.configureAwsCredentials,
                        with: {
                            // eslint-disable-next-line no-template-curly-in-string
                            'aws-access-key-id': '${{ secrets.AWS_ACCESS_KEY_ID }}',
                            'aws-region': 'us-east-2',
                            // eslint-disable-next-line no-template-curly-in-string
                            'aws-secret-access-key': '${{ secrets.AWS_SECRET_ACCESS_KEY }}',
                            'role-duration-seconds': 3600,
                            'role-external-id': 'upload-pulumi-release',
                            // eslint-disable-next-line no-template-curly-in-string
                            'role-session-name': '${{ env.PROVIDER}}@githubActions',
                            // eslint-disable-next-line no-template-curly-in-string
                            'role-to-assume': '${{ secrets.AWS_UPLOAD_ROLE_ARN }}',
                        },
                    },
                    {
                        name: 'Setup Go',
                        uses: action.setupGo,
                        with: {
                            'go-version': '1.15.x',
                        },
                    },
                    {
                        name: 'Install pulumictl',
                        uses: action.installPulumictl,
                        with: {
                            repo: 'pulumi/pulumictl'
                        }
                    },
                    {
                        name: 'Install Pulumi CLI',
                        uses: action.installPulumiCli,
                    },
                    {
                        name: 'Run GoReleaser',
                        uses: action.goReleaser,
                        with: {
                            args: `-p ${parallelism} release --rm-dist --timeout 60m0s`,
                            version: 'latest',
                        },
                    },
                ],
            },
        }, {
            publish_sdk: new BaseJob('publish_sdk', {needs: 'publish'})
                .addStep({
                    name: 'Setup Node',
                    uses: action.setupNode,
                    with: {
                        'registry-url': 'https://registry.npmjs.org',
                        'always-auth': true,
                    },
                })
                .addStep({
                    name: 'Setup DotNet',
                    uses: action.setupDotNet,
                })
                .addStep({
                    name: 'Setup Python',
                    uses: action.setupPython,
                })
                .addStep({
                    name: 'Download Python SDK',
                    uses: action.downloadArtifact,
                    with: {
                        name: 'python-sdk.tar.gz',
                        path: '${{ github.workspace}}/sdk'
                    }
                })
                .addStep({
                    name: 'Unzip Python SDK',
                    run: 'tar -zxf ${{ github.workspace}}/sdk/python.tar.gz -C ${{ github.workspace}}/sdk/python',
                })
                .addStep({
                    name: 'Install Twine',
                    run: 'python -m pip install pip twine',
                })
                .addStep({
                    name: 'Download NodeJS SDK',
                    uses: action.downloadArtifact,
                    with: {
                        name: 'nodejs-sdk.tar.gz',
                        path: '${{ github.workspace}}/sdk'
                    }
                })
                .addStep({
                    name: 'Unzip NodeJS SDK',
                    run: 'tar -zxf ${{ github.workspace}}/sdk/nodejs.tar.gz -C ${{ github.workspace}}/sdk/nodejs',
                })
                .addStep({
                    name: 'Download DotNet SDK',
                    uses: action.downloadArtifact,
                    with: {
                        name: 'dotnet-sdk.tar.gz',
                        path: '${{ github.workspace}}/sdk'
                    }
                })
                .addStep({
                    name: 'Unzip DotNet SDK',
                    run: 'tar -zxf ${{ github.workspace}}/sdk/dotnet.tar.gz -C ${{ github.workspace}}/sdk/dotnet',
                })
                .addStep({
                    name: 'Publish SDKs',
                    run: './ci-scripts/ci/publish-tfgen-package ${{ github.workspace }}',
                    env: {
                        NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}'
                    }
                })
                .addStep(
                    {
                        name: 'Notify Slack',
                        uses: action.notifySlack,
                        with: {
                            author_name: "Failure in publishing SDK",
                            status: '${{ job.status }}',
                            fields: 'repo,commit,author,action',
                        },
                        if: 'failure() && github.event_name == \'push\'',
                    }
                ),
        }, {
            create_docs_build: {
                name: "Create docs build",
                'runs-on': 'ubuntu-latest',
                needs: 'publish_sdk',
                steps: [{
                    name: 'Install pulumictl',
                    uses: action.installPulumictl,
                    with: {
                        repo: 'pulumi/pulumictl',
                    },
                }, {
                    name: 'Dispatch event',
                    run: 'pulumictl create docs-build pulumi-${{ env.PROVIDER }} ${GITHUB_REF#refs/tags/}',
                    env: {
                        GITHUB_TOKEN: '${{ secrets.PULUMI_BOT_TOKEN }}'
                    }

                }],
            },

        });

        if (triggerReleaseSmokeTest) {
            this.jobs = Object.assign(this.jobs, {
                smoke_test_deployment: {
                    name: 'smoke-test-deployment',
                    'runs-on': 'ubuntu-latest',
                    needs: 'publish_sdk',
                    steps: [
                        {
                            name: 'Checkout Repo',
                            uses: action.checkout,
                        },
                        {
                            name: 'Install pulumictl',
                            uses: action.installPulumictl,
                            with: {
                                repo: 'pulumi/pulumictl'
                            }
                        },
                        {
                            name: 'Trigger Smoke Tests',
                            run: 'pulumictl dispatch -r pulumi/examples -c run-example-tests-command $(pulumictl get version --language generic -o)',
                            env: {
                                'GITHUB_TOKEN': '${{ secrets.PULUMI_BOT_TOKEN}}'
                            },
                        },
                    ],
                },
            })
        }
    }

    on = {
        push: {tags: ['v*.*.*']},
    }
}

export class PulumiPreReleaseWorkflow extends PulumiBaseWorkflow {
    constructor(name: string, jobs: { [k: string]: job.Job }) {
        super(name, jobs);
        this.jobs = Object.assign(this.jobs, {
            publish: {
                needs: 'test',
                'runs-on': 'ubuntu-latest',
                steps: [
                    {
                        name: 'Checkout Repo',
                        uses: action.checkout,
                    },
                    {
                        name: 'Checkout Scripts Repo',
                        uses: action.checkout,
                        with: {
                            path: 'ci-scripts',
                            repository: 'pulumi/scripts',
                        },
                    },
                    {
                        name: 'Configure AWS Credentials',
                        uses: action.configureAwsCredentials,
                        with: {
                            // eslint-disable-next-line no-template-curly-in-string
                            'aws-access-key-id': '${{ secrets.AWS_ACCESS_KEY_ID }}',
                            'aws-region': 'us-east-2',
                            // eslint-disable-next-line no-template-curly-in-string
                            'aws-secret-access-key': '${{ secrets.AWS_SECRET_ACCESS_KEY }}',
                            'role-duration-seconds': '3600',
                            'role-external-id': 'upload-pulumi-release',
                            // eslint-disable-next-line no-template-curly-in-string
                            'role-session-name': '${{ env.PROVIDER}}@githubActions',
                            // eslint-disable-next-line no-template-curly-in-string
                            'role-to-assume': '${{ secrets.AWS_UPLOAD_ROLE_ARN }}',
                        },
                    },
                    {
                        name: 'Setup Go',
                        uses: action.setupGo,
                        with: {
                            'go-version': '1.15.x',
                        },
                    },
                    {
                        name: 'Run GoReleaser',
                        uses: action.goReleaser,
                        with: {
                            args: `-p ${parallelism} release --rm-dist --config=.goreleaser.prerelease.yaml  --timeout 60m0s`,
                            version: 'latest',
                        },
                    },
                ],
            },
        }, {
            publish_sdk: new BaseJob('publish_sdk', {needs: 'publish'})
                .addStep({
                    name: 'Setup Node',
                    uses: action.setupNode,
                    with: {
                        'registry-url': 'https://registry.npmjs.org',
                        'always-auth': true,
                    },
                })
                .addStep({
                    name: 'Setup DotNet',
                    uses: action.setupDotNet,
                })
                .addStep({
                    name: 'Setup Python',
                    uses: action.setupPython,
                })
                .addStep({
                    name: 'Download Python SDK',
                    uses: action.downloadArtifact,
                    with: {
                        name: 'python-sdk.tar.gz',
                        path: '${{ github.workspace}}/sdk'
                    }
                })
                .addStep({
                    name: 'Unzip Python SDK',
                    run: 'tar -zxf ${{ github.workspace}}/sdk/python.tar.gz -C ${{ github.workspace}}/sdk/python',
                })
                .addStep({
                    name: 'Install Twine',
                    run: 'python -m pip install pip twine',
                })
                .addStep({
                    name: 'Download NodeJS SDK',
                    uses: action.downloadArtifact,
                    with: {
                        name: 'nodejs-sdk.tar.gz',
                        path: '${{ github.workspace}}/sdk'
                    }
                })
                .addStep({
                    name: 'Unzip NodeJS SDK',
                    run: 'tar -zxf ${{ github.workspace}}/sdk/nodejs.tar.gz -C ${{ github.workspace}}/sdk/nodejs',
                })
                .addStep({
                    name: 'Download DotNet SDK',
                    uses: action.downloadArtifact,
                    with: {
                        name: 'dotnet-sdk.tar.gz',
                        path: '${{ github.workspace}}/sdk'
                    }
                })
                .addStep({
                    name: 'Unzip DotNet SDK',
                    run: 'tar -zxf ${{ github.workspace}}/sdk/dotnet.tar.gz -C ${{ github.workspace}}/sdk/dotnet',
                })
                .addStep({
                    name: 'Publish SDKs',
                    run: './ci-scripts/ci/publish-tfgen-package ${{ github.workspace }}',
                    env: {
                        NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}'
                    }
                })
                .addStep(
                    {
                        name: 'Notify Slack',
                        uses: action.notifySlack,
                        with: {
                            author_name: "Failure in publishing SDK",
                            status: '${{ job.status }}',
                            fields: 'repo,commit,author,action',
                        },
                        if: 'failure() && github.event_name == \'push\'',
                    }
                ),
        });
    }

    on = {
        push: {
            tags: ['v*.*.*-**'],
        },
    }
}

export class PulumiArtifactCleanupWorkflow {
    name = 'cleanup';
    on = {
        schedule: [{
            "cron": "0 1 * * *",
        }]
    }
    jobs = {
        'remove-old-artifacts': {
            'runs-on': 'ubuntu-latest',
            steps: [
                {
                    name: 'Remove old artifacts',
                    uses: action.cleanupArtifact,
                    with: {
                        age: '1 month',
                        'skip-tags': true,
                    }
                }
            ]
        }
    }
}

export class PulumiAutomationWorkflow {
    name = 'pr-automation';
    on = {
        'pull_request': {
            'types': [
                'labeled',
                'unlabeled',
                'synchronize',
                'opened',
                'edited',
                'ready_for_review',
                'reopened',
                'unlocked',
            ]
        },
        'pull_request_review': {
            'types': [
                'submitted',
            ]
        },
        'check_suite': {
            'types': [
                'completed',
            ]
        },
        status: {}
    }
    jobs = {
        'automerge': {
            name: 'automerge labelled pull-requests',
            'runs-on': 'ubuntu-latest',
            steps: [
                {
                    name: 'Automerge',
                    uses: action.automerge,
                    env: {
                        GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
                        MERGE_LABELS: "automation/merge,impact/no-changelog-required",
                        MERGE_REMOVE_LABELS: "automation/merge",
                        MERGE_METHOD: "squash",
                        MERGE_COMMIT_MESSAGE: "pull-request-title",
                        MERGE_FORKS: "false",
                        MERGE_RETRIES: "30",
                        MERGE_RETRY_SLEEP: "60000",
                        UPDATE_LABELS: "automation/update",
                        UPDATE_METHOD: "rebase",
                    }
                }
            ]
        }
    }
}

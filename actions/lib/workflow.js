import * as g from '@jaxxstorm/gh-actions';
import * as job from '@jaxxstorm/gh-actions/lib/job';
import * as param from '@jkcfg/std/param';
const provider = param.String('provider');
const extraEnv = param.Object('env');
const docker = param.Boolean('docker');
const setupScript = param.String('setup-script');
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
    constructor(name, params) {
        super();
        this.steps = [
            {
                name: 'Checkout Repo',
                uses: 'actions/checkout@v2',
            },
            {
                name: 'Checkout Scripts Repo',
                uses: 'actions/checkout@v2',
                with: {
                    path: 'ci-scripts',
                    repository: 'pulumi/scripts',
                },
            },
            {
                name: 'Unshallow clone for tags',
                run: 'git fetch --prune --unshallow',
            },
            {
                name: 'Install Go',
                uses: 'actions/setup-go@v2',
                with: {
                    'go-version': '${{ matrix.goversion }}',
                },
            },
            {
                name: 'Install pulumictl',
                uses: 'jaxxstorm/action-install-gh-release@release/v1-alpha',
                with: {
                    repo: 'pulumi/pulumictl',
                },
            },
            {
                name: 'Install Pulumi CLI',
                uses: 'pulumi/action-install-pulumi-cli@releases/v1',
            },
        ];
        this['runs-on'] = 'ubuntu-latest';
        this.name = name;
        Object.assign(this, { name }, params);
    }
    addStep(step) {
        this.steps.push(step);
        return this;
    }
    addDocker(docker) {
        if (docker) {
            this.steps.push({
                name: 'Run docker-compose',
                run: 'docker-compose -f testing/docker-compose.yml up --build -d'
            });
        }
        return this;
    }
    addSetupScript(setupScript) {
        if (setupScript) {
            this.steps.push({
                name: 'Run setup script',
                run: `${setupScript}`,
            });
        }
        return this;
    }
}
export class MultilangJob extends BaseJob {
    constructor() {
        super(...arguments);
        this.strategy = {
            'fail-fast': true,
            matrix: {
                language: ['nodejs', 'python', 'dotnet', 'go'],
                goversion: ['1.14.x'],
                dotnetversion: ['3.1.201'],
                pythonversion: ['3.7'],
                nodeversion: ['13.x'],
            },
        };
        this.steps = this.steps.concat([
            {
                name: 'Setup Node',
                uses: 'actions/setup-node@v1',
                with: {
                    'node-version': '${{matrix.nodeversion}}',
                    'registry-url': 'https://registry.npmjs.org',
                },
            },
            {
                name: 'Setup DotNet',
                uses: 'actions/setup-dotnet@v1',
                with: {
                    'dotnet-version': '${{matrix.dotnetverson}}',
                },
            },
            {
                name: 'Setup Python',
                uses: 'actions/setup-python@v1',
                with: {
                    'python-version': '${{matrix.pythonversion}}',
                },
            },
            {
                name: 'Download provider + tfgen binaries',
                uses: 'actions/download-artifact@v2',
                with: {
                    // eslint-disable-next-line no-template-curly-in-string
                    name: 'pulumi-${{ env.PROVIDER }}',
                    // eslint-disable-next-line no-template-curly-in-string
                    path: '${{ github.workspace }}/bin',
                },
            },
            {
                name: 'Restore binary perms',
                // eslint-disable-next-line no-template-curly-in-string
                run: 'find ${{ github.workspace }} -name "pulumi-*-${{ env.PROVIDER }}" -print -exec chmod +x {} \\;',
            },
        ]);
    }
}
export class PulumiBaseWorkflow extends g.GithubWorkflow {
    constructor(name, jobs) {
        super(name, jobs, {
            pull_request: { branches: ['master'] },
        }, {
            env,
        });
        this.jobs = {
            lint: new BaseJob('lint', {
                container: 'golangci/golangci-lint:latest'
            })
                .addStep({
                name: 'Run golangci',
                run: 'make -f Makefile.github lint_provider',
            })
                .addStep({
                name: 'Notify Slack',
                uses: '8398a7/action-slack@v3',
                with: {
                    status: '${{ job.status }}',
                    fields: 'repo,commit,author',
                },
                if: '!success()',
            }),
            prerequisites: new BaseJob('prerequisites')
                .addStep({
                name: 'Build tfgen & provider binaries',
                run: 'make -f Makefile.github provider',
            })
                .addStep({
                name: 'Upload artifacts',
                uses: 'actions/upload-artifact@v2',
                with: {
                    // eslint-disable-next-line no-template-curly-in-string
                    name: 'pulumi-${{ env.PROVIDER }}',
                    // eslint-disable-next-line no-template-curly-in-string
                    path: '${{ github.workspace }}/bin',
                },
            })
                .addStep({
                name: 'Notify Slack',
                uses: '8398a7/action-slack@v3',
                with: {
                    status: '${{ job.status }}',
                    fields: 'repo,commit,author',
                },
                if: '!success()',
            }),
            build_sdk: new MultilangJob('build_sdk', {
                needs: 'prerequisites'
            })
                .addStep({
                name: 'Build SDK',
                // eslint-disable-next-line no-template-curly-in-string
                run: 'make -f Makefile.github build_${{ matrix.language }}',
            })
                .addStep({
                name: 'Check worktree clean',
                run: './ci-scripts/ci/check-worktree-is-clean',
            })
                .addStep({
                name: 'Upload artifacts',
                uses: 'actions/upload-artifact@v2',
                with: {
                    // eslint-disable-next-line no-template-curly-in-string
                    name: '${{ matrix.language  }}-sdk',
                    // eslint-disable-next-line no-template-curly-in-string
                    path: '${{ github.workspace}}/sdk/${{ matrix.language }}',
                },
            })
                .addStep({
                name: 'Notify Slack',
                uses: '8398a7/action-slack@v3',
                with: {
                    status: '${{ job.status }}',
                    fields: 'repo,commit,author',
                },
                if: '!success()',
            }),
            lint_sdk: new BaseJob('lint-sdk', {
                container: 'golangci/golangci-lint:latest',
                needs: 'build_sdk'
            })
                .addStep({
                name: 'Run golangci',
                run: 'cd sdk/go/' + provider + " && golangci-lint run -c ../../../.golangci.yml",
            })
                .addStep({
                name: 'Notify Slack',
                uses: '8398a7/action-slack@v3',
                with: {
                    status: '${{ job.status }}',
                    fields: 'repo,commit,author',
                },
                if: '!success()',
            }),
            test: new MultilangJob('test', { needs: 'build_sdk' })
                .addStep({
                name: 'Download SDK',
                uses: 'actions/download-artifact@v2',
                with: {
                    // eslint-disable-next-line no-template-curly-in-string
                    name: '${{ matrix.language  }}-sdk',
                    // eslint-disable-next-line no-template-curly-in-string
                    path: '${{ github.workspace}}/sdk/${{ matrix.language }}',
                },
            })
                .addStep({
                name: 'Update path',
                // eslint-disable-next-line no-template-curly-in-string
                run: 'echo ::add-path::${{ github.workspace }}/bin',
            })
                .addStep({
                name: 'Install pipenv',
                uses: 'dschep/install-pipenv-action@v1',
            })
                .addStep({
                name: 'Install dependencies',
                // eslint-disable-next-line no-template-curly-in-string
                run: 'make -f Makefile.github install_${{ matrix.language}}_sdk',
            })
                .addDocker(docker)
                .addSetupScript(setupScript)
                .addStep({
                name: 'Run tests',
                // eslint-disable-next-line no-template-curly-in-string
                run: 'cd examples && go test -v -count=1 -cover -timeout 2h -tags=${{ matrix.language }} -parallel 4 .',
            })
                .addStep({
                name: 'Notify Slack',
                uses: '8398a7/action-slack@v3',
                with: {
                    status: '${{ job.status }}',
                    fields: 'repo,commit,author',
                },
                if: '!success()',
            }),
        };
    }
}
export class PulumiMasterWorkflow extends PulumiBaseWorkflow {
    constructor(name, jobs) {
        super(name, jobs);
        this.on = {
            push: {
                branches: ["master"],
                'tags-ignore': ['*']
            },
        };
        this.jobs = Object.assign(this.jobs, {
            publish_sdk: new BaseJob('publish_sdk', { needs: 'test' })
                .addStep({
                name: 'Setup Node',
                uses: 'actions/setup-node@v1',
                with: {
                    'registry-url': 'https://registry.npmjs.org',
                    'always-auth': true,
                },
            })
                .addStep({
                name: 'Setup DotNet',
                uses: 'actions/setup-dotnet@v1',
            })
                .addStep({
                name: 'Setup Python',
                uses: 'actions/setup-python@v1',
            })
                .addStep({
                name: 'Download Python SDK',
                uses: 'actions/download-artifact@v2',
                with: {
                    name: 'python-sdk',
                    path: '${{ github.workspace}}/sdk/python'
                }
            })
                .addStep({
                name: 'Install Twine',
                run: 'python -m pip install pip twine',
            })
                .addStep({
                name: 'Download NodeJS SDK',
                uses: 'actions/download-artifact@v2',
                with: {
                    name: 'nodejs-sdk',
                    path: '${{ github.workspace}}/sdk/nodejs'
                }
            })
                .addStep({
                name: 'Download DotNet SDK',
                uses: 'actions/download-artifact@v2',
                with: {
                    name: 'dotnet-sdk',
                    path: '${{ github.workspace}}/sdk/dotnet'
                }
            })
                .addStep({
                name: 'Publish SDKs',
                run: './ci-scripts/ci/publish-tfgen-package ${{ github.workspace }}',
                env: {
                    NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}'
                }
            })
                .addStep({
                name: 'Notify Slack',
                uses: '8398a7/action-slack@v3',
                with: {
                    status: '${{ job.status }}',
                    fields: 'repo,commit,author',
                },
                if: '!success()',
            }),
        });
    }
}
export class PulumiReleaseWorkflow extends PulumiBaseWorkflow {
    constructor(name, jobs) {
        super(name, jobs);
        this.on = {
            push: { tags: ['v*.*.*'] },
        };
        this.jobs = Object.assign(this.jobs, {
            publish: {
                name: 'publish',
                'runs-on': 'ubuntu-latest',
                needs: 'test',
                steps: [
                    {
                        name: 'Checkout Repo',
                        uses: 'actions/checkout@v2',
                    },
                    {
                        name: 'Checkout Scripts Repo',
                        uses: 'actions/checkout@v2',
                        with: {
                            path: 'ci-scripts',
                            repository: 'pulumi/scripts',
                        },
                    },
                    {
                        name: 'Configure AWS Credentials',
                        uses: 'aws-actions/configure-aws-credentials@v1',
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
                        uses: 'actions/setup-go@v2',
                        with: {
                            'go-version': '${{ matrix.goversion }}',
                        },
                    },
                    {
                        name: 'Install pulumictl',
                        uses: 'jaxxstorm/action-install-gh-release@release/v1-alpha',
                        with: {
                            repo: 'pulumi/pulumictl'
                        }
                    },
                    {
                        name: 'Install Pulumi CLI',
                        uses: 'pulumi/action-install-pulumi-cli@releases/v1',
                    },
                    {
                        name: 'Run GoReleaser',
                        uses: 'goreleaser/goreleaser-action@v2',
                        with: {
                            args: 'release --rm-dist',
                            version: 'latest',
                        },
                    },
                ],
            },
        }, {
            publish_sdk: new BaseJob('publish_sdk', { needs: 'publish' })
                .addStep({
                name: 'Setup Node',
                uses: 'actions/setup-node@v1',
                with: {
                    'registry-url': 'https://registry.npmjs.org',
                    'always-auth': true,
                },
            })
                .addStep({
                name: 'Setup DotNet',
                uses: 'actions/setup-dotnet@v1',
            })
                .addStep({
                name: 'Setup Python',
                uses: 'actions/setup-python@v1',
            })
                .addStep({
                name: 'Download Python SDK',
                uses: 'actions/download-artifact@v2',
                with: {
                    name: 'python-sdk',
                    path: '${{ github.workspace}}/sdk/python'
                }
            })
                .addStep({
                name: 'Install Twine',
                run: 'python -m pip install pip twine',
            })
                .addStep({
                name: 'Download NodeJS SDK',
                uses: 'actions/download-artifact@v2',
                with: {
                    name: 'nodejs-sdk',
                    path: '${{ github.workspace}}/sdk/nodejs'
                }
            })
                .addStep({
                name: 'Download DotNet SDK',
                uses: 'actions/download-artifact@v2',
                with: {
                    name: 'dotnet-sdk',
                    path: '${{ github.workspace}}/sdk/dotnet'
                }
            })
                .addStep({
                name: 'Publish SDKs',
                run: './ci-scripts/ci/publish-tfgen-package ${{ github.workspace }}',
                env: {
                    NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}'
                }
            })
                .addStep({
                name: 'Notify Slack',
                uses: '8398a7/action-slack@v3',
                with: {
                    status: '${{ job.status }}',
                    fields: 'repo,commit,author',
                },
                if: '!success()',
            }),
        }, {
            create_docs_build: {
                name: "Create docs build",
                'runs-on': 'ubuntu-latest',
                needs: 'publish_sdk',
                steps: [{
                        name: 'Install pulumictl',
                        uses: 'jaxxstorm/action-install-gh-release@release/v1-alpha',
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
            }
        });
    }
}
export class PulumiPreReleaseWorkflow extends PulumiBaseWorkflow {
    constructor(name, jobs) {
        super(name, jobs);
        this.on = {
            push: { tags: ['v*.*.*-**'] },
        };
        this.jobs = Object.assign(this.jobs, {
            publish: {
                needs: 'test',
                'runs-on': 'ubuntu-latest',
                steps: [
                    {
                        name: 'Checkout Repo',
                        uses: 'actions/checkout@v2',
                    },
                    {
                        name: 'Checkout Scripts Repo',
                        uses: 'actions/checkout@v2',
                        with: {
                            path: 'ci-scripts',
                            repository: 'pulumi/scripts',
                        },
                    },
                    {
                        name: 'Configure AWS Credentials',
                        uses: 'aws-actions/configure-aws-credentials@v1',
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
                        uses: 'actions/setup-go@v2',
                        with: {
                            'go-version': '${{ matrix.goversion }}',
                        },
                    },
                    {
                        name: 'Run GoReleaser',
                        uses: 'goreleaser/goreleaser-action@v2',
                        with: {
                            args: 'release --rm-dist --config=.goreleaser.prerelease.yaml',
                            version: 'latest',
                        },
                    },
                ],
            },
        }, {
            publish_sdk: new BaseJob('publish_sdk', { needs: 'publish' })
                .addStep({
                name: 'Setup Node',
                uses: 'actions/setup-node@v1',
                with: {
                    'registry-url': 'https://registry.npmjs.org',
                    'always-auth': true,
                },
            })
                .addStep({
                name: 'Setup DotNet',
                uses: 'actions/setup-dotnet@v1',
            })
                .addStep({
                name: 'Setup Python',
                uses: 'actions/setup-python@v1',
            })
                .addStep({
                name: 'Download Python SDK',
                uses: 'actions/download-artifact@v2',
                with: {
                    name: 'python-sdk',
                    path: '${{ github.workspace}}/sdk/python'
                }
            })
                .addStep({
                name: 'Install Twine',
                run: 'python -m pip install pip twine',
            })
                .addStep({
                name: 'Download NodeJS SDK',
                uses: 'actions/download-artifact@v2',
                with: {
                    name: 'nodejs-sdk',
                    path: '${{ github.workspace}}/sdk/nodejs'
                }
            })
                .addStep({
                name: 'Download DotNet SDK',
                uses: 'actions/download-artifact@v2',
                with: {
                    name: 'dotnet-sdk',
                    path: '${{ github.workspace}}/sdk/dotnet'
                }
            })
                .addStep({
                name: 'Publish SDKs',
                run: './ci-scripts/ci/publish-tfgen-package ${{ github.workspace }}',
                env: {
                    NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}'
                }
            })
                .addStep({
                name: 'Notify Slack',
                uses: '8398a7/action-slack@v3',
                with: {
                    status: '${{ job.status }}',
                    fields: 'repo,commit,author',
                },
                if: '!success()',
            }),
        });
    }
}
export class PulumiAutomationWorkflow {
    constructor() {
        this.env = {
            GITHUB_TOKEN: '${{ secrets.PULUMI_BOT_TOKEN }}'
        };
        this.name = 'pr-automation';
        this.on = {
            push: {
                branches: ['pulumi-automation', 'automation/pulumi-provider-ci']
            }
        };
        this.jobs = {
            'open-pull-request': {
                name: 'open pull request for ci changes',
                'runs-on': 'ubuntu-latest',
                steps: [
                    {
                        name: 'Checkout Repo',
                        uses: 'actions/checkout@v2'
                    },
                    {
                        name: 'Create Pull Request',
                        uses: 'repo-sync/pull-request@v2',
                        with: {
                            github_token: '${{ secrets.PULUMI_BOT_TOKEN }}',
                            pr_title: "🤖 automated pull-request from pulumi",
                            pr_body: "🚀 This PR has been opened because changes have been pushed to ${{ github.ref }}, please review them carefully!",
                            pr_reviewer: "jaxxstorm,stack72",
                            pr_label: "automation/pull-request,impact/no-changelog-required",
                        }
                    }
                ]
            }
        };
    }
}

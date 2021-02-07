import * as g from '@jaxxstorm/gh-actions';
import * as job from '@jaxxstorm/gh-actions/lib/job';
import * as param from '@jkcfg/std/param';
const extraEnv = param.Object('env');
const env = Object.assign({
    PULUMI_TEST_OWNER: 'moolumi',
    PULUMI_ACCESS_TOKEN: '${{ secrets.PULUMI_ACCESS_TOKEN }}',
    PULUMI_API: 'https://api.pulumi-staging.io',
    SLACK_WEBHOOK_URL: '${{ secrets.SLACK_WEBHOOK_URL }}',
    AWS_ACCESS_KEY_ID: ' ${{ secrets.AWS_ACCESS_KEY_ID }}',
    AWS_SECRET_ACCESS_KEY: '${{ secrets.AWS_SECRET_ACCESS_KEY }}',
    AWS_REGION: 'us-west-2',
    ARM_CLIENT_ID: '${{ secrets.ARM_CLIENT_ID }}',
    ARM_CLIENT_SECRET: '${{ secrets.ARM_CLIENT_SECRET }}',
    ARM_SUBSCRIPTION_ID: '${{ secrets.ARM_SUBSCRIPTION_ID }}',
    ARM_TENANT_ID: '${{ secrets.ARM_TENANT_ID }}',
    ARM_ENVIRONMENT: "public",
    ARM_LOCATION: "westus",
    DIGITALOCEAN_TOKEN: '${{ secrets.DIGITALOCEAN_TOKEN }}',
    CLOUDSDK_CORE_DISABLE_PROMPTS: 1,
    GOOGLE_CREDENTIALS: '${{ secrets.GCP_CREDENTIALS }}',
    GOOGLE_PROJECT: '${{ secrets.GCP_PROJECT_ID }}',
    GOOGLE_REGION: "us-central1",
    GOOGLE_ZONE: "us-central1-a",
    PACKET_AUTH_TOKEN: '${{ secrets.PACKET_AUTH_TOKEN }}',
}, extraEnv);
export class Linting extends job.Job {
    constructor(name, params) {
        super();
        this.strategy = {
            'fail-fast': false,
            matrix: {
                'yarn-version': ['1.13.0'],
                'node-version': ['14.x'],
                platform: ['ubuntu-latest'],
            },
        };
        this['runs-on'] = '${{ matrix.platform }}';
        this.steps = [
            {
                uses: 'actions/checkout@v2',
            },
            {
                name: 'Install Node.js ${{ matrix.node-version }}',
                uses: 'actions/setup-node@v1',
                with: {
                    'node-version': '${{matrix.node-version}}',
                },
            },
            {
                name: 'Install Yarn',
                run: 'curl -o- -L https://yarnpkg.com/install.sh | bash -s -- --version ${{ matrix.yarn-version }}',
            },
            {
                name: 'Update PATH for Yarn',
                run: 'echo "$HOME/.yarn/bin" >> $GITHUB_PATH\n' +
                    'echo "$HOME/.config/yarn/global/node_modules/.bin" >> $GITHUB_PATH',
            },
            {
                name: 'Setup linting tool',
                run: 'make install'
            },
            {
                name: 'Lint typescript files',
                run: 'make lint',
            },
        ];
        this.name = name;
        Object.assign(this, { name }, params);
    }
    addDispatchConditional(isWorkflowDispatch) {
        if (isWorkflowDispatch) {
            this.if = "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository";
        }
        return this;
    }
}
export class CommentOnPrJob extends job.Job {
    constructor(name, params) {
        super();
        this['runs-on'] = 'ubuntu-latest';
        this.if = "github.event.pull_request.head.repo.full_name != github.repository";
        this.steps = [
            {
                uses: 'actions/checkout@v2',
            },
            {
                name: 'Comment PR',
                uses: 'thollander/actions-comment-pull-request@1.0.1',
                with: {
                    'message': "PR is now waiting for a maintainer to run the acceptance tests.\n\n" +
                        "**Note for the maintainer:** To run the acceptance tests, please comment */run-example-tests* on the PR",
                    'GITHUB_TOKEN': '${{ secrets.GITHUB_TOKEN }}'
                },
            },
        ];
        this.name = name;
        Object.assign(this, { name }, params);
    }
}
export class ResultsCommentJob extends job.Job {
    constructor(name, params) {
        super();
        this['runs-on'] = 'ubuntu-latest';
        this.if = 'github.event_name == \'repository_dispatch\'';
        this.steps = [
            {
                name: 'Create URL to the run output',
                id: 'vars',
                run: 'echo ::set-output name=run-url::https://github.com/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID'
            },
            {
                name: 'Update with Result',
                uses: 'peter-evans/create-or-update-comment@v1',
                with: {
                    token: '${{ secrets.GITHUB_TOKEN }}',
                    repository: '${{ github.event.client_payload.github.payload.repository.full_name }}',
                    'issue-number': '${{ github.event.client_payload.github.payload.issue.number }}',
                    'body': "Please view the results of the PR Build [Here][1]\n\n" +
                        "[1]: ${{ steps.vars.outputs.run-url }}",
                },
            },
        ];
        this.name = name;
        Object.assign(this, { name }, params);
    }
}
export class EnvironmentSetup extends job.Job {
    constructor(name, params, isCommandDispatch) {
        super();
        this.steps = [
            {
                name: 'Install DotNet ${{ matrix.dotnet-version }}',
                uses: 'actions/setup-dotnet@v1',
                with: {
                    'dotnet-version': '${{matrix.dotnet-version}}',
                },
            },
            {
                name: 'Install Node.js ${{ matrix.node-version }}',
                uses: 'actions/setup-node@v1',
                with: {
                    'node-version': '${{matrix.node-version}}',
                },
            },
            {
                name: 'Install Python ${{ matrix.python-version }}',
                uses: 'actions/setup-python@v1',
                with: {
                    'python-version': '${{matrix.python-version}}',
                },
            },
            {
                name: 'Install Go ${{ matrix.go-version }}',
                uses: 'actions/setup-go@v1',
                with: {
                    'go-version': '${{matrix.go-version}}',
                },
            },
            {
                name: 'Install Python Deps',
                run: "pip3 install virtualenv==20.0.23\n" +
                    "pip3 install pipenv",
            },
            {
                name: 'Install aws-iam-authenticator',
                run: "curl -o aws-iam-authenticator https://amazon-eks.s3-us-west-2.amazonaws.com/1.13.7/2019-06-11/bin/linux/amd64/aws-iam-authenticator\n" +
                    "chmod +x ./aws-iam-authenticator\n" +
                    "sudo mv aws-iam-authenticator /usr/local/bin",
            },
            {
                name: 'Install Kubectl',
                run: "curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl\n" +
                    "chmod +x ./kubectl\n" +
                    "sudo mv kubectl /usr/local/bin",
            },
            {
                name: 'Install + Configure Helm',
                run: "curl -o- -L https://raw.githubusercontent.com/kubernetes/helm/master/scripts/get | bash\n" +
                    "helm init -c\n" +
                    "helm repo add bitnami https://charts.bitnami.com/bitnami",
            },
            {
                name: 'Configure GCP credentials',
                uses: 'GoogleCloudPlatform/github-actions/setup-gcloud@master',
                with: {
                    'version': '285.0.0',
                    'project_id': '${{ env.GOOGLE_PROJECT }}',
                    'service_account_email': '${{ secrets.GCP_SA_EMAIL }}',
                    'service_account_key': '${{ secrets.GCP_SA_KEY }}',
                }
            },
            {
                name: 'Login to Google Cloud Registry',
                run: 'gcloud --quiet auth configure-docker',
            },
            {
                name: 'Configure AWS Credentials',
                uses: 'aws-actions/configure-aws-credentials@v1',
                with: {
                    'aws-access-key-id': '${{ secrets.AWS_ACCESS_KEY_ID }}',
                    'aws-region': '${{ env.AWS_REGION }}',
                    'aws-secret-access-key': '${{ secrets.AWS_SECRET_ACCESS_KEY }}',
                    'role-duration-seconds': 3600,
                    'role-session-name': 'examples@githubActions',
                    'role-to-assume': '${{ secrets.AWS_CI_ROLE_ARN }}',
                }
            },
            {
                uses: 'actions/checkout@v2',
            },
            {
                name: 'Checkout Scripts Repo',
                uses: 'actions/checkout@v2',
                with: {
                    path: 'ci-scripts',
                    repository: 'pulumi/scripts',
                },
            }
        ];
        this.name = name;
        Object.assign(this, { name }, params);
    }
    addStep(step) {
        this.steps.push(step);
        return this;
    }
    addDispatchConditional(isWorkflowDispatch) {
        if (isWorkflowDispatch) {
            this.if = "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository";
        }
        return this;
    }
}
export class TestInfraSetup extends EnvironmentSetup {
    constructor() {
        super(...arguments);
        this.strategy = {
            'fail-fast': false,
            matrix: {
                'go-version': ['1.15.x'],
                'dotnet-version': ['3.1.301'],
                'python-version': ['3.7'],
                'node-version': ['13.x'],
                platform: ['ubuntu-latest'],
            },
        };
        this['runs-on'] = '${{ matrix.platform }}';
        this.steps = this.steps.concat([
            {
                name: 'Install Latest Stable Pulumi CLI',
                uses: 'pulumi/action-install-pulumi-cli@v1.0.1'
            },
            {
                run: "echo \"Currently Pulumi $(pulumi version) is installed\"",
            },
            {
                name: "Create Test Infrastructure",
                run: "make setup_test_infra StackName=\"${{ env.PULUMI_TEST_OWNER }}/${{ github.sha }}-${{ github.run_number }}\""
            }
        ]);
    }
}
export class ConditionalTestInfraSetup extends EnvironmentSetup {
    constructor() {
        super(...arguments);
        this.strategy = {
            'fail-fast': false,
            matrix: {
                'go-version': ['1.15.x'],
                'dotnet-version': ['3.1.301'],
                'python-version': ['3.7'],
                'node-version': ['13.x'],
                platform: ['ubuntu-latest'],
            },
        };
        this['runs-on'] = '${{ matrix.platform }}';
        this.steps = this.steps.concat([
            {
                name: 'Install Latest Stable Pulumi CLI',
                uses: 'pulumi/action-install-pulumi-cli@v1.0.1'
            },
            {
                run: "echo \"Currently Pulumi $(pulumi version) is installed\"",
            },
            {
                name: "Create Test Infrastructure",
                run: "make setup_test_infra StackName=\"${{ env.PULUMI_TEST_OWNER }}/${{ github.sha }}-${{ github.run_number }}\""
            }
        ]);
    }
}
export class TestInfraDestroy extends EnvironmentSetup {
    constructor() {
        super(...arguments);
        this.strategy = {
            'fail-fast': false,
            matrix: {
                'go-version': ['1.15.x'],
                'dotnet-version': ['3.1.301'],
                'python-version': ['3.7'],
                'node-version': ['13.x'],
                platform: ['ubuntu-latest'],
            },
        };
        this['runs-on'] = '${{ matrix.platform }}';
        this.needs = "kubernetes";
        this.steps = this.steps.concat([
            {
                name: 'Install Latest Stable Pulumi CLI',
                uses: 'pulumi/action-install-pulumi-cli@v1.0.1'
            },
            {
                run: "echo \"Currently Pulumi $(pulumi version) is installed\"",
            },
            {
                name: "Destroy test infra",
                run: "make destroy_test_infra StackName=\"${{ env.PULUMI_TEST_OWNER }}/${{ github.sha }}-${{ github.run_number }}\""
            }
        ]);
    }
}
export class KubernetesProviderTestJob extends EnvironmentSetup {
    constructor() {
        super(...arguments);
        this.strategy = {
            'fail-fast': false,
            matrix: {
                'go-version': ['1.15.x'],
                'dotnet-version': ['3.1.301'],
                'python-version': ['3.7'],
                'node-version': ['13.x'],
                platform: ['ubuntu-latest'],
            },
        };
        this['runs-on'] = '${{ matrix.platform }}';
        this.needs = 'test-infra-setup';
        this.steps = this.steps.concat([
            {
                name: 'Install Latest Stable Pulumi CLI',
                uses: 'pulumi/action-install-pulumi-cli@v1.0.1'
            },
            {
                run: "echo \"Currently Pulumi $(pulumi version) is installed\"",
            },
            {
                name: "Install Go Dependencies",
                run: "make ensure"
            },
            {
                name: "Setup Config",
                run: "mkdir -p \"$HOME/.kube/\"\n" +
                    "pulumi stack -s \"${{ env.PULUMI_TEST_OWNER }}/${{ github.sha }}-${{ github.run_number }}\" -C misc/scripts/testinfra/ output --show-secrets kubeconfig >~/.kube/config",
            },
            {
                name: "Run ${{ matrix.tests-set }} Tests",
                run: "make specific_test_set TestSet=Kubernetes"
            }
        ]);
    }
}
export class SmokeTestCliForKubernetesProviderTestJob extends EnvironmentSetup {
    constructor() {
        super(...arguments);
        this.strategy = {
            'fail-fast': false,
            matrix: {
                'go-version': ['1.15.x'],
                'dotnet-version': ['3.1.301'],
                'python-version': ['3.7'],
                'node-version': ['13.x'],
                platform: ['ubuntu-latest'],
            },
        };
        this['runs-on'] = '${{ matrix.platform }}';
        this.needs = 'test-infra-setup';
        this.steps = this.steps.concat([
            {
                name: 'Install Specific Pulumi CLI',
                uses: 'pulumi/action-install-pulumi-cli@v1.0.1',
                with: {
                    'pulumi-version': '${{ env.PULUMI_VERSION }}'
                }
            },
            {
                run: "echo \"Currently Pulumi $(pulumi version) is installed\"",
            },
            {
                name: "Install Go Dependencies",
                run: "make ensure"
            },
            {
                name: "Setup Config",
                run: "mkdir -p \"$HOME/.kube/\"\n" +
                    "pulumi stack -s \"${{ env.PULUMI_TEST_OWNER }}/${{ github.sha }}-${{ github.run_number }}\" -C misc/scripts/testinfra/ output --show-secrets kubeconfig >~/.kube/config",
            },
            {
                name: "Run ${{ matrix.tests-set }} Tests",
                run: "make specific_test_set TestSet=Kubernetes"
            }
        ]);
    }
}
export class CronProviderTestJob extends EnvironmentSetup {
    constructor() {
        super(...arguments);
        this.strategy = {
            'fail-fast': false,
            matrix: {
                'go-version': ['1.15.x'],
                'dotnet-version': ['3.1.301'],
                'python-version': ['3.7'],
                'node-version': ['13.x'],
                platform: ['ubuntu-latest'],
                languages: ["Cs", "Js", "Ts", "Py", "Fs"],
                clouds: ["DigitalOcean", "Aws", "Azure", "Gcp", "Packet", "Cloud"],
                'examples-test-matrix': ['no-latest-cli', 'no-latest-packages', 'default'],
            },
        };
        this['runs-on'] = '${{ matrix.platform }}';
        this.steps = this.steps.concat([
            {
                if: 'matrix.examples-test-matrix == \'no-latest-cli\'',
                run: 'echo \'running combination of stable pulumi cli + dev providers\'',
            },
            {
                if: 'matrix.examples-test-matrix == \'no-latest-packages\'',
                run: 'echo \'running combination of dev pulumi cli + stable providers\'',
            },
            {
                if: 'matrix.examples-test-matrix == \'default\'',
                run: 'echo \'running combination of dev pulumi cli + dev providers\'',
            },
            {
                if: 'matrix.examples-test-matrix == \'no-latest-cli\'',
                name: 'Install Latest Stable Pulumi CLI',
                uses: 'pulumi/action-install-pulumi-cli@v1.0.1'
            },
            {
                name: 'Running ci-scripts/run-at-head with ${{ matrix.examples-test-matrix }} configuration',
                run: './ci-scripts/ci/run-at-head --${{ matrix.examples-test-matrix }}'
            },
            {
                if: 'matrix.examples-test-matrix == \'no-latest-packages\' || matrix.examples-test-matrix == \'default\'',
                run: 'echo "$HOME/.pulumi/bin" >> $GITHUB_PATH',
            },
            {
                run: "echo \"Currently Pulumi $(pulumi version) is installed\"",
            },
            {
                name: "Install Testing Dependencies",
                run: `make ensure`
            },
            {
                name: "Running ${{ matrix.clouds }}${{ matrix.languages }} Tests",
                run: "make specific_test_set TestSet=${{ matrix.clouds }}${{ matrix.languages }}"
            }
        ]);
    }
}
export class RunProviderTestForPrTestJob extends EnvironmentSetup {
    constructor() {
        super(...arguments);
        this.strategy = {
            'fail-fast': false,
            matrix: {
                'go-version': ['1.15.x'],
                'dotnet-version': ['3.1.301'],
                'python-version': ['3.7'],
                'node-version': ['13.x'],
                platform: ['ubuntu-latest'],
                languages: ["Cs", "Js", "Ts", "Py", "Fs"],
                clouds: ["DigitalOcean", "Aws", "Azure", "Gcp", "Packet", "Cloud"],
            },
        };
        this['runs-on'] = '${{ matrix.platform }}';
        this.steps = this.steps.concat([
            {
                name: 'Install Latest Stable Pulumi CLI',
                uses: 'pulumi/action-install-pulumi-cli@v1.0.1'
            },
            {
                run: "echo \"Currently Pulumi $(pulumi version) is installed\"",
            },
            {
                name: "Install Testing Dependencies",
                run: `make ensure`
            },
            {
                name: "Running ${{ matrix.clouds }}${{ matrix.languages }} Tests",
                run: "make specific_test_set TestSet=${{ matrix.clouds }}${{ matrix.languages }}"
            }
        ]);
    }
}
export class SmokeTestCliForProvidersJob extends EnvironmentSetup {
    constructor() {
        super(...arguments);
        this.strategy = {
            'fail-fast': false,
            matrix: {
                'go-version': ['1.15.x'],
                'dotnet-version': ['3.1.301'],
                'python-version': ['3.7'],
                'node-version': ['13.x'],
                platform: ['ubuntu-latest'],
                languages: ["Cs", "Js", "Ts", "Py", "Fs"],
                clouds: ["DigitalOcean", "Aws", "Azure", "Gcp", "Packet", "Cloud"],
            },
        };
        this['runs-on'] = '${{ matrix.platform }}';
        this.steps = this.steps.concat([
            {
                name: 'Install Specific Pulumi CLI',
                uses: 'pulumi/action-install-pulumi-cli@v1.0.1',
                with: {
                    'pulumi-version': '${{ env.PULUMI_VERSION }}'
                }
            },
            {
                run: "echo \"Currently Pulumi $(pulumi version) is installed\"",
            },
            {
                name: "Install Testing Dependencies",
                run: `make ensure`
            },
            {
                name: "Running ${{ matrix.clouds }}${{ matrix.languages }} Tests",
                run: "make specific_test_set TestSet=${{ matrix.clouds }}${{ matrix.languages }}"
            }
        ]);
    }
}
export class SmokeTestKubernetesProviderTestJob extends EnvironmentSetup {
    constructor() {
        super(...arguments);
        this.strategy = {
            'fail-fast': false,
            matrix: {
                'go-version': ['1.15.x'],
                'dotnet-version': ['3.1.301'],
                'python-version': ['3.7'],
                'node-version': ['13.x'],
                platform: ['ubuntu-latest'],
            },
        };
        this['runs-on'] = '${{ matrix.platform }}';
        this.needs = 'test-infra-setup';
        this.steps = this.steps.concat([
            {
                name: 'Install Specific Pulumi CLI',
                uses: 'pulumi/action-install-pulumi-cli@v1.0.1',
                with: {
                    'pulumi-version': '${{ env.PULUMI_VERSION }}'
                }
            },
            {
                run: "echo \"Currently Pulumi $(pulumi version) is installed\"",
            },
            {
                name: "Install Go Dependencies",
                run: "make ensure"
            },
            {
                name: "Setup Config",
                run: "mkdir -p \"$HOME/.kube/\"\n" +
                    "pulumi stack -s \"${{ env.PULUMI_TEST_OWNER }}/${{ github.sha }}-${{ github.run_number }}\" -C misc/scripts/testinfra/ output --show-secrets kubeconfig >~/.kube/config",
            },
            {
                name: "Run Kubernetes Smoke Tests",
                run: "make specific_tag_set TagSet=Kubernetes"
            }
        ]);
    }
}
export class SmokeTestProvidersJob extends EnvironmentSetup {
    constructor() {
        super(...arguments);
        this.strategy = {
            'fail-fast': false,
            matrix: {
                'go-version': ['1.15.x'],
                'dotnet-version': ['3.1.301'],
                'python-version': ['3.7'],
                'node-version': ['13.x'],
                platform: ['ubuntu-latest'],
                languages: ["Cs", "Js", "Ts", "Py", "Fs"],
            },
        };
        this['runs-on'] = '${{ matrix.platform }}';
        this.steps = this.steps.concat([
            {
                name: 'Install Specific Pulumi CLI',
                uses: 'pulumi/action-install-pulumi-cli@v1.0.1',
                with: {
                    'pulumi-version': '${{ env.PULUMI_VERSION }}'
                }
            },
            {
                run: "echo \"Currently Pulumi $(pulumi version) is installed\"",
            },
            {
                name: "Install Testing Dependencies",
                run: `make ensure`
            },
            {
                name: "Running ${{ env.PROVIDER_TESTS_TAG }}${{ matrix.languages }} Smoke Tests",
                run: "make specific_tag_set TestSet=${{ matrix.languages }} TagSet=${{ env.PROVIDER_TESTS_TAG }}"
            }
        ]);
    }
}
export class CronWorkflow extends g.GithubWorkflow {
    constructor(name, jobs) {
        super(name, jobs, {
            schedule: [{
                    "cron": "0 9 * * *",
                }],
            repository_dispatch: {
                types: ['trigger-cron'],
            },
        }, {
            env: Object.assign(Object.assign({}, env), { 'PULUMI_ENABLE_RESOURCE_REFERENCES': '1' })
        });
        this.jobs = {
            providers: new CronProviderTestJob('providers', {}),
            linting: new Linting('lint'),
            'test-infra-setup': new TestInfraSetup('test-infra-setup'),
            'test-infra-destroy': new TestInfraDestroy('test-infra-destroy'),
            kubernetes: new KubernetesProviderTestJob('kubernetes'),
        };
    }
}
export class SmokeTestCliWorkflow extends g.GithubWorkflow {
    constructor(name, jobs) {
        super(name, jobs, {
            repository_dispatch: {
                types: ['smoke-test-cli'],
            },
        }, {
            env: Object.assign(Object.assign({}, env), { 'PULUMI_VERSION': '${{ github.event.client_payload.ref }}' })
        });
        this.jobs = {
            providers: new SmokeTestCliForProvidersJob('smoke-test-cli-on-providers', {}),
            'test-infra-setup': new TestInfraSetup('test-infra-setup'),
            'test-infra-destroy': new TestInfraDestroy('test-infra-destroy'),
            kubernetes: new SmokeTestCliForKubernetesProviderTestJob('smoke-test-cli-on-kubernetes'),
        };
    }
}
export class SmokeTestProvidersWorkflow extends g.GithubWorkflow {
    constructor(name, jobs) {
        super(name, jobs, {
            repository_dispatch: {
                types: ['smoke-test-cli'],
            },
        }, {
            env: Object.assign(Object.assign({}, env), { 'PROVIDER_TESTS_TAG': '${{ github.event.client_payload.ref }}' })
        });
        this.jobs = {
            providers: new SmokeTestProvidersJob('smoke-test-providers'),
            'test-infra-setup': new TestInfraSetup('test-infra-setup'),
            'test-infra-destroy': new TestInfraDestroy('test-infra-destroy'),
            kubernetes: new SmokeTestKubernetesProviderTestJob('smoke-test-kubernetes-provider'),
        };
    }
}
export class PrWorkFlow extends g.GithubWorkflow {
    constructor(name, jobs) {
        super(name, jobs, {
            pull_request_target: {},
        });
        this.jobs = {
            'comment-on-pr': new CommentOnPrJob('comment-on-pr', {}),
        };
    }
}
export class CommandDispatchWorkflow {
    constructor() {
        this.name = 'Command Dispatch for testing';
        this.on = {
            issue_comment: {
                types: ['created', 'edited']
            }
        };
        this.jobs = {
            'command-dispatch-for-testing': {
                'runs-on': 'ubuntu-latest',
                steps: [
                    {
                        uses: 'actions/checkout@v2',
                    },
                    {
                        name: 'Run Build',
                        uses: 'peter-evans/slash-command-dispatch@v2',
                        with: {
                            token: '${{ secrets.EVENT_PAT }}',
                            'reaction-token': '${{ secrets.GITHUB_TOKEN }}',
                            commands: 'run-example-tests',
                            permission: 'write',
                            'issue-type': 'pull-request',
                            repository: 'pulumi/examples',
                        }
                    }
                ]
            }
        };
    }
}
export class RunTestsCommandWorkflow extends g.GithubWorkflow {
    constructor(name, jobs) {
        super(name, jobs, {
            repository_dispatch: {
                types: ['run-example-tests-command'],
            },
            pull_request: {
                branches: ['master']
            }
        }, {
            env: Object.assign(Object.assign({}, env), { 'PR_COMMIT_SHA': '${{ github.event.client_payload.pull_request.head.sha }}' })
        });
        this.jobs = {
            'comment-notification': new ResultsCommentJob('comment-notification'),
            'test-infra-setup': new TestInfraSetup('test-infra-setup').addDispatchConditional(true),
            'test-infra-destroy': new TestInfraDestroy('test-infra-destroy').addDispatchConditional(true),
            linting: new Linting('lint').addDispatchConditional(true),
            kubernetes: new KubernetesProviderTestJob('kubernetes').addDispatchConditional(true),
            providers: new RunProviderTestForPrTestJob('run-provider-tests').addDispatchConditional(true),
        };
    }
}

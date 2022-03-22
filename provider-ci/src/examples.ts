import * as g from '@jaxxstorm/gh-actions';
import * as job from '@jaxxstorm/gh-actions/lib/job';
import * as param from '@jkcfg/std/param';

const extraEnv = param.Object('env');

const env = Object.assign({
    PULUMI_TEST_OWNER: 'moolumi',
    PULUMI_ACCESS_TOKEN: '${{ secrets.PULUMI_ACCESS_TOKEN }}',
    PULUMI_API: 'https://api.pulumi-staging.io',
    SLACK_WEBHOOK_URL: '${{ secrets.SLACK_WEBHOOK_URL }}',
    AWS_ACCESS_KEY_ID:' ${{ secrets.AWS_ACCESS_KEY_ID }}',
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
    strategy = {
        'fail-fast': false,
        matrix: {
            'yarn-version': ['1.13.0'],
            'node-version': ['14.x'],
            platform: ['ubuntu-latest'],
        },
    }
    'runs-on' = '${{ matrix.platform }}'
    steps = [
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
    ] as any;

    constructor(name: string, params?: Partial<Linting>) {
        super();
        this.name = name;
        Object.assign(this, {name}, params)
    }

    addDispatchConditional(isWorkflowDispatch) {
        if (isWorkflowDispatch) {
            this.if = "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository"
        }
        return this;
    }
}

export class CommentOnPrJob extends job.Job {
    'runs-on' = 'ubuntu-latest'
    if = "github.event.pull_request.head.repo.full_name != github.repository"
    steps = [
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
    ] as any;

    constructor(name: string, params?: Partial<Linting>) {
        super();
        this.name = name;
        Object.assign(this, {name}, params)
    }
}

export class ResultsCommentJob extends job.Job {
    'runs-on' = 'ubuntu-latest'
    if = 'github.event_name == \'repository_dispatch\''
    steps = [
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
    ] as any;

    constructor(name: string, params?: Partial<ResultsCommentJob>) {
        super();
        this.name = name;
        Object.assign(this, {name}, params)
    }
}

export class EnvironmentSetup extends job.Job {
    steps = [
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
            uses: 'google-github-actions/setup-gcloud@v0',
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
    ] as any;

    constructor(name: string, params?: Partial<EnvironmentSetup>, isCommandDispatch?: boolean) {
        super();
        this.name = name;
        Object.assign(this, {name}, params)
    }

    addStep(step) {
        this.steps.push(step);
        return this;
    }

    addDispatchConditional(isWorkflowDispatch) {
        if (isWorkflowDispatch) {
            this.if = "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository"
        }
        return this;
    }
}

export class TestInfraSetup extends EnvironmentSetup {
    strategy = {
        'fail-fast': false,
        matrix: {
            'go-version': ['1.16.x'],
            'dotnet-version': ['3.1.301'],
            'python-version': ['3.7'],
            'node-version': ['13.x'],
            platform: ['ubuntu-latest'],
        },
    }
    'runs-on' = '${{ matrix.platform }}'
    steps = this.steps.concat([
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
    ])
}

export class ConditionalTestInfraSetup extends EnvironmentSetup {
    strategy = {
        'fail-fast': false,
        matrix: {
            'go-version': ['1.16.x'],
            'dotnet-version': ['3.1.301'],
            'python-version': ['3.7'],
            'node-version': ['13.x'],
            platform: ['ubuntu-latest'],
        },
    }
    'runs-on' = '${{ matrix.platform }}'
    steps = this.steps.concat([
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
    ])
}

export class TestInfraDestroy extends EnvironmentSetup {
    strategy = {
        'fail-fast': false,
        matrix: {
            'go-version': ['1.16.x'],
            'dotnet-version': ['3.1.301'],
            'python-version': ['3.7'],
            'node-version': ['13.x'],
            platform: ['ubuntu-latest'],
        },
    }
    'runs-on' = '${{ matrix.platform }}'
    needs = "kubernetes"
    steps = this.steps.concat([
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
    ])
}

export class KubernetesProviderTestJob extends EnvironmentSetup {
    strategy = {
        'fail-fast': false,
        matrix: {
            'go-version': ['1.16.x'],
            'dotnet-version': ['3.1.301'],
            'python-version': ['3.7'],
            'node-version': ['13.x'],
            platform: ['ubuntu-latest'],
        },
    }
    'runs-on' = '${{ matrix.platform }}'
    needs = 'test-infra-setup'
    steps = this.steps.concat([
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
    ])
}

export class SmokeTestCliForKubernetesProviderTestJob extends EnvironmentSetup {
    strategy = {
        'fail-fast': false,
        matrix: {
            'go-version': ['1.16.x'],
            'dotnet-version': ['3.1.301'],
            'python-version': ['3.7'],
            'node-version': ['13.x'],
            platform: ['ubuntu-latest'],
        },
    }
    'runs-on' = '${{ matrix.platform }}'
    needs = 'test-infra-setup'
    steps = this.steps.concat([
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
    ])
}

export class CronProviderTestJob extends EnvironmentSetup {
    strategy = {
        'fail-fast': false,
        matrix: {
            'go-version': ['1.16.x'],
            'dotnet-version': ['3.1.301'],
            'python-version': ['3.7'],
            'node-version': ['13.x'],
            platform: ['ubuntu-latest'],
            languages: ["Cs", "Js", "Ts", "Py", "Fs"],
            clouds: ["DigitalOcean", "Aws", "Azure", "Gcp", "Packet", "EquinixMetal", "Cloud"],
            'examples-test-matrix': ['no-latest-cli', 'no-latest-packages', 'default'],
        },
    }
    'runs-on' = '${{ matrix.platform }}'
    steps = this.steps.concat([
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
            run: 'echo "$HOME/.pulumi/bin" >> $GITHUB_PATH', //we need to set the dev version of Pulumi to PATH
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
    ])
}

export class RunProviderTestForPrTestJob extends EnvironmentSetup {
    strategy = {
        'fail-fast': false,
        matrix: {
            'go-version': ['1.16.x'],
            'dotnet-version': ['3.1.301'],
            'python-version': ['3.7'],
            'node-version': ['13.x'],
            platform: ['ubuntu-latest'],
            languages: ["Cs", "Js", "Ts", "Py", "Fs"],
            clouds: ["DigitalOcean", "Aws", "Azure", "Gcp", "Packet", "EquinixMetal", "Cloud"],
        },
    }
    'runs-on' = '${{ matrix.platform }}'
    steps = this.steps.concat([
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
    ])
}

export class SmokeTestCliForProvidersJob extends EnvironmentSetup {
    strategy = {
        'fail-fast': false,
        matrix: {
            'go-version': ['1.16.x'],
            'dotnet-version': ['3.1.301'],
            'python-version': ['3.7'],
            'node-version': ['13.x'],
            platform: ['ubuntu-latest'],
            languages: ["Cs", "Js", "Ts", "Py", "Fs"],
            clouds: ["DigitalOcean", "Aws", "Azure", "Gcp", "Packet", "EquinixMetal", "Cloud"],
        },
    }
    'runs-on' = '${{ matrix.platform }}'
    steps = this.steps.concat([
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
    ])
}

export class SmokeTestKubernetesProviderTestJob extends EnvironmentSetup {
    strategy = {
        'fail-fast': false,
        matrix: {
            'go-version': ['1.16.x'],
            'dotnet-version': ['3.1.301'],
            'python-version': ['3.7'],
            'node-version': ['13.x'],
            platform: ['ubuntu-latest'],
        },
    }
    'runs-on' = '${{ matrix.platform }}'
    needs = 'test-infra-setup'
    steps = this.steps.concat([
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
    ])
}

export class SmokeTestProvidersJob extends EnvironmentSetup {
    strategy = {
        'fail-fast': false,
        matrix: {
            'go-version': ['1.16.x'],
            'dotnet-version': ['3.1.301'],
            'python-version': ['3.7'],
            'node-version': ['13.x'],
            platform: ['ubuntu-latest'],
            languages: ["Cs", "Js", "Ts", "Py", "Fs"],
        },
    }
    'runs-on' = '${{ matrix.platform }}'
    steps = this.steps.concat([
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
    ])
}

export class UnitTestingJob extends job.Job {
    'runs-on' = '${{ matrix.platform }}'
    name = 'Running ${{ matrix.source-dir }} test'

    constructor(isCommandDispatch?: boolean) {
        super();
    }

    addDispatchConditional(isWorkflowDispatch) {
        if (isWorkflowDispatch) {
            this.if = "github.event_name == 'repository_dispatch' || github.event.pull_request.head.repo.full_name == github.repository"
        }
        return this;
    }
}

export class UnitTestDotNetJob extends UnitTestingJob {
    strategy = {
        'fail-fast': false,
        matrix: {
            'dotnet-version': ['3.1.x'],
            platform: ['ubuntu-latest'],
            'source-dir': ['testing-unit-cs', 'testing-unit-cs-mocks', 'testing-unit-fs-mocks']
        },
    }
    steps = [
        {
            name: 'Install DotNet ${{ matrix.dotnet-version }}',
            uses: 'actions/setup-dotnet@v1',
            with: {
                'dotnet-version': '${{matrix.dotnet-version}}',
            },
        },
        {
            name: 'Install Latest Pulumi CLI',
            uses: 'pulumi/action-install-pulumi-cli@v1.0.1',
        },
        {
            run: "echo \"Currently Pulumi $(pulumi version) is installed\"",
        },
        {
            uses: 'actions/checkout@v2',
        },
        {
            run: "dotnet test",
            'working-directory':  '${{ matrix.source-dir }}',
        }
    ]
}

export class UnitTestPythonJob extends UnitTestingJob {
    strategy = {
        'fail-fast': false,
        matrix: {
            'python-version': ['3.7.x'],
            platform: ['ubuntu-latest'],
            'source-dir': ['testing-unit-py']
        },
    }
    steps = [
        {
            name: 'Install Python ${{ matrix.python-version }}',
            uses: 'actions/setup-python@v1',
            with: {
                'python-version': '${{matrix.python-version}}',
            },
        },
        {
            name: 'Install Python Deps',
            run: "pip3 install virtualenv==20.0.23\n" +
                "pip3 install pipenv",
        },
        {
            name: 'Install Latest Pulumi CLI',
            uses: 'pulumi/action-install-pulumi-cli@v1.0.1',
        },
        {
            run: "echo \"Currently Pulumi $(pulumi version) is installed\"",
        },
        {
            uses: 'actions/checkout@v2',
        },
        {
            run: "python3 -m venv venv\n" +
                "source venv/bin/activate\n" +
                "pip3 install -r requirements.txt\n" +
                "python -m unittest",
            'working-directory':  '${{ matrix.source-dir }}',
        }
    ]
}

export class UnitTestNodeJSJob extends UnitTestingJob {
    strategy = {
        'fail-fast': false,
        matrix: {
            'node-version': ['13.x'],
            platform: ['ubuntu-latest'],
            'source-dir': ['testing-unit-ts']
        },
    }
    steps = [
        {
            name: 'Install Node.js ${{ matrix.node-version }}',
            uses: 'actions/setup-node@v1',
            with: {
                'node-version': '${{matrix.node-version}}',
            },
        },
        {
            name: 'Install Latest Pulumi CLI',
            uses: 'pulumi/action-install-pulumi-cli@v1.0.1',
        },
        {
            run: "echo \"Currently Pulumi $(pulumi version) is installed\"",
        },
        {
            uses: 'actions/checkout@v2',
        },
        {
            run: "npm install\n" +
                "npm install --global mocha\n" +
                "npm install --global ts-node\n" +
                "mocha -r ts-node/register ec2tests.ts",
            'working-directory':  '${{ matrix.source-dir }}',
        }
    ]
}

export class UnitTestGoJob extends UnitTestingJob {
    strategy = {
        'fail-fast': false,
        matrix: {
            'go-version': ['1.16.x'],
            platform: ['ubuntu-latest'],
            'source-dir': ['testing-unit-go']
        },
    }
    steps = [
        {
            name: 'Install Go ${{ matrix.go-version }}',
            uses: 'actions/setup-go@v1',
            with: {
                'go-version': '${{matrix.go-version}}',
            },
        },
        {
            name: 'Install Latest Pulumi CLI',
            uses: 'pulumi/action-install-pulumi-cli@v1.0.1',
        },
        {
            run: "echo \"Currently Pulumi $(pulumi version) is installed\"",
        },
        {
            uses: 'actions/checkout@v2',
        },
        {
            run: "go test",
            'working-directory':  '${{ matrix.source-dir }}',
        }
    ]
}

export class CronWorkflow extends g.GithubWorkflow {
    jobs: { [k: string]: job.Job }

    constructor(name: string, jobs: { [k: string]: job.Job }) {
        super(name, jobs, {
            schedule: [{
                "cron": "0 9 * * *",
            }],
            repository_dispatch: {
                types: ['trigger-cron'],
            },
        }, {
            env: {
                ...env,
                'PULUMI_ENABLE_RESOURCE_REFERENCES': '1',
            }
        });
        this.jobs = {
            providers: new CronProviderTestJob('providers', {}),
            linting: new Linting('lint'),
            'test-infra-setup': new TestInfraSetup('test-infra-setup'),
            'test-infra-destroy': new TestInfraDestroy('test-infra-destroy'),
            kubernetes: new KubernetesProviderTestJob('kubernetes'),
            'dotnet-unit-testing': new UnitTestDotNetJob(),
            'ts-unit-testing': new UnitTestNodeJSJob(),
            'go-unit-testing': new UnitTestGoJob(),
            'python-unit-testing': new UnitTestPythonJob(),
        }
    }
}

export class SmokeTestCliWorkflow extends g.GithubWorkflow {
    jobs: { [k: string]: job.Job }

    constructor(name: string, jobs: { [k: string]: job.Job }) {
        super(name, jobs, {
            repository_dispatch: {
                types: ['smoke-test-cli'],
            },
        }, {
            env: {
                ...env,
                'PULUMI_VERSION': '${{ github.event.client_payload.ref }}',
            }
        });
        this.jobs = {
            providers: new SmokeTestCliForProvidersJob('smoke-test-cli-on-providers', {}),
            'test-infra-setup': new TestInfraSetup('test-infra-setup'),
            'test-infra-destroy': new TestInfraDestroy('test-infra-destroy'),
            kubernetes: new SmokeTestCliForKubernetesProviderTestJob('smoke-test-cli-on-kubernetes'),
            'dotnet-unit-testing': new UnitTestDotNetJob(),
            'ts-unit-testing': new UnitTestNodeJSJob(),
            'go-unit-testing': new UnitTestGoJob(),
            'python-unit-testing': new UnitTestPythonJob(),
        }
    }
}

export class SmokeTestProvidersWorkflow extends g.GithubWorkflow {
    jobs: { [k: string]: job.Job }

    constructor(name: string, jobs: { [k: string]: job.Job }) {
        super(name, jobs, {
            repository_dispatch: {
                types: ['smoke-test-provider'],
            },
        }, {
            env: {
                ...env,
                'PROVIDER_TESTS_TAG': '${{ github.event.client_payload.ref }}',
            }
        });
        this.jobs = {
            providers: new SmokeTestProvidersJob('smoke-test-providers'),
            'test-infra-setup': new TestInfraSetup('test-infra-setup'),
            'test-infra-destroy': new TestInfraDestroy('test-infra-destroy'),
            kubernetes: new SmokeTestKubernetesProviderTestJob('smoke-test-kubernetes-provider'),
            'dotnet-unit-testing': new UnitTestDotNetJob(),
            'ts-unit-testing': new UnitTestNodeJSJob(),
            'go-unit-testing': new UnitTestGoJob(),
            'python-unit-testing': new UnitTestPythonJob(),
        }
    }
}

export class PrWorkFlow extends g.GithubWorkflow {
    jobs: { [k: string]: job.Job }

    constructor(name: string, jobs: { [k: string]: job.Job }) {
        super(name, jobs, {
            pull_request_target: {},
        });
        this.jobs = {
            'comment-on-pr': new CommentOnPrJob('comment-on-pr', {}),
        }
    }
}

export class CommandDispatchWorkflow {
    name = 'Command Dispatch for testing';
    on = {
        issue_comment: {
            types: ['created', 'edited']
        }
    }
    jobs = {
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
    }
}

export class RunTestsCommandWorkflow extends g.GithubWorkflow {
    jobs: { [k: string]: job.Job }

    constructor(name: string, jobs: { [k: string]: job.Job }) {
        super(name, jobs, {
            repository_dispatch: {
                types: ['run-example-tests-command'],
            },
            pull_request: {
                branches: ['master']
            }
        }, {
            env: {
                ...env,
                'PR_COMMIT_SHA': '${{ github.event.client_payload.pull_request.head.sha }}',
            }
        });
        this.jobs = {
            'comment-notification': new ResultsCommentJob('comment-notification'),
            'test-infra-setup': new TestInfraSetup('test-infra-setup').addDispatchConditional(true),
            'test-infra-destroy': new TestInfraDestroy('test-infra-destroy').addDispatchConditional(true),
            linting: new Linting('lint').addDispatchConditional(true),
            kubernetes: new KubernetesProviderTestJob('kubernetes').addDispatchConditional(true),
            providers: new RunProviderTestForPrTestJob('run-provider-tests').addDispatchConditional(true),
            'dotnet-unit-testing': new UnitTestDotNetJob().addDispatchConditional(true),
            'ts-unit-testing': new UnitTestNodeJSJob().addDispatchConditional(true),
            'go-unit-testing': new UnitTestGoJob().addDispatchConditional(true),
            'python-unit-testing': new UnitTestPythonJob().addDispatchConditional(true),
        }
    }
}

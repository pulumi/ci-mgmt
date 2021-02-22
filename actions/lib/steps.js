import * as step from '@jaxxstorm/gh-actions/lib/step';
import * as action from "./action-versions";
const goVersion = "1.15.x";
export class CheckoutRepoStep extends step.Step {
    constructor() {
        super();
        return {
            name: "Checkout Repo",
            uses: action.checkout,
        };
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
        };
    }
}
export class CheckoutTagsStep extends step.Step {
    constructor() {
        super();
        return {
            name: 'Unshallow clone for tags',
            run: 'git fetch --prune --unshallow --tags',
        };
    }
}
export class ConfigureGcpCredentials extends step.Step {
    constructor() {
        super();
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
        };
    }
}
export class ConfigureAwsCredentials extends step.Step {
    constructor() {
        super();
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
        };
    }
}
export class InstallGo extends step.Step {
    constructor(version) {
        super();
        return {
            name: 'Install Go',
            uses: action.setupGo,
            with: {
                'go-version': version || goVersion,
            },
        };
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
        };
    }
}
export class InstallPulumiCli extends step.Step {
    constructor() {
        super();
        return {
            name: 'Install Pulumi CLI',
            uses: action.installPulumiCli,
        };
    }
}
export class RunDockerComposeStep extends step.Step {
    constructor() {
        super();
        return {
            name: 'Run docker-compose',
            run: 'docker-compose -f testing/docker-compose.yml up --build -d'
        };
    }
}
export class RunSetUpScriptStep extends step.Step {
    constructor(setupScript) {
        super();
        return {
            name: 'Run setup script',
            run: `${setupScript}`,
        };
    }
}

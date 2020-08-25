import * as pulumi from "@pulumi/pulumi";
import * as github from "@pulumi/github";
import * as fs from 'fs';

// grab all the providers from the directory listing
const providers = fs.readdirSync('../../actions/providers/');
//const providers = ['rancher2', 'pagerduty']

for (let provider of providers) {

    // enable branchProtection
    const branchProtection = new github.BranchProtection(`${provider}-branchprotection`, {
        repository: `pulumi-${provider}`,
        branch: 'master',
        requiredStatusChecks: {
            contexts: [
                "Update Changelog",
                "prerequisites",
                "lint-sdk",
                "lint",
                "test (3.1.301, 1.14.x, dotnet, 13.x, 3.7)",
                "test (3.1.301, 1.14.x, go, 13.x, 3.7)",
                "test (3.1.301, 1.14.x, nodejs, 13.x, 3.7)",
                "test (3.1.301, 1.14.x, python, 13.x, 3.7)",
                "build_sdk (3.1.301, 1.14.x, dotnet, 13.x, 3.7)",
                "build_sdk (3.1.301, 1.14.x, go, 13.x, 3.7)",
                "build_sdk (3.1.301, 1.14.x, nodejs, 13.x, 3.7)",
                "build_sdk (3.1.301, 1.14.x, python, 13.x, 3.7)",
            ]
        }
    })
}

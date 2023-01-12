import * as pulumi from "@pulumi/pulumi";
import * as github from "@pulumi/github";
import * as fs from 'fs';


// grab all the providers from their directory listing
const tfProviders = fs.readdirSync('../../provider-ci/providers/');
const nativeProviders = fs.readdirSync("../../native-provider-ci/providers/")

const providers = [...tfProviders, ...nativeProviders];

for (let provider of providers) {
    const contexts: string[] = [
        "Update Changelog",
        "prerequisites",
        "lint",
        "lint-sdk",
        "build_sdk (dotnet)",
        "build_sdk (go)",
        "build_sdk (java)",
        "build_sdk (nodejs)",
        "build_sdk (python)",
        "test (dotnet)",
        "test (go)",
        "test (java)",
        "test (nodejs)",
        "test (python)",
        "sentinel",
    ];

    // enable branchProtection
    const branches: string[] = [
        "master",
        "main"
    ]
    for (let branch of branches) {
        const masterBranchProtection = new github.BranchProtection(`${provider}-${branch}-branchprotection`, {
            repositoryId: `pulumi-${provider}`,
            pattern: `${branch}`,
            requiredStatusChecks: [{
                strict: false,
                contexts: contexts,
            }]
        })
    }
}

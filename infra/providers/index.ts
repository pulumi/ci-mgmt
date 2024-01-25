import * as github from "@pulumi/github";
import * as fs from 'fs';

console.log('Hello, world!');

// grab all the providers from their directory listing
const tfProviders: string[] = JSON.parse(fs.readFileSync("../../provider-ci/providers.json", "utf-8"));
const nativeProviders = fs.readdirSync("../../native-provider-ci/providers/")

function hasManagedBranchProtection(provider: string): boolean {
    // Some, but not all of the providers under @pulumi/providers team have ad-hoc workflow names and do not want to
    // manage branch protections in this stack. This list might grow as needed.
    return !provider.includes("azure-native");
}

function defineResources(buildSdkJobName: string, provider: string) {
    const requiredChecks: string[] = [
        "Update Changelog",

        "prerequisites",

        // Currently lint and lint-sdk are not universally present accross providers
        // due to drift, and making them required checks makes PRs unmerge-able for example on pulumi/command.
        //
        // TODO figure out in this codebase which providers have them and require accordingly.
        //
        // "lint",
        // "lint-sdk",

        buildSdkJobName + " (dotnet)",
        buildSdkJobName + " (go)",
        buildSdkJobName + " (java)",
        buildSdkJobName + " (nodejs)",
        buildSdkJobName + " (python)",
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
        new github.BranchProtection(`${provider}-${branch}-branchprotection`, {
            repositoryId: `pulumi-${provider}`,
            pattern: `${branch}`,
            enforceAdmins: true,
            requiredPullRequestReviews: [{
                // pullRequestBypassers allows pulumi-bot to push directly to the
                // protected branch, but it does not allow PRs from pulumi-bot to ignore
                // requiredApprovingReviewCount.
                pullRequestBypassers: ["/pulumi-bot"],
                requiredApprovingReviewCount: 1,
            }],
            requiredStatusChecks: [{
                strict: false,
                contexts: requiredChecks,
            }]
        }, {
            deleteBeforeReplace: true,
        })
    }
}

function tfProviderProtection(provider: string) {
    const requiredChecks: string[] = [
        "Update Changelog",
        // Sentinel is responsible for encapsulating CI checks.
        "sentinel",
    ];

    // enable branchProtection
    const branches: string[] = [
        "master",
        "main"
    ]
    for (let branch of branches) {
        new github.BranchProtection(`${provider}-${branch}-branchprotection`, {
            repositoryId: `pulumi-${provider}`,
            pattern: `${branch}`,
            enforceAdmins: true,
            requiredStatusChecks: [{
                strict: false,
                contexts: requiredChecks,
            }],
            requiredPullRequestReviews: [{
                // We want to make sure that pulumi-bot can auto-merge PRs, so we
                // explicitly remove review requirements.
                requiredApprovingReviewCount: 0,

            }],
        }, {
            deleteBeforeReplace: true,
        })
    }
}

for (let bridgedProvider of [...tfProviders].filter(hasManagedBranchProtection)) {
    tfProviderProtection(bridgedProvider);
}

for (let nativeProvider of [...nativeProviders].filter(hasManagedBranchProtection)) {
    defineResources("build_sdks", nativeProvider);
}

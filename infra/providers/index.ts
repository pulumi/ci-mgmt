import * as github from "@pulumi/github";
import * as fs from 'fs';


// grab all the providers from their directory listing
const tfProviders = fs.readdirSync('../../provider-ci/providers/');
const nativeProviders = fs.readdirSync("../../native-provider-ci/providers/")

function hasManagedBranchProtection(provider: string): boolean {
    // Some, but not all of the providers under @pulumi/providers team have ad-hoc workflow names and do not want to
    // manage branch protections in this stack. This list might grow as needed.
    return !provider.includes("azure-native");
}

function defineResources(buildSdkJobName: string, provider: string) {
    const contexts: string[] = [
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
                pullRequestBypassers: ["/pulumi-bot"],
                // pulumi-bot sometimes needs to be able to merge without approval.
                requiredApprovingReviewCount: undefined,
            }],
            requiredStatusChecks: [{
                strict: false,
                contexts: contexts,
            }]
        })
    }
}

for (let bridgedProvider of [...tfProviders].filter(hasManagedBranchProtection)) {
    defineResources("build_sdk", bridgedProvider);
}

for (let nativeProvider of [...nativeProviders].filter(hasManagedBranchProtection)) {
    defineResources("build_sdks", nativeProvider);
}

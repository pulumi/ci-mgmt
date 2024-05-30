import * as github from "@pulumi/github";
import * as fs from 'fs';


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
        "Sentinel",
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
        "Sentinel",
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

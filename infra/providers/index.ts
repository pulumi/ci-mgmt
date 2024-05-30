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

function nativeProviderProtection(buildSdkJobName: string, provider: string) {
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

    const repo = `pulumi-${provider}`;

    new github.BranchProtection(`${provider}-default`, {
        repositoryId: repo,
        pattern: github.BranchDefault.get(provider, repo).branch,
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
        // TODO: Delete after pulumi up has happened.
        aliases: [{name: branchAlias(provider)}],
    })
}

function tfProviderProtection(provider: string) {
    const requiredChecks: string[] = [
        "Update Changelog",
        // Sentinel is responsible for encapsulating CI checks.
        "sentinel",
    ];

    const repo = `pulumi-${provider}`;

    new github.BranchProtection(`${provider}-default`, {
        repositoryId: repo,
        pattern: github.BranchDefault.get(provider, repo).branch,
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

function branchAlias(provider: string): string {
    const main = [
        "docker-build",
    ];

    if (main.includes(provider)) {
        return `${provider}-main-branchprotection`;
    }
    return `${provider}-master-branchprotection`;
}

for (let bridgedProvider of tfProviders) {
    tfProviderProtection(bridgedProvider);
}

for (let nativeProvider of [...nativeProviders].filter(hasManagedBranchProtection)) {
    nativeProviderProtection("build_sdks", nativeProvider);
}

import * as pulumi from "@pulumi/pulumi";
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
        "Sentinel",
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
    });

    new ProviderLabels(provider);
}

function tfProviderProtection(provider: string) {
    const requiredChecks: string[] = [
        "Update Changelog",
        // Sentinel is responsible for encapsulating CI checks.
        "Sentinel",
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
    });

    new BridgedProviderLabels(provider);
}

const color = {
    awaiting: "F9D0C4",
    needsRelease: "C5DEF5",
};


// ProviderLabels applies the labels that all providers should have.
//
// Labels that should apply to all repositories in the Pulumi org are managed in
// team-management, not in ci-mgmt.
class ProviderLabels extends pulumi.ComponentResource {

    constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
        super("pkg:provider:Labels", name, {}, opts);

        this.labels(`pulumi-${name}`, [
            {name: "awaiting/codegen", color: color.awaiting, description: "Blocked on a missing bug or feature in SDK generation"},
            {name: "awaiting/core", color: color.awaiting, description: "Blocked on a missing bug or feature in pulumi/pulumi (except codegen)"},

        ]);
    }

    protected labels(repo: string, labels: (Omit<Omit<github.IssueLabelArgs, "repository">, "name"> & { name: string })[]) {
        for (const label of labels) {
            new github.IssueLabel(`${repo}-${label.name}`, {
                repository: repo,
                ...label,
            }, {
                parent: this,
                // Recreating labels will drop them from any issues they are attached
                // to. To avoid this, we protect our labels.
                protect: true,
            })
        }
    }
}

class BridgedProviderLabels extends ProviderLabels {

    constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
        super(name, opts);

        this.labels(`pulumi-${name}`, [
            {name: "needs-release/patch", color: color.needsRelease, description: "When a PR with this label merges, it initiates a release of vX.Y.Z+1"},
            {name: "needs-release/minor", color: color.needsRelease, description: "When a PR with this label merges, it initiates a release of vX.Y+1.0"},
            {name: "needs-release/major", color: color.needsRelease, description: "When a PR with this label merges, it initiates a release of vX+1.0.0"},
            {name: "awaiting/bridge", color: color.awaiting, description: "The issue cannot be resolved without action in pulumi-terraform-bridge."},
        ]);
    }
}

for (let bridgedProvider of tfProviders) {
    tfProviderProtection(bridgedProvider);
}

for (let nativeProvider of [...nativeProviders].filter(hasManagedBranchProtection)) {
    nativeProviderProtection("build_sdks", nativeProvider);
}

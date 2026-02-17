import * as pulumi from "@pulumi/pulumi";
import * as github from "@pulumi/github";
import * as fs from "fs";

const config = new pulumi.Config();

const gh = new github.Provider("github", {
  owner: "pulumi",
  appAuth: {
    id: config.require("app_id"),
    installationId: config.require("app_installation_id"),
    pemFile: config.requireSecret("app_private_key"),
  },
});

// grab all the providers from their directory listing
const tfProviders: string[] = JSON.parse(fs.readFileSync("../../provider-ci/providers.json", "utf-8"));

function tfProviderProtection(provider: string) {
  const requiredChecks: string[] = [
    // Sentinel is responsible for encapsulating CI checks.
    "Sentinel",
  ];

  const repo = `pulumi-${provider}`;

  new github.BranchProtection(
    `${provider}-default`,
    {
      repositoryId: repo,
      pattern: github.BranchDefault.get(provider, repo, undefined, {
        provider: gh,
      }).branch,
      enforceAdmins: true,
      requiredStatusChecks: [
        {
          strict: false,
          contexts: requiredChecks,
        },
      ],
      requiredPullRequestReviews: [
        {
          // We want to make sure that pulumi-bot can auto-merge PRs, so we
          // explicitly remove review requirements.
          requiredApprovingReviewCount: 0,
        },
      ],
    },
    {
      provider: gh,
      retainOnDelete: true,
      deleteBeforeReplace: true,
    },
  );

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
      { name: "awaiting/codegen", color: color.awaiting, description: "Blocked on a missing bug or feature in SDK generation" },
      { name: "awaiting/core", color: color.awaiting, description: "Blocked on a missing bug or feature in pulumi/pulumi (except codegen)" },

    ]);
  }

  protected labels(repo: string, labels: (Omit<Omit<github.IssueLabelArgs, "repository">, "name"> & { name: string })[]) {
    for (const label of labels) {
      new github.IssueLabel(
        `${repo}-${label.name}`,
        {
          repository: repo,
          ...label,
        },
        {
          parent: this,
          // Deleting labels will drop them from any issues they are attached
          // to. To avoid this, we set retainOnDelete to true.
          retainOnDelete: true,
          provider: gh,
        },
      );
    }
  }
}

class BridgedProviderLabels extends ProviderLabels {

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super(name, opts);

    this.labels(`pulumi-${name}`, [
      { name: "needs-release/patch", color: color.needsRelease, description: "When a PR with this label merges, it initiates a release of vX.Y.Z+1" },
      { name: "needs-release/minor", color: color.needsRelease, description: "When a PR with this label merges, it initiates a release of vX.Y+1.0" },
      { name: "needs-release/major", color: color.needsRelease, description: "When a PR with this label merges, it initiates a release of vX+1.0.0" },
      { name: "awaiting/bridge", color: color.awaiting, description: "The issue cannot be resolved without action in pulumi-terraform-bridge." },
    ]);
  }
}

for (let bridgedProvider of tfProviders) {
  tfProviderProtection(bridgedProvider);
}

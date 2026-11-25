This stack uses Deployments. You can `up` it locally, or receive previews on
pull requests.

It's deployed automatically whenever a PR merges. You can also deploy (or
refresh) it manually in the UI:

https://app.pulumi.com/pulumi/pulumi-provider-repos/production

It uses a fine-grained personal-access-token with repo admin privileges, expiring Jan. 2025.

## Required reviews

To opt a repository into requiring an approving review, add it to `reviewRequiredProviders` in `index.ts`.
Before adding one, check that its bot PRs will still auto-merge (see below).

## Auto-merge

Bot PRs in provider repos merge on their own once the `Sentinel` check passes.
In repos that require a review, auto-merge also waits for an approval:

- `update-workflows.yml` in ci-mgmt approves the workflow-update PRs it opens with `automerge: true`.
- `pulumi-renovate-approve` approves Renovate PRs.

Any other bot that opens auto-merging PRs in such a repo needs its own approver, or its PRs wait for a human.

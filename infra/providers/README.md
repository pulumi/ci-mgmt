This stack uses Deployments. You can `up` it locally, or receive previews on
pull requests.

It's deployed automatically whenever a PR merges. You can also deploy (or
refresh) it manually in the UI:

https://app.pulumi.com/pulumi/pulumi-provider-repos/production

It uses a fine-grained personal-access-token with repo admin privileges, expiring Jan. 2025.

## Required reviews

A provider's default branch requires the `Sentinel` check and no approving review, so bot PRs can auto-merge.
Providers listed in `reviewRequiredProviders` in `index.ts` require one approving review instead, which admins can bypass.
Their bot PRs still merge on their own:

- `update-workflows.yml` in ci-mgmt approves its workflow-update PRs as pulumi-bot when it runs with `automerge: true`.
- `pulumi-renovate-approve` approves Renovate PRs.

Before adding a provider, check that nothing else opens auto-merging PRs in it, or those PRs will wait for a human.

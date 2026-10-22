This stack uses Deployments. You can `up` it locally, or receive previews on
pull requests.

It's deployed automatically whenever a PR merges. You can also deploy (or
refresh) it manually in the UI:

https://app.pulumi.com/pulumi/pulumi-provider-repos/production

It uses a fine-grained personal-access-token with repo admin privileges, expiring Jan. 2025.


## Required reviews and auto-merge

By default a provider's default branch requires the `Sentinel` check and no
approving review, so pulumi-bot can auto-merge its PRs. A provider can opt in
to requiring one approving review, which admins can bypass. Bot PRs still merge
on their own:

- Renovate PRs are approved by `pulumi-renovate-approve`.
- ci-mgmt's workflow-update PRs are approved by the provider's `auto-approve`
  workflow. It approves a PR only when `pulumi-provider-automation[bot]` opened
  it from a branch in the same repo and it carries the `automation/merge` label.

This follows the pattern in `pulumi/docs`
([`auto-approve-for-auto-merge.yml`](https://github.com/pulumi/docs/blob/master/.github/workflows/auto-approve-for-auto-merge.yml)).

To opt a provider in:

1. Set `autoApproveAutomationPRs: true` in the provider's `.ci-mgmt.yaml`, and
   merge the workflow-update PR that adds `.github/workflows/auto-approve.yml`.
2. Add the provider to `reviewRequiredProviders` in `index.ts`.

Prefer doing step 1 first. If step 2 lands first, the provider's
workflow-update PRs need a human approval until step 1 is done. The
workflow-update PR that adds `auto-approve.yml` approves itself, because
`pull_request` runs the workflows from the PR's own branch.

### Testing workflows that open PRs

`update-workflows.yml` adds the `automation/merge` label only when it runs with
`automerge: true`. A run with `automerge: false` opens a PR with no label, so
the auto-approve workflow ignores it and nothing merges until a human reviews
it. Use `automerge: false` to test changes to these workflows, for example:

```sh
gh workflow run update-workflows-single-bridged-provider.yml \
  --repo pulumi/ci-mgmt \
  -f provider_name=pulumiservice \
  -f automerge=false
```

Any new automation that opens auto-merging PRs in a review-required provider
should do the same: take an `automerge` (or `skip_auto_merge`) input, and add
`automation/merge` and enable auto-merge only when it's set. Its PRs also need an
author the `auto-approve` workflow accepts.

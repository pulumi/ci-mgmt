#!/usr/bin/env bash

# This script will combine and set to merge all dependabot PRs in bridged provider repos.
#
# To guard against supply side attacks, this will only merge dependabot PRs that were
# created before last week.

set -e

# Ensure iwahbe/gh-combine-prs is installed
#
# --force: Ensure up to date, don't error when already installed.
gh extension install iwahbe/gh-combine-prs --force

# Query syntax is https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests.
#
# author:app/dependabot restricts this to PRs authored by dependabot.
# created:<$(date -v-7d '+%Y-%m-%d') restricts to PRs created before 7 days ago
QUERY="author:app/dependabot created:<$(date --date "7 days ago" '+%Y-%m-%d')"

combine() {
    provider="$1"
    D="$(mktemp -d)/pulumi-$provider"
    rm -rf "$D"
    gh repo clone "pulumi/pulumi-$provider" "$D"
    (cd "$D" && gh combine-prs \
                   --skip-pr-check \
                   --query "${QUERY}" \
                   --auto-merge \
                   --non-interactive \
                   --labels impact/no-changelog-required)
    rm -rf "$D"
}

if [[ "$#" -eq 1 ]]; then
    # If the user has passed in a provider, update that provider.
    combine "$1"
else
    # Otherwise update every provider.
    jq -r '.[]' provider-ci/providers.json | while IFS= read -r provider; do
        combine "$provider"
    done
fi

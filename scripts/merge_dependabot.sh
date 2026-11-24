#!/usr/bin/env bash

# This script will combine and set to merge all dependabot PRs in bridged provider repos.
#
# To guard against supply side attacks, this will only merge dependabot PRs that were
# created before last week.

set -e

# Query syntax is https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests.
#
# author:app/dependabot restricts this to PRs authored by dependabot.
# created:<$(date -v-7d '+%Y-%m-%d') restricts to PRs created before 7 days ago
QUERY="author:app/dependabot created:<$(date --date "7 days ago" '+%Y-%m-%d')"

COMBINED_BRANCH=combined-pr-branch
LABELS=impact/no-changelog-required
LIMIT=50

# Combine all matching dependabot PRs in the current repository (the working
# directory must be a clone) into a single PR, and set it to auto-merge.
#
# This used to be done by the iwahbe/gh-combine-prs extension. That extension
# decides whether `git merge` succeeded by testing whether it printed anything,
# not by its exit status. A stale dependabot PR that conflicts with the default
# branch therefore left the work tree mid-merge, and the run later died in
# `gh pr create` with "could not find any commits between ...". The same run
# failed every time for as long as the stale PR stayed open. Here we check the
# exit status, skip PRs that do not merge, and only open a PR when at least one
# PR actually contributed commits.
combine_prs() {
    local default_branch body_file count=0 number headref description

    default_branch="$(gh api /repos/:owner/:repo --jq '.default_branch')"
    body_file="$(mktemp)"

    echo "The following PRs will be evaluated for inclusion:"
    gh pr list --search "${QUERY}" --limit "${LIMIT}"

    if [[ "$(gh pr list --search "${QUERY}" --limit 1 --json id --jq 'length')" = 0 ]]; then
        echo "No PRs are available"
        rm -f "$body_file"
        return 0
    fi

    cat > "$body_file" <<EOF
Combining multiple dependencies PRs into one.

<details>
<summary>Instructions for merging</summary>

* **Use a merge commit**, so that GitHub will mark all original PRs as merged.
* If your repository does not have merge commits enabled, please temporarily enable them in settings. Tick \`Allow merge commits\` in the repository settings.
* When ready, merge this PR using \`Create a merge commit\`.

</details>

## Combined PRs

EOF

    git fetch origin
    git checkout "$default_branch"
    git pull --ff-only
    git branch -D "$COMBINED_BRANCH" 2>/dev/null || true
    git checkout -b "$COMBINED_BRANCH"

    while IFS=$'\t' read -r number headref; do
        echo "Trying to merge $headref into $COMBINED_BRANCH"
        if ! git merge "origin/$headref" --no-edit; then
            echo "Unable to merge $headref - skipping PR #$number"
            git merge --abort
            continue
        fi
        echo "Merged $headref (#$number) into $COMBINED_BRANCH"
        description="$(gh pr view "$number" --json title,author,number \
            --template '{{.title}} (#{{.number}}) @{{.author.login}}')"
        echo "* ${description}" >> "$body_file"
        count=$((count + 1))
    done < <(gh pr list --search "${QUERY}" --limit "${LIMIT}" --json headRefName,number \
                 | jq -r '.[] | [.number, .headRefName] | @tsv')

    # A PR can merge cleanly and still add nothing, e.g. when its changes are
    # already on the default branch.
    if [[ "$(git rev-list --count "origin/$default_branch..$COMBINED_BRANCH")" = 0 ]]; then
        echo "No PRs could be combined, nothing to do"
        git checkout "$default_branch"
        git branch -D "$COMBINED_BRANCH"
        rm -f "$body_file"
        return 0
    fi

    echo "Combined $count PR(s). Preview of PR:"
    cat "$body_file"

    echo "Creating PR"
    git push origin "$COMBINED_BRANCH" --force
    # If there is no PR from this branch already, create it.
    if [[ "$(gh pr list --head "$COMBINED_BRANCH" --limit 1 --json id --jq 'length')" = 0 ]]; then
        gh pr create --fill --title "Combined dependencies PR" --body-file "$body_file" \
            --label "dependencies,${LABELS}"
    fi
    gh pr merge --auto --merge
    rm -f "$body_file"
}

combine() {
    provider="$1"
    D="$(mktemp -d)/pulumi-$provider"
    rm -rf "$D"
    gh repo clone "pulumi/pulumi-$provider" "$D"
    (cd "$D" && combine_prs)
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

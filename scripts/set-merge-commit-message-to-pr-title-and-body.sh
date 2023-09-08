#!/bin/bash

set -euo pipefail

# Check if the 'gh' command-line tool is installed
if ! command -v gh &> /dev/null; then
    echo "Error: 'gh' command-line tool is not installed. Please install GitHub CLI (https://cli.github.com/)." >&2
    exit 1
fi

# Check if the input file is "-" or if no argument is provided, default to stdin
input_file="${1:--}"
if [ "$input_file" = "-" ] ; then
    input_file="/dev/stdin"
elif [ ! -f "$input_file" ]; then
    echo "Error: Input file '$input_file' not found." >&2
    exit 1
fi

# Loop through each repository name in the file or from stdin
while IFS= read -r repo; do
    echo "setting (squash) merge commit message for \"$repo\""
    # suppress errors for merge since may repos only support squash
    gh api "repos/$repo" --silent --method=PATCH \
        -F merge_commit_message=PR_BODY -F merge_commit_title=PR_TITLE 2>/dev/null || true
    gh api "repos/$repo" --silent --method=PATCH \
        -F squash_merge_commit_message=PR_BODY -F squash_merge_commit_title=PR_TITLE || true
done < "$input_file"

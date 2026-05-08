#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

lockfiles=(
  ".github/workflows/gh-aw-pr-review.lock.yml"
  ".github/workflows/gh-aw-pr-rereview.lock.yml"
)

for lockfile in "${lockfiles[@]}"; do
  path="${repo_root}/${lockfile}"
  if [[ ! -f "${path}" ]]; then
    echo "missing gh-aw lockfile: ${lockfile}" >&2
    exit 1
  fi

  perl -0pi -e 's/(^  detection:\n(?:(?!^  [A-Za-z0-9_-]+:).)*?^    permissions:\n      contents: read\n)(?!      id-token: write\n)/$1      id-token: write\n/ms' "${path}"

  if ! awk '
    /^  detection:/ { in_detection = 1 }
    in_detection && /^  [A-Za-z0-9_-]+:/ && $1 != "detection:" { in_detection = 0 }
    in_detection && /id-token: write/ { found = 1 }
    END { exit found ? 0 : 1 }
  ' "${path}"; then
    echo "failed to add id-token: write to detection job in ${lockfile}" >&2
    exit 1
  fi
done

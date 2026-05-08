#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
template_root="${repo_root}/provider-ci/internal/pkg/templates/internal"

managed_paths=(
  ".github/aw/actions-lock.json"
  ".github/snippets"
  ".github/workflows/gh-aw-pr-rereview.lock.yml"
  ".github/workflows/gh-aw-pr-rereview.md"
  ".github/workflows/gh-aw-pr-review.lock.yml"
  ".github/workflows/gh-aw-pr-review.md"
  ".github/workflows/shared"
)

sync_into() {
  local dest="$1"

  for path in "${managed_paths[@]}"; do
    if [[ ! -e "${repo_root}/${path}" ]]; then
      echo "missing source path: ${path}" >&2
      return 1
    fi

    rm -rf "${dest:?}/${path}"
    mkdir -p "$(dirname "${dest}/${path}")"
    cp -R "${repo_root}/${path}" "${dest}/${path}"
  done
}

if [[ "${1:-}" == "--check" ]]; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "${tmp}"' EXIT

  sync_into "${tmp}"
  status=0
  for path in "${managed_paths[@]}"; do
    if ! diff -ru "${tmp}/${path}" "${template_root}/${path}"; then
      status=1
    fi
  done

  if [[ "${status}" -ne 0 ]]; then
    echo "gh-aw templates are out of sync. Run ./scripts/sync-gh-aw-templates.sh." >&2
  fi
  exit "${status}"
fi

sync_into "${template_root}"

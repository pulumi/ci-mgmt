#!/usr/bin/env bash

set -eo pipefail

rm -rf ./test-output/*

go build -o ./test-output/package-ci

PROVIDER="${1:-""}"

generate() {
  local name="${1:-""}"

  ./test-output/package-ci generate \
    --name "pulumi/pulumi-${name}" \
    --out "./test-output/providers/${name}/repo" \
    --template bridged-provider \
    --config "../provider-ci/providers/${name}/config.yaml"

  cp "../provider-ci/providers/${name}/config.yaml" "./test-output/providers/${name}"
}
run() {
  local dir="${1:-""}"

  if command -v difft &> /dev/null; then
    difft \
      "../provider-ci/providers/${dir}" \
      "./test-output/providers/${dir}" \
      --color=always \
      --skip-unchanged
  else
    echo "difftastic not found, using git diff"
    git diff --color=always \
      --no-index \
      "../provider-ci/providers/${dir}" \
      "./test-output/providers/${dir}"
  fi

  printf "\uf440 Diff complete!"
}

if [[ -n "$PROVIDER" ]]; then
  generate "$PROVIDER"
else
  # for every dir in ../provider-ci/providers run generate against that dir name
  for dir in ../provider-ci/providers/*; do
    name=$(basename "$dir")
    generate "$name" &
  done
fi

wait
echo "Done ✅"
wait

run "$PROVIDER" | less -r

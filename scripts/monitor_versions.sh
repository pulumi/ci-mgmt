#!/usr/bin/env bash

# Use this script to monitor dependency versions for latest releases across all managed providers.
# Currently only supports bridged providers.

set -euo pipefail

fetch_provider() {
    p="$1"
    D="/tmp/pulumi-$p"
    if test -d "$D"; then
        rm -rf "$D"
    fi
    tag=$(gh release list -R "pulumi/pulumi-$p" --exclude-drafts --exclude-pre-releases -L 1 | awk '{print $3}')
    (cd /tmp && git clone --quiet --depth=1 "git@github.com:pulumi/pulumi-$p.git" --branch "$tag") >/dev/null 2>/dev/null
    echo "$tag"
}

providers=$(curl https://raw.githubusercontent.com/pulumi/ci-mgmt/master/provider-ci/providers.json | jq -r .[])

echo "| P | rel | br | pf | pkg | sdk |"
for p in $providers
do
    D="/tmp/pulumi-$p"
    TAG=$(fetch_provider "$p")
    V1=$(cd "$D/provider" && go list -f '{{.Version}}' -m github.com/pulumi/pulumi-terraform-bridge/v3)
    V2=$(cd "$D/provider" && (go list -f '{{.Version}}' -m github.com/pulumi/pulumi-terraform-bridge/pf 2>/dev/null || echo "NA"))
    V3=$(cd "$D/provider" && go list -f '{{.Version}}' -m github.com/pulumi/pulumi/pkg/v3)
    V4=$(cd "$D/provider" && go list -f '{{.Version}}' -m github.com/pulumi/pulumi/sdk/v3)
    echo "| pulumi-$p | $TAG | $V1 | $V2 | $V3 | $V4 |"
done

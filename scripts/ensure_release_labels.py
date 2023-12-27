#!/usr/bin/env python3

# This script creates the needs-release/{major,minor,patch} labels necessary for our
# release process on all provider repos.
#
# The script is idempotent.

import subprocess
import json


def cmd(*args: str, prefix="Exec: ") -> str:
    print(prefix + " ".join(args))
    return subprocess.run(args,
                   capture_output=True,
                   check=True,
                   encoding="utf-8").stdout

def set_labels(repo: str):
    def label(kind: str, desc: str):
        cmd("gh", "label", "create", f"needs-release/{kind}",
            "--repo", repo,
            "--color", "#C5DEF5",
            "--force", # Update if another color; don't fail if no change
            "--description", f"When a PR with this label merges, it initiates a release of {desc}")

    label("major", "vX+1.0.0")
    label("minor", "vX.Y+1.0")
    label("patch", "vX.Y.Z+1")

def all_repos() -> [str]:
    with open("provider-ci/providers.json", "r") as f:
        return [f"pulumi/pulumi-{p}" for p in json.loads(f.read())]

if __name__ == "__main__":
    for repo in all_repos():
        set_labels(repo)

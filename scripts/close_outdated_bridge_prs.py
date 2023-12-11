#!/usr/bin/env python3

# This script closes pulumi-bot PRs that we will not merge.
#
# pulumi-bot opens lots of PRs. Because of the number of repos we maintain, all PRs that
# pulumi-bot opens that we want to merge are set to auto-merge. Other PRs are opened for
# test purposes, but we don't intend to merge these. We want to close these PRs after a
# couple of days to avoid them cluttering up the repo.
#
# This script accomplishes that.

import subprocess
import json
from datetime import datetime, timedelta


def cmd(*args: str, prefix="Exec: ") -> str:
    print(prefix + " ".join(args))
    return subprocess.run(args,
                   capture_output=True,
                   check=True,
                   encoding="utf-8").stdout

# PRs that would otherwise be closed are allowed to live for PR_LIFETIME_DAYS after their
# creation date.
PR_LIFETIME_DAYS=3

def close_outdated(repo: str):
    cutoff_date = (datetime.now() - timedelta(days=PR_LIFETIME_DAYS)).date().isoformat()
    issues = cmd("gh", "pr", "list",
                 "--repo", repo,
                 "--json", "author,title,autoMergeRequest,number",
                 "--search", f"author:pulumi-bot created:<{cutoff_date}",
                 )
    # Issues have this shape:
    #
    #     {
    #       "author": {
    #         "id": "MDQ6VXNlcjMwMzUxOTU1",
    #         "is_bot": false,
    #         "login": "pulumi-bot",
    #         "name": "Pulumi Bot"
    #       },
    #       "autoMergeRequest": {
    #         "authorEmail": null,
    #         "commitBody": null,
    #         "commitHeadline": null,
    #         "mergeMethod": "SQUASH",
    #         "enabledAt": "2023-11-22T00:23:34Z",
    #         "enabledBy": {
    #           "id": "MDQ6VXNlcjMwMzUxOTU1",
    #           "is_bot": false,
    #           "login": "pulumi-bot",
    #           "name": "Pulumi Bot"
    #         }
    #       },
    #       "labels": [
    #         {
    #           "id": "LA_kwDODYna9c8AAAABbWB-nw",
    #           "name": "needs-release/patch",
    #           "description": "",
    #           "color": "BFD4F2"
    #         }
    #       ],
    #       "number": 2204,
    #       "title": "Upgrade pulumi-terraform-bridge to v3.66.0"
    #     }
    #
    # "autoMergeRequest" may be `null`
    for issue in json.loads(issues):
        if issue["autoMergeRequest"] or issue["author"]["login"] != "pulumi-bot":
            # auto-merge: we don't need to close
            # non-bot author: not our concern
            continue
        if "labels" in issue:
            # if there are labels applied to the issue, assume a human added them and is working on it
            # Eg. a "needs-release/<version>" label would indicate that a release is in process.
            continue

        issue_title = issue["title"]
        issue_number = issue["number"]
        cmd("gh", "pr", "close", str(issue_number), "--repo", repo, prefix=f"Closing \"{issue_title}\":\n\t")

def all_repos() -> [str]:
    with open("provider-ci/providers.json", "r") as f:
        return [f"pulumi/pulumi-{p}" for p in json.loads(f.read())]

if __name__ == "__main__":
    for repo in all_repos():
        close_outdated(repo)

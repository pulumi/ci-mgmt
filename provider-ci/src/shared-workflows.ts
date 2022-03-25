import * as action from "./action-versions";

export class ArtifactCleanupWorkflow {
  name = "cleanup";
  on = {
    schedule: [
      {
        cron: "0 1 * * *",
      },
    ],
  };
  jobs = {
    "remove-old-artifacts": {
      "runs-on": "ubuntu-latest",
      steps: [
        {
          name: "Remove old artifacts",
          uses: action.cleanupArtifact,
          with: {
            age: "1 month",
            "skip-tags": true,
          },
        },
      ],
    },
  };
}

export class AutoMergeWorkflow {
  name = "pr-automation";
  on = {
    pull_request: {
      types: [
        "labeled",
        "unlabeled",
        "synchronize",
        "opened",
        "edited",
        "ready_for_review",
        "reopened",
        "unlocked",
      ],
    },
    pull_request_review: {
      types: ["submitted"],
    },
    check_suite: {
      types: ["completed"],
    },
    status: {},
  };
  jobs = {
    automerge: {
      name: "automerge labelled pull-requests",
      "runs-on": "ubuntu-latest",
      steps: [
        {
          name: "Automerge",
          uses: action.automerge,
          env: {
            GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
            MERGE_LABELS: "automation/merge,impact/no-changelog-required",
            MERGE_REMOVE_LABELS: "automation/merge",
            MERGE_METHOD: "squash",
            MERGE_COMMIT_MESSAGE: "pull-request-title",
            MERGE_FORKS: "false",
            MERGE_RETRIES: "30",
            MERGE_RETRY_SLEEP: "60000",
            UPDATE_LABELS: "automation/update",
            UPDATE_METHOD: "rebase",
          },
        },
      ],
    },
  };
}

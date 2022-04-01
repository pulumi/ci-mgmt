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

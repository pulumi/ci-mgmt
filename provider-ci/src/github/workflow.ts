import { OnClass } from "./on";
import { Defaults } from "./defaults";
import { Job } from "./job";

export enum Event {
  CheckRun = "check_run",
  CheckSuite = "check_suite",
  Create = "create",
  Delete = "delete",
  Deployment = "deployment",
  DeploymentStatus = "deployment_status",
  Fork = "fork",
  Gollum = "gollum",
  IssueComment = "issue_comment",
  Issues = "issues",
  Label = "label",
  Member = "member",
  Milestone = "milestone",
  PageBuild = "page_build",
  Project = "project",
  ProjectCard = "project_card",
  ProjectColumn = "project_column",
  Public = "public",
  PullRequest = "pull_request",
  PullRequestReview = "pull_request_review",
  PullRequestReviewComment = "pull_request_review_comment",
  Push = "push",
  RegistryPackage = "registry_package",
  Release = "release",
  RepositoryDispatch = "repository_dispatch",
  Status = "status",
  Watch = "watch",
}

export interface GithubWorkflow {
  name: string;
  jobs: { [k: string]: Job };
  on: Event[] | OnClass | Event;
  env?: { [key: string]: boolean | number | string };
  defaults?: Defaults;
}

/*
export class PulumiGithubWorkflow extends GithubWorkflow {
  constructor(name: string) {
    super(name, {
      foo: {
        name: 'something',
      }
    });
  }
}
*/

export interface OnClass {
  /**
   * Runs your workflow anytime the check_run event occurs. More than one activity type
   * triggers this event. For information about the REST API, see
   * https://developer.github.com/v3/checks/runs.
   */
  check_run?: null | PurpleEventObject;
  /**
   * Runs your workflow anytime the check_suite event occurs. More than one activity type
   * triggers this event. For information about the REST API, see
   * https://developer.github.com/v3/checks/suites/.
   */
  check_suite?: null | FluffyEventObject;
  /**
   * Runs your workflow anytime someone creates a branch or tag, which triggers the create
   * event. For information about the REST API, see
   * https://developer.github.com/v3/git/refs/#create-a-reference.
   */
  create?: { [key: string]: any } | null;
  /**
   * Runs your workflow anytime someone deletes a branch or tag, which triggers the delete
   * event. For information about the REST API, see
   * https://developer.github.com/v3/git/refs/#delete-a-reference.
   */
  delete?: { [key: string]: any } | null;
  /**
   * Runs your workflow anytime someone creates a deployment, which triggers the deployment
   * event. Deployments created with a commit SHA may not have a Git ref. For information
   * about the REST API, see https://developer.github.com/v3/repos/deployments/.
   */
  deployment?: { [key: string]: any } | null;
  /**
   * Runs your workflow anytime a third party provides a deployment status, which triggers the
   * deployment_status event. Deployments created with a commit SHA may not have a Git ref.
   * For information about the REST API, see
   * https://developer.github.com/v3/repos/deployments/#create-a-deployment-status.
   */
  deployment_status?: { [key: string]: any } | null;
  /**
   * Runs your workflow anytime when someone forks a repository, which triggers the fork
   * event. For information about the REST API, see
   * https://developer.github.com/v3/repos/forks/#create-a-fork.
   */
  fork?: { [key: string]: any } | null;
  /**
   * Runs your workflow when someone creates or updates a Wiki page, which triggers the gollum
   * event.
   */
  gollum?: { [key: string]: any } | null;
  /**
   * Runs your workflow anytime the issue_comment event occurs. More than one activity type
   * triggers this event. For information about the REST API, see
   * https://developer.github.com/v3/issues/comments/.
   */
  issue_comment?: null | TentacledEventObject;
  /**
   * Runs your workflow anytime the issues event occurs. More than one activity type triggers
   * this event. For information about the REST API, see
   * https://developer.github.com/v3/issues.
   */
  issues?: null | StickyEventObject;
  /**
   * Runs your workflow anytime the label event occurs. More than one activity type triggers
   * this event. For information about the REST API, see
   * https://developer.github.com/v3/issues/labels/.
   */
  label?: null | IndigoEventObject;
  /**
   * Runs your workflow anytime the member event occurs. More than one activity type triggers
   * this event. For information about the REST API, see
   * https://developer.github.com/v3/repos/collaborators/.
   */
  member?: null | IndecentEventObject;
  /**
   * Runs your workflow anytime the milestone event occurs. More than one activity type
   * triggers this event. For information about the REST API, see
   * https://developer.github.com/v3/issues/milestones/.
   */
  milestone?: null | HilariousEventObject;
  /**
   * Runs your workflow anytime someone pushes to a GitHub Pages-enabled branch, which
   * triggers the page_build event. For information about the REST API, see
   * https://developer.github.com/v3/repos/pages/.
   */
  page_build?: { [key: string]: any } | null;
  /**
   * Runs your workflow anytime the project event occurs. More than one activity type triggers
   * this event. For information about the REST API, see
   * https://developer.github.com/v3/projects/.
   */
  project?: null | AmbitiousEventObject;
  /**
   * Runs your workflow anytime the project_card event occurs. More than one activity type
   * triggers this event. For information about the REST API, see
   * https://developer.github.com/v3/projects/cards.
   */
  project_card?: null | CunningEventObject;
  /**
   * Runs your workflow anytime the project_column event occurs. More than one activity type
   * triggers this event. For information about the REST API, see
   * https://developer.github.com/v3/projects/columns.
   */
  project_column?: null | MagentaEventObject;
  /**
   * Runs your workflow anytime someone makes a private repository public, which triggers the
   * public event. For information about the REST API, see
   * https://developer.github.com/v3/repos/#edit.
   */
  public?: { [key: string]: any } | null;
  /**
   * Runs your workflow anytime the pull_request event occurs. More than one activity type
   * triggers this event. For information about the REST API, see
   * https://developer.github.com/v3/pulls.
   * Note: Workflows do not run on private base repositories when you open a pull request from
   * a forked repository.
   * When you create a pull request from a forked repository to the base repository, GitHub
   * sends the pull_request event to the base repository and no pull request events occur on
   * the forked repository.
   * Workflows don't run on forked repositories by default. You must enable GitHub Actions in
   * the Actions tab of the forked repository.
   * The permissions for the GITHUB_TOKEN in forked repositories is read-only. For more
   * information about the GITHUB_TOKEN, see
   * https://help.github.com/en/articles/virtual-environments-for-github-actions.
   */
  pull_request?: PurpleRef | null;
  /**
   * Runs your workflow anytime the pull_request_review event occurs. More than one activity
   * type triggers this event. For information about the REST API, see
   * https://developer.github.com/v3/pulls/reviews.
   * Note: Workflows do not run on private base repositories when you open a pull request from
   * a forked repository.
   * When you create a pull request from a forked repository to the base repository, GitHub
   * sends the pull_request event to the base repository and no pull request events occur on
   * the forked repository.
   * Workflows don't run on forked repositories by default. You must enable GitHub Actions in
   * the Actions tab of the forked repository.
   * The permissions for the GITHUB_TOKEN in forked repositories is read-only. For more
   * information about the GITHUB_TOKEN, see
   * https://help.github.com/en/articles/virtual-environments-for-github-actions.
   */
  pull_request_review?: null | FriskyEventObject;
  /**
   * Runs your workflow anytime a comment on a pull request's unified diff is modified, which
   * triggers the pull_request_review_comment event. More than one activity type triggers this
   * event. For information about the REST API, see
   * https://developer.github.com/v3/pulls/comments.
   * Note: Workflows do not run on private base repositories when you open a pull request from
   * a forked repository.
   * When you create a pull request from a forked repository to the base repository, GitHub
   * sends the pull_request event to the base repository and no pull request events occur on
   * the forked repository.
   * Workflows don't run on forked repositories by default. You must enable GitHub Actions in
   * the Actions tab of the forked repository.
   * The permissions for the GITHUB_TOKEN in forked repositories is read-only. For more
   * information about the GITHUB_TOKEN, see
   * https://help.github.com/en/articles/virtual-environments-for-github-actions.
   */
  pull_request_review_comment?: null | MischievousEventObject;
  /**
   * Runs your workflow when someone pushes to a repository branch, which triggers the push
   * event.
   * Note: The webhook payload available to GitHub Actions does not include the added,
   * removed, and modified attributes in the commit object. You can retrieve the full commit
   * object using the REST API. For more information, see
   * https://developer.github.com/v3/repos/commits/#get-a-single-commit.
   */
  push?: FluffyRef | null;
  /**
   * Runs your workflow anytime a package is published or updated. For more information, see
   * https://help.github.com/en/github/managing-packages-with-github-packages.
   */
  registry_package?: null | BraggadociousEventObject;
  /**
   * Runs your workflow anytime the release event occurs. More than one activity type triggers
   * this event. For information about the REST API, see
   * https://developer.github.com/v3/repos/releases/ in the GitHub Developer documentation.
   */
  release?: null | EventObject1;
  /**
   * You can use the GitHub API to trigger a webhook event called repository_dispatch when you
   * want to trigger a workflow for activity that happens outside of GitHub. For more
   * information, see
   * https://developer.github.com/v3/repos/#create-a-repository-dispatch-event.
   * To trigger the custom repository_dispatch webhook event, you must send a POST request to
   * a GitHub API endpoint and provide an event_type name to describe the activity type. To
   * trigger a workflow run, you must also configure your workflow to use the
   * repository_dispatch event.
   */
  repository_dispatch?: { [key: string]: any } | null;
  /**
   * You can schedule a workflow to run at specific UTC times using POSIX cron syntax
   * (https://pubs.opengroup.org/onlinepubs/9699919799/utilities/crontab.html#tag_20_25_07).
   * Scheduled workflows run on the latest commit on the default or base branch. The shortest
   * interval you can run scheduled workflows is once every 5 minutes.
   * Note: GitHub Actions does not support the non-standard syntax @yearly, @monthly, @weekly,
   * @daily, @hourly, and @reboot.
   * You can use crontab guru (https://crontab.guru/). to help generate your cron syntax and
   * confirm what time it will run. To help you get started, there is also a list of crontab
   * guru examples (https://crontab.guru/examples.html).
   */
  schedule?: (
    | any[]
    | boolean
    | ScheduleClass
    | number
    | number
    | null
    | string
  )[];
  /**
   * Runs your workflow anytime the status of a Git commit changes, which triggers the status
   * event. For information about the REST API, see
   * https://developer.github.com/v3/repos/statuses/.
   */
  status?: { [key: string]: any } | null;
  /**
   * Runs your workflow anytime the watch event occurs. More than one activity type triggers
   * this event. For information about the REST API, see
   * https://developer.github.com/v3/activity/starring/.
   */
  watch?: { [key: string]: any } | null;
}

export interface PurpleEventObject {
  types?: any[];
}

export interface FluffyEventObject {
  types?: any[];
}

export interface TentacledEventObject {
  types?: any[];
}

export interface StickyEventObject {
  types?: any[];
}

export interface IndigoEventObject {
  types?: any[];
}

export interface IndecentEventObject {
  types?: any[];
}

export interface HilariousEventObject {
  types?: any[];
}

export interface AmbitiousEventObject {
  types?: any[];
}

export interface CunningEventObject {
  types?: any[];
}

export interface MagentaEventObject {
  types?: any[];
}

export interface PurpleRef {
  types?: any[];
}

export interface FriskyEventObject {
  types?: any[];
}

export interface MischievousEventObject {
  types?: any[];
}

export interface FluffyRef {}

export interface BraggadociousEventObject {
  types?: any[];
}

export interface EventObject1 {
  types?: any[];
}

export interface ScheduleClass {
  cron?: string;
}

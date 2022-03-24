export interface GithubWorkflowClass {
    /**
     * Concurrency ensures that only a single job or workflow using the same concurrency group
     * will run at a time. A concurrency group can be any string or expression. The expression
     * can use any context except for the secrets context.
     * You can also specify concurrency at the workflow level.
     * When a concurrent job or workflow is queued, if another job or workflow using the same
     * concurrency group in the repository is in progress, the queued job or workflow will be
     * pending. Any previously pending job or workflow in the concurrency group will be
     * canceled. To also cancel any currently running job or workflow in the same concurrency
     * group, specify cancel-in-progress: true.
     */
    concurrency?: Concurrency | string;
    /**
     * A map of default settings that will apply to all jobs in the workflow.
     */
    defaults?: Defaults;
    /**
     * A map of environment variables that are available to all jobs and steps in the workflow.
     */
    env?: { [key: string]: boolean | number | string } | string;
    /**
     * A workflow run is made up of one or more jobs. Jobs run in parallel by default. To run
     * jobs sequentially, you can define dependencies on other jobs using the
     * jobs.<job_id>.needs keyword.
     * Each job runs in a fresh instance of the virtual environment specified by runs-on.
     * You can run an unlimited number of jobs as long as you are within the workflow usage
     * limits. For more information, see
     * https://help.github.com/en/github/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#usage-limits.
     */
    jobs: Jobs;
    /**
     * The name of your workflow. GitHub displays the names of your workflows on your
     * repository's actions page. If you omit this field, GitHub sets the name to the workflow's
     * filename.
     */
    name?: string;
    /**
     * The name of the GitHub event that triggers the workflow. You can provide a single event
     * string, array of events, array of event types, or an event configuration map that
     * schedules a workflow or restricts the execution of a workflow to specific files, tags, or
     * branch changes. For a list of available events, see
     * https://help.github.com/en/github/automating-your-workflow-with-github-actions/events-that-trigger-workflows.
     */
    on:           Event[] | OnClass | Event;
    permissions?: PermissionsEvent | PermissionsEnum;
}

export interface Concurrency {
    /**
     * To cancel any currently running job or workflow in the same concurrency group, specify
     * cancel-in-progress: true.
     */
    "cancel-in-progress"?: boolean | string;
    /**
     * When a concurrent job or workflow is queued, if another job or workflow using the same
     * concurrency group in the repository is in progress, the queued job or workflow will be
     * pending. Any previously pending job or workflow in the concurrency group will be canceled.
     */
    group: string;
}

/**
 * A map of default settings that will apply to all jobs in the workflow.
 */
export interface Defaults {
    run?: Run;
}

export interface Run {
    shell?:               string;
    "working-directory"?: string;
}

/**
 * A workflow run is made up of one or more jobs. Jobs run in parallel by default. To run
 * jobs sequentially, you can define dependencies on other jobs using the
 * jobs.<job_id>.needs keyword.
 * Each job runs in a fresh instance of the virtual environment specified by runs-on.
 * You can run an unlimited number of jobs as long as you are within the workflow usage
 * limits. For more information, see
 * https://help.github.com/en/github/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#usage-limits.
 */
export interface Jobs {
}

export enum Event {
    BranchProtectionRule = "branch_protection_rule",
    CheckRun = "check_run",
    CheckSuite = "check_suite",
    Create = "create",
    Delete = "delete",
    Deployment = "deployment",
    DeploymentStatus = "deployment_status",
    Discussion = "discussion",
    DiscussionComment = "discussion_comment",
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
    PullRequestTarget = "pull_request_target",
    Push = "push",
    RegistryPackage = "registry_package",
    Release = "release",
    RepositoryDispatch = "repository_dispatch",
    Status = "status",
    Watch = "watch",
    WorkflowCall = "workflow_call",
    WorkflowDispatch = "workflow_dispatch",
    WorkflowRun = "workflow_run",
}

export interface OnClass {
    /**
     * Runs your workflow anytime the branch_protection_rule event occurs. More than one
     * activity type triggers this event.
     */
    branch_protection_rule?: null | PurpleEventObject;
    /**
     * Runs your workflow anytime the check_run event occurs. More than one activity type
     * triggers this event. For information about the REST API, see
     * https://developer.github.com/v3/checks/runs.
     */
    check_run?: null | FluffyEventObject;
    /**
     * Runs your workflow anytime the check_suite event occurs. More than one activity type
     * triggers this event. For information about the REST API, see
     * https://developer.github.com/v3/checks/suites/.
     */
    check_suite?: null | TentacledEventObject;
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
     * Runs your workflow anytime the discussion event occurs. More than one activity type
     * triggers this event. For information about the GraphQL API, see
     * https://docs.github.com/en/graphql/guides/using-the-graphql-api-for-discussions
     */
    discussion?: null | StickyEventObject;
    /**
     * Runs your workflow anytime the discussion_comment event occurs. More than one activity
     * type triggers this event. For information about the GraphQL API, see
     * https://docs.github.com/en/graphql/guides/using-the-graphql-api-for-discussions
     */
    discussion_comment?: null | IndigoEventObject;
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
    issue_comment?: null | IndecentEventObject;
    /**
     * Runs your workflow anytime the issues event occurs. More than one activity type triggers
     * this event. For information about the REST API, see
     * https://developer.github.com/v3/issues.
     */
    issues?: null | HilariousEventObject;
    /**
     * Runs your workflow anytime the label event occurs. More than one activity type triggers
     * this event. For information about the REST API, see
     * https://developer.github.com/v3/issues/labels/.
     */
    label?: null | AmbitiousEventObject;
    /**
     * Runs your workflow anytime the member event occurs. More than one activity type triggers
     * this event. For information about the REST API, see
     * https://developer.github.com/v3/repos/collaborators/.
     */
    member?: null | CunningEventObject;
    /**
     * Runs your workflow anytime the milestone event occurs. More than one activity type
     * triggers this event. For information about the REST API, see
     * https://developer.github.com/v3/issues/milestones/.
     */
    milestone?: null | MagentaEventObject;
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
    project?: null | FriskyEventObject;
    /**
     * Runs your workflow anytime the project_card event occurs. More than one activity type
     * triggers this event. For information about the REST API, see
     * https://developer.github.com/v3/projects/cards.
     */
    project_card?: null | MischievousEventObject;
    /**
     * Runs your workflow anytime the project_column event occurs. More than one activity type
     * triggers this event. For information about the REST API, see
     * https://developer.github.com/v3/projects/columns.
     */
    project_column?: null | BraggadociousEventObject;
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
    pull_request_review?: null | EventObject1;
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
    pull_request_review_comment?: null | EventObject2;
    /**
     * This event is similar to pull_request, except that it runs in the context of the base
     * repository of the pull request, rather than in the merge commit. This means that you can
     * more safely make your secrets available to the workflows triggered by the pull request,
     * because only workflows defined in the commit on the base repository are run. For example,
     * this event allows you to create workflows that label and comment on pull requests, based
     * on the contents of the event payload.
     */
    pull_request_target?: FluffyRef | null;
    /**
     * Runs your workflow when someone pushes to a repository branch, which triggers the push
     * event.
     * Note: The webhook payload available to GitHub Actions does not include the added,
     * removed, and modified attributes in the commit object. You can retrieve the full commit
     * object using the REST API. For more information, see
     * https://developer.github.com/v3/repos/commits/#get-a-single-commit.
     */
    push?: TentacledRef | null;
    /**
     * Runs your workflow anytime a package is published or updated. For more information, see
     * https://help.github.com/en/github/managing-packages-with-github-packages.
     */
    registry_package?: null | EventObject3;
    /**
     * Runs your workflow anytime the release event occurs. More than one activity type triggers
     * this event. For information about the REST API, see
     * https://developer.github.com/v3/repos/releases/ in the GitHub Developer documentation.
     */
    release?: null | EventObject4;
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
    schedule?: Array<any[] | boolean | ScheduleClass | number | number | null | string>;
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
    /**
     * Allows workflows to be reused by other workflows.
     */
    workflow_call?: any[] | boolean | number | number | null | WorkflowCallObject | string;
    /**
     * You can now create workflows that are manually triggered with the new workflow_dispatch
     * event. You will then see a 'Run workflow' button on the Actions tab, enabling you to
     * easily trigger a run.
     */
    workflow_dispatch?: any[] | boolean | number | number | null | WorkflowDispatchObject | string;
    /**
     * This event occurs when a workflow run is requested or completed, and allows you to
     * execute a workflow based on the finished result of another workflow. For example, if your
     * pull_request workflow generates build artifacts, you can create a new workflow that uses
     * workflow_run to analyze the results and add a comment to the original pull request.
     */
    workflow_run?: null | EventObject5;
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

export interface FriskyEventObject {
    types?: any[];
}

export interface MischievousEventObject {
    types?: any[];
}

export interface BraggadociousEventObject {
    types?: any[];
}

export interface PurpleRef {
    types?: any[];
}

export interface EventObject1 {
    types?: any[];
}

export interface EventObject2 {
    types?: any[];
}

export interface FluffyRef {
    types?: any[];
}

export interface TentacledRef {
}

export interface EventObject3 {
    types?: any[];
}

export interface EventObject4 {
    types?: any[];
}

export interface ScheduleClass {
    cron?: string;
}

export interface WorkflowCallObject {
    /**
     * When using the workflow_call keyword, you can optionally specify inputs that are passed
     * to the called workflow from the caller workflow.
     */
    inputs?: WorkflowCallInputs;
    /**
     * A map of the secrets that can be used in the called workflow. Within the called workflow,
     * you can use the secrets context to refer to a secret.
     */
    secrets?: any[] | boolean | SecretsClass | number | number | null | string;
}

/**
 * When using the workflow_call keyword, you can optionally specify inputs that are passed
 * to the called workflow from the caller workflow.
 */
export interface WorkflowCallInputs {
}

export interface SecretsClass {
}

export interface WorkflowDispatchObject {
    /**
     * Input parameters allow you to specify data that the action expects to use during runtime.
     * GitHub stores input parameters as environment variables. Input ids with uppercase letters
     * are converted to lowercase during runtime. We recommended using lowercase input ids.
     */
    inputs?: WorkflowDispatchInputs;
}

/**
 * Input parameters allow you to specify data that the action expects to use during runtime.
 * GitHub stores input parameters as environment variables. Input ids with uppercase letters
 * are converted to lowercase during runtime. We recommended using lowercase input ids.
 */
export interface WorkflowDispatchInputs {
}

export interface EventObject5 {
    types?:     any[];
    workflows?: string[];
}

export interface PermissionsEvent {
    actions?:               PermissionsLevel;
    checks?:                PermissionsLevel;
    contents?:              PermissionsLevel;
    deployments?:           PermissionsLevel;
    discussions?:           PermissionsLevel;
    "id-token"?:            PermissionsLevel;
    issues?:                PermissionsLevel;
    packages?:              PermissionsLevel;
    pages?:                 PermissionsLevel;
    "pull-requests"?:       PermissionsLevel;
    "repository-projects"?: PermissionsLevel;
    "security-events"?:     PermissionsLevel;
    statuses?:              PermissionsLevel;
}

export enum PermissionsLevel {
    None = "none",
    Read = "read",
    Write = "write",
}

export enum PermissionsEnum {
    ReadAll = "read-all",
    WriteAll = "write-all",
}

/**
 * A map of default settings that will apply to all jobs in the workflow.
 */
export interface Defaults {
  run?: Run;
}

export interface Run {
  shell?: string;
  "working-directory"?: string;
}

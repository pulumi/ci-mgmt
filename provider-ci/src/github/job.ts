import { Defaults } from "./defaults";
import { Step } from "./step";

export type Name = string;

export interface Job {
  name?: string;
  needs?: [Name, ...Name[]] | Name;
  outputs?: {
    [k: string]: string;
  };
  env?: {
    [k: string]: string | number | boolean;
  };
  defaults?: Defaults;
  container?: string;
  steps: Step[] | Step;
  "runs-on": string;
  if?: string;
}

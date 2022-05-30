export type AssignmentType = "simple" | "conditional" | "recursive";

type Assignment =
  | string
  | {
      value: string;
      /** Assignment type:
       * - simple `:=`
       * - conditional `?=`
       * - recursive `=`
       * @default "simple" */
      type?: AssignmentType;
    };

export type Variables = Record<string, Assignment>;

export type Target = {
  /** Name of the target */
  name: string;
  /** Names or references of dependencies */
  dependencies?: (string | Target)[];
  /** Target-specific variable assignments */
  variables?: Variables;
  /** List of commands to execute
   *  Items which are arrays, will be concatenated with `&&`
   */
  commands?: (string | string[])[];
  /** Auto-emit .PHONY target */
  phony?: boolean;
};

export type Makefile = {
  variables?: Variables;
  targets?: Target[];
};

function getAssignmentToken(type: AssignmentType): string {
  switch (type) {
    case "simple":
      return ":=";
    case "conditional":
      return "?=";
    case "recursive":
      return "=";
  }
}

const indent = "\t";

function renderCommand(cmd: string | string[]) {
  if (Array.isArray(cmd)) {
    return cmd.map((step) => indent + step).join(" && \\\n" + indent);
  }
  return indent + cmd;
}

function renderTarget(target: Target): string {
  const dependencies = target.dependencies ?? [];
  const dependencyNames = dependencies.map((d) =>
    typeof d === "string" ? d : d.name
  );
  const declaration = `${target.name}:: ${dependencyNames.join(" ")}`;
  const commands = target.commands?.map(renderCommand) ?? [];
  const variables = Object.entries(target.variables ?? {})
    .map(renderVariable)
    .map((v) => target.name + ":: " + v);
  return [...variables, declaration, ...commands].join("\n");
}

function renderVariable([name, assignment]: [string, Assignment]): string {
  if (typeof assignment === "string") {
    return `${name} := ${assignment}`;
  }
  const assignmentToken = getAssignmentToken(assignment.type ?? "simple");
  return `${name} ${assignmentToken} ${assignment.value}`;
}

function phonyTarget(targets: Target[]): Target | undefined {
  const phonyTargets = targets.filter((t) => t.phony);
  if (phonyTargets.length === 0) {
    return undefined;
  }
  return {
    name: ".PHONY",
    dependencies: phonyTargets,
  };
}

export function render(makefile: Makefile): string {
  const variableLines = Object.entries(makefile.variables ?? {}).map(
    renderVariable
  );

  const inputTargets = makefile.targets ?? [];
  const phony = phonyTarget(inputTargets);
  if (phony !== undefined) {
    inputTargets.push(phony);
  }
  const targets = inputTargets.map(renderTarget);

  return [variableLines.join("\n"), targets.join("\n\n")].join("\n\n");
}

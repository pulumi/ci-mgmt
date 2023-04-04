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
      /** Whether to export the variable */
      export?: boolean;
    };

type VariableAssignment = Assignment | Conditional<Assignment>;

export type Variables = Record<string, VariableAssignment>;

export type Target = {
  /** Name of the target */
  name: string;
  /** Names or references of dependencies */
  dependencies?: (string | Target | null)[];
  /** Target-specific variable assignments */
  variables?: Variables;
  /** List of commands to execute
   *  Items which are arrays, will be concatenated with `&&`
   */
  commands?: Command[];
  /** Auto-emit .PHONY target */
  phony?: boolean;
  /** Auto-touch file on completion */
  autoTouch?: boolean;
};

export type Command = string | string[] | Conditional<Command>;

// Note: Conditional cannot be an interface because interfaces prevent recursive
// definition.
// Note: Nested conditionals are not supported.
export interface Conditional<T> {
  parts: {
    test: string;
    then: T[];
  }[];
  end: string;
}

function isConditional<T>(value: unknown): value is Conditional<T> {
  return typeof value === "object" && value !== null && "parts" in value;
}

export type Makefile = {
  variables?: Variables;
  targets?: Target[];
  defaultTarget?: Target | string;
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

function renderCommand(cmd: Command) {
  if (isConditional(cmd)) {
    return renderConditional(cmd, (c: Command[]) =>
      renderCommands(c).join("\n")
    );
  }
  if (Array.isArray(cmd)) {
    return cmd.map((step) => indent + step).join(" && \\\n" + indent);
  }
  if (cmd.startsWith("#")) {
    return cmd;
  }
  return indent + cmd;
}

function renderConditional<T>(
  cond: Conditional<T>,
  render: (v: T[]) => string
): string {
  return (
    cond.parts.map((part) => part.test + "\n" + render(part.then)).join("\n") +
    "\n" +
    cond.end
  );
}

function renderCommands(commands?: Command[] | undefined): string[] {
  return commands?.map(renderCommand) ?? [];
}

function renderTarget(target: Target): string {
  const dependencies = target.dependencies ?? [];
  const dependencyNames = dependencies
    .filter((x): x is string | Target => x !== null)
    .map((d) => " " + (typeof d === "string" ? d : d.name));
  const declaration = `${target.name}:${dependencyNames.join("")}`;
  const commands = renderCommands(target.commands);
  const suffixCommands =
    target.autoTouch ?? false ? renderCommands(["@touch $@"]) : [];
  const variables = Object.entries(target.variables ?? {})
    .map(renderVariable)
    .map((v) => target.name + ": " + v);
  return [...variables, declaration, ...commands, ...suffixCommands].join("\n");
}

function renderVariable([name, assignment]: [
  string,
  VariableAssignment
]): string {
  if (isConditional(assignment)) {
    return renderConditional(assignment, (a: VariableAssignment[]) =>
      a.map((a) => renderVariable([name, a])).join("\n")
    );
  }
  if (typeof assignment === "string") {
    return `${name} := ${assignment}`;
  }
  const assignmentToken = getAssignmentToken(assignment.type ?? "simple");
  const exportModifier = assignment.export ? "export " : "";
  return `${exportModifier}${name} ${assignmentToken} ${assignment.value}`;
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

function deduplicateTargets(targets: Target[]): Target[] {
  const map = new Map(targets.map((t) => [t.name, t]));
  return Array.from(map.values());
}

function descendentTargets(target: Target): Target[] {
  if (target.dependencies === undefined) {
    return [target];
  }
  const dependencies: (string | Target)[] = target.dependencies.filter(
    (x): x is string | Target => x !== null
  );
  return deduplicateTargets([
    target,
    ...dependencies.flatMap((t) =>
      typeof t !== "string" ? descendentTargets(t) : []
    ),
  ]);
}

function sortTargets(targets: Target[], defaultTarget?: Target | string) {
  const defaultName =
    typeof defaultTarget === "string" ? defaultTarget : defaultTarget?.name;
  function sortKey(target: Target) {
    const isDefault = target.name === defaultName ? "0" : "1";
    const isPhony = target.phony ? "0" : "1";
    const isAlias =
      target.commands === undefined || target.commands.length === 0 ? "0" : "1";
    return `${isDefault}-${isPhony}-${isAlias}-${target.name}`;
  }
  const sorted = [...targets].sort((a, b) =>
    sortKey(a).localeCompare(sortKey(b), undefined, {
      sensitivity: "base",
    })
  );
  return sorted;
}

export function render(makefile: Makefile): string {
  const variableLines = Object.entries(makefile.variables ?? {}).map(
    renderVariable
  );

  const targets = makefile.targets ?? [];
  if (typeof makefile.defaultTarget === "object") {
    targets.push(makefile.defaultTarget);
  }
  const inputTargets = deduplicateTargets(targets.flatMap(descendentTargets));
  const sortedTargets = sortTargets(inputTargets, makefile.defaultTarget);
  const phony = phonyTarget(sortedTargets);
  if (phony !== undefined) {
    sortedTargets.push(phony);
  }
  const renderedTargets = sortedTargets.map(renderTarget);

  return (
    [variableLines.join("\n"), renderedTargets.join("\n\n")].join("\n\n") + "\n"
  );
}

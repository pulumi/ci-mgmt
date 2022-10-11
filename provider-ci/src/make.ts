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
  /** Auto-touch file on completion */
  autoTouch?: boolean;
};

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

function renderCommand(cmd: string | string[]) {
  if (Array.isArray(cmd)) {
    return cmd.map((step) => indent + step).join(" && \\\n" + indent);
  }
  return indent + cmd;
}

function renderCommands(
  commands?: (string | string[])[] | undefined
): string[] {
  return commands?.map(renderCommand) ?? [];
}

function renderTarget(target: Target): string {
  const dependencies = target.dependencies ?? [];
  const dependencyNames = dependencies.map((d) =>
    typeof d === "string" ? d : d.name
  );
  const declaration = `${target.name}: ${dependencyNames.join(" ")}`;
  const commands = renderCommands(target.commands);
  const suffixCommands =
    target.autoTouch ?? false ? renderCommands(["@touch $@"]) : [];
  const variables = Object.entries(target.variables ?? {})
    .map(renderVariable)
    .map((v) => target.name + ": " + v);
  return [...variables, declaration, ...commands, ...suffixCommands].join("\n");
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

function deduplicateTargets(targets: Target[]): Target[] {
  const map = new Map(targets.map((t) => [t.name, t]));
  return Array.from(map.values());
}

function descendentTargets(target: Target): Target[] {
  if (target.dependencies === undefined) {
    return [target];
  }
  return deduplicateTargets([
    target,
    ...target.dependencies.flatMap((t) =>
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

  return [variableLines.join("\n"), renderedTargets.join("\n\n")].join("\n\n");
}

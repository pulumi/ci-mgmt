import { Target } from "./make";

/** Add `&&` between each */
function shellChain(...commands: string[]): string {
  return commands.join(" && ");
}

export function cwd(dir: string, ...commands: string[]): string {
  return shellChain(`cd ${dir}`, ...commands);
}

export function goBuild({
  binaryName,
  goDir,
}: {
  binaryName: string;
  goDir: string;
}): Target {
  return {
    name: `bin/${binaryName}`,
    dependencies: ["$(GO_SRC)"],
    commands: [
      shellChain(
        `cd ${goDir}`,
        `go build -o $(CWD)/bin/${binaryName} $(VERSION_FLAGS) $(CWD)/${goDir}/cmd/${binaryName}`
      ),
    ],
  };
}

interface GenSchemaArgs {
  schemaDir: string;
  genBinaryName: string;
}

export function genSchema({ schemaDir, genBinaryName }: GenSchemaArgs): Target {
  return {
    name: `${schemaDir}/schema.json`,
    dependencies: [`bin/${genBinaryName}`],
    commands: [`bin/${genBinaryName} schema $(CWD)/${schemaDir}`],
  };
}

export function yarnInstall({ dir }: { dir: string }): Target {
  return {
    name: `${dir}/node_modules`,
    dependencies: [`${dir}/package.json`, `${dir}/yarn.lock`],
    commands: [
      `yarn install --cwd ${dir} --no-progress`,
      `@touch ${dir}/node_modules`,
    ],
  };
}

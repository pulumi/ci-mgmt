// Automates automatically editing provider source code.
//
// Run this script as:
//
//     npx ts-node index.ts ~/code/my-provider
//
// It will try every source code migration on the provided directory. Every migration that matches at least one file
// will edit it.
//
// Source code migrations should be very specifically targeted and idempotent.

import * as child from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as shell from "shelljs";

interface SourceMigration {
  name: string;
  execute: (context: MigrateContext) => Promise<any>;
}

interface MigrateContext {
  dir: string;
}

// Example migration (no longer in use):
//
// function updateExamplesFromCore31DotNet6(): SourceMigration {
//     let pattern = new RegExp("[<]TargetFramework[>]netcoreapp3.1[<][/]TargetFramework[>]");
//     let replacement = "<TargetFramework>net6.0</TargetFramework>"
//     let sm: SourceMigration = {
//         name: "updateExamplesFromCore31DotNet6",
//         execute: (ctx: MigrateContext) => {
//             let stdout = child.execSync("git ls-files examples", {cwd: ctx.dir});
//             let filesEdited = String(stdout).split("\n")
//                 .filter(x => x.endsWith(".csproj"))
//                 .filter(x => replaceInFile(path.join(ctx.dir, x), pattern, replacement)).length;
//             return {filesEdited: filesEdited};
//         },
//     };
//     return sm;
// }

// function fileContains(f: string, pattern: RegExp): boolean {
//     let contents = String(fs.readFileSync(f));
//     return pattern.test(contents);
// }

// function replaceInFile(f: string, pattern: RegExp, replacement: string): boolean {
//     let contents = String(fs.readFileSync(f));
//     if (pattern.test(contents)) {
//         let updatedContents = contents.replace(pattern, replacement)
//         if (updatedContents != contents) {
//             fs.writeFileSync(f, updatedContents);
//             return true;
//         } else {
//             return false;
//         }
//     } else {
//         return false;
//     }
// }

function checkError(res: shell.ShellString): shell.ShellString {
  if (res.code !== 0) {
    throw new Error(`Command failed: ${res.stderr}`);
  }
  return res;
}

function run(command: string): shell.ShellString {
  return checkError(shell.exec(command));
}

// function respectSchemaVersion(): SourceMigration {
//   return {
//     name: "Respect Schema Version",
//     async execute(context) {
//       const patchPath = fs.realpathSync("respectSchemaVersion.patch");
//       shell.pushd(context.dir);
//       try {
//         // Apply patch
//         run(
//           `go run github.com/uber-go/gopatch@latest -p "${patchPath}" ./provider/resources.go`
//         );
//         // Format the code - twice to ensure that the code is formatted correctly
//         run(`go install mvdan.cc/gofumpt@latest`);
//         run(`gofumpt -w ./provider/resources.go`);
//         run(`gofumpt -w ./provider/resources.go`);
//         // Check if we've made changes
//         const gitStatus = run(`git status --porcelain`).stdout;
//         if (gitStatus.includes("provider/resources.go")) {
//           run(`make tfgen build`);
//         }
//       } finally {
//         shell.popd();
//       }
//     },
//   };
// }

async function runMigrations(
  context: MigrateContext,
  migrations: SourceMigration[]
) {
  for (let m of migrations) {
    console.log("Running migration", m.name);
    await m.execute(context);
  }
}

function allMigrations(): SourceMigration[] {
  return [];
}

async function main() {
  let dir = process.argv[2];
  if (dir === undefined) {
    console.log("Usage: npx ts-node index.ts DIR");
    return;
  }
  await runMigrations({ dir: dir }, allMigrations());
}

main().catch((e) => console.error(e));

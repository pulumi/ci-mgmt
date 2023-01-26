// Automates automatically editing provider source code.
//
// Run this scirpt as:
//
//     npx ts-node index.ts ~/code/my-provider
//
// It will try every source code migration on the provided directory. Every migration that matches at least one file
// will edit it.
//
// Source code migrations should be very specifically targeted and idempotent.

import * as child from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface SourceMigration {
    name: string;
    execute: (context: MigrateContext) => MigrateResult;
}

interface MigrateContext {
    dir: string;
}

interface MigrateResult {
    filesEdited: Number;
}

function updateExamplesFromCore31DotNet6(): SourceMigration {
    let pattern = new RegExp("[<]TargetFramework[>]netcoreapp3.1[<][/]TargetFramework[>]");
    let replacement = "<TargetFramework>net6.0</TargetFramework>"
    let sm: SourceMigration = {
        name: "updateExamplesFromCore31DotNet6",
        execute: (ctx: MigrateContext) => {
            let stdout = child.execSync("git ls-files examples", {cwd: ctx.dir});
            let filesEdited = String(stdout).split("\n")
                .filter(x => x.endsWith(".csproj"))
                .filter(x => replaceInFile(path.join(ctx.dir, x), pattern, replacement)).length;
            return {filesEdited: filesEdited};
        },
    };
    return sm;
}

function updatePulumiCoreRefTo3x(): SourceMigration {
    let pattern = new RegExp('["][@]pulumi[/]pulumi["][:]\\s+["][^]2[.]0[.]0"');
    let replacement = '"@pulumi/pulumi": "^3.0.0"';
    let sm: SourceMigration = {
        name: "updatePulumiCoreRefTo3x",
        execute: (ctx: MigrateContext) => {
            let stdout = child.execSync("git ls-files examples", {cwd: ctx.dir});
            let filesEdited = String(stdout).split("\n")
                .filter(x => x.endsWith("package.json"))
                .filter(x => replaceInFile(path.join(ctx.dir, x), pattern, replacement)).length;
            return {filesEdited: filesEdited};
        },
    };
    return sm;
}

function updateGoTo_1_19(): SourceMigration {
    let pattern = new RegExp('^go \\d+[.]\\d+$', 'm');
    let replacement = "go 1.19";
    let sm: SourceMigration = {
        name: "updateGoTo_1_19",
        execute: (ctx: MigrateContext) => {
            let stdout = child.execSync("git ls-files -- '**/go.mod'", {cwd: ctx.dir});
            let filesEdited = String(stdout).split("\n")
                .filter(x => x.endsWith("go.mod"))
                .filter(x => {
                    let f = path.join(ctx.dir, x);
                    let replaced = replaceInFile(f, pattern, replacement);
                    if (replaced) {
                        child.execSync("go mod tidy", {cwd: path.dirname(f)});
                    }
                    return replaced;
                }).length;
            return {filesEdited: filesEdited};
        },
    };
    return sm;
}

function replaceInFile(f: string, pattern: RegExp, replacement: string): boolean {
    let contents = String(fs.readFileSync(f));
    if (pattern.test(contents)) {
        let updatedContents = contents.replace(pattern, replacement)
        fs.writeFileSync(f, updatedContents);
        return true;
    } else {
        return false;
    }
}

function runMigrations(context: MigrateContext, migrations: SourceMigration[]) {
    migrations.forEach(m => {
        let result = m.execute(context);
        if (result.filesEdited == 0) {
            console.log(m.name, "no-op - source code already up to date");
        } else {
            console.log(m.name, result.filesEdited + " file(s) edited");
        }
    });
}

function allMigrations(): SourceMigration[] {
    return [
        updateExamplesFromCore31DotNet6(),
        updatePulumiCoreRefTo3x(),
        updateGoTo_1_19(),
    ];
}

function main() {
    let dir = process.argv[2];
    if (dir === undefined) {
        console.log("Usage: npx ts-node index.ts DIR");
        return
    }
    runMigrations({dir: dir}, allMigrations());
}

main();

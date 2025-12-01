# Mise Tasks in This Repository

This document explains how we structure and use [mise](https://mise.jdx.dev/) tasks for the Docker provider. Pair it with the upstream mise docs for full syntax details; this page highlights the repo-specific conventions and the “gotchas” we hit most often.


## High-Level Workflow
- We rely on mise as our task runner and dependency graph engine. Every task lives in `.config/tasks/provider-base.toml`.
- `mise run <task>` resolves all declared `depends` first, building a DAG and fanning tasks out in parallel when possible.
- Outputs/sources are configured for the heavier tasks so mise can skip work unless you pass `--force`.

Two top-level orchestrators drive most workflows:
- `generate` ⇒ regenerates the provider schema, SDKs, and registry docs.
- `build` ⇒ everything `generate` does, plus compiles SDKs, installs local packages, and builds the provider binary.


## Dependency Conventions
- **Schema-first:** Anything that consumes `provider/cmd/pulumi-resource-docker/schema.json` depends on the `schema` task. That task is the only entry point that runs both `docs:examples` and `tfgen:build`.
- **Upstream bootstrapping:** `tfgen:build` depends on `upstream` and `dirs`. Always call the `schema` task (or a task that depends on it) instead of invoking `upstream` directly so we avoid racing the git submodule.
- **Orchestration tasks use `depends`:** Aggregators such as `generate:sdks`, `build:sdks`, and `install:sdks` exist just to “fan out” to specific language tasks. They declare dependencies rather than re-enqueueing tasks via the `run` array. That keeps the DAG clean and prevents duplicate execution when you pass `--force`.
- **Wrapper tasks keep `run` arrays:** Tasks like `provider` add setup steps (e.g., `mkdir -p bin`) and then call `provider:build-binary`. We keep these as `run = [{ task = ... }]` so wrappers can enforce sequencing or add commands around the shared work.

## Sources, Outputs, and Sentinels
- **Always wire real dependencies through `sources`:** if a task’s work depends on a file (local patches, templates, generated metadata), include it in `sources` so Mise can decide whether to skip the task. Example: the `upstream` task now reads the submodule HEAD path via `"{{ exec(command='git rev-parse --git-path modules/upstream/HEAD') | trim }}"` so it works both in a normal clone and in git worktrees.
- **Let Mise manage outputs unless consumers need a file:** whenever a task declares `sources` but no `outputs`, Mise automatically creates an internal sentinel under `~/.local/state/mise/task-auto-outputs/<hash>`. That is enough to short-circuit future runs, so we no longer list `.make/upstream` as an explicit output.
- **Create project-visible sentinels when other tasks need them:** we still `touch .make/upstream` inside the task even though Mise has its own auto output. Downstream tasks (`schema`, `provider`, etc.) watch `.make/upstream` in their `sources`, so keeping the sentinel makes those dependencies explicit and greppable.
- **Explicit `outputs = [...]` is now the exception:** only add it when we truly emit a file that external tools consume (archives, SDK packages, coverage reports) or when another automation expects the artifact in a predictable location. Otherwise the default auto-output keeps the task definitions shorter and avoids “fake” files whose only job was to make Mise happy.


## Task Categories
- **Schema generation:** `schema`, `tfgen`, `tfgen:no-deps`. Run `mise run schema --force` to rebuild schema + docs without touching SDKs.
- **SDK generation/build/install:**
  - `generate:<lang>` produce language SDKs (depends on `schema`).
  - `build:<lang>` compile/package the SDKs. Each default build task depends on `generate:sdks:<lang>` so schema/codegen only run once.
  - `build:<lang>:skip` variants package the already-generated sources; call these directly when you truly want to bypass schema/codegen.
  - `install:<lang>` publish artifacts locally and depend on their matching build task.
  - `install:<lang>:skip` helpers reuse the skip build outputs so you can relink without upstream work.
  - The aggregate tasks (`generate:sdks`, `build:sdks`, `install:sdks`) depend on the default per-language entries; remember to add new languages to those dependency arrays when you introduce them.
- **Provider binary:** `provider` (full chain) and `provider:no-deps` (skip schema validation) both drive `provider:build-binary`.
- **Docs:** `build:registry-docs` depends on `schema` so it never races the schema build.
- **Testing:** `test` and `test:provider` both depend on the full `build` task to guarantee binaries and SDKs are fresh.


## Running Tasks
- Standard build: `mise run build`
- Regenerate everything: `mise run generate`
- Targeted languages: `mise run generate:python`, `mise run build:dotnet`, etc.
- Fast packaging without schema/codegen: invoke `mise run build:sdks:nodejs:skip` (and the analogous `install:sdks:<lang>:skip`) directly when needed.
- Skip work when nothing changed: just run the task; mise skips when outputs are fresh.
- Force reruns: `mise run <task> --force`. Use sparingly—forcing multiple branches can queue the same prerequisite twice unless it shares a single dependency path (which is why we rewired `schema` to be the single entry point).


## Gotchas & Tips
- **Avoid double-running `upstream`:** The shared dependency wiring ensures `upstream` only executes once per invocation. If you see git lock errors, verify that any new task consuming `schema.json` depends on `schema` (not `tfgen:build`).
- **Parallelism matters:** Mise tries to run independent tasks concurrently. If you need sequential output, `mise run <task> --raw` forces jobs=1.
- **`depends_post`/`wait_for`:** We currently don’t use these; all critical orchestration happens through `depends`. If you introduce long-running background tasks, prefer `depends` unless the task truly is optional.
- **Adding new tasks:** Prefer declaring dependencies over shelling out to `mise run` manually—otherwise you bypass DAG deduplication and caching.
- **Debug helpers:** `mise tasks deps <task>` prints the resolved dependency tree; use it whenever you change wiring.

## GitHub Actions Caching Playbook
How our GitHub workflows reuse build artifacts now that Mise drives the tasks.

### Artifact vs. Mise Cache
- **Mise runtime cache** (enabled via `jdx/mise-action`) keeps tool installations warm between runs. It does *not* restore task outputs.
- **GitHub artifacts** carry the generated files (`bin/`, `schema.json`, SDK tarballs, etc.) from the prerequisites workflow to downstream jobs. When an artifact is unpacked, the restored files pick up the timestamp from the archive so Mise treats them as fresh outputs.

### When You Do *Not* Need `mark`
You can rely on the restored files alone when a task declares a concrete output:
- `schema` writes `provider/cmd/pulumi-resource-aws/schema.json`.
- `provider` writes `bin/pulumi-resource-aws`.
- Each `build:sdks:<lang>` task emits real SDK content (tarballs, compiled binaries) that we publish as artifacts.
As long as the artifact download happens before those tasks run, Mise sees the outputs as current and skips the work automatically.

### When You *Do* Need `mark`
Some tasks only record completion by touching `.make/...` sentinels. Those files are not part of the artifacts we upload, so downstream jobs must recreate them with `mise run mark …` before calling aggregate tasks such as `install:sdks`. The `mark` helper touches both the `generate:sdks:<lang>` and `build:sdks:<lang>` sentinels that those installers require.

### Workflow Tips
- Always run `mise run prepare:workspace` (or the equivalent setup task) before restoring artifacts so the directory structure exists.
- Restore the prerequisites artifact immediately after setup and before running any Mise tasks that depend on it; this guarantees their `sources` timestamps reflect the restored files.
- If you add a new task that only produces a sentinel, either store that sentinel in an artifact or extend the `mark` helper so downstream jobs can rehydrate it.

### FAQ: Why Does Restoring `schema.json` Skip `mise run schema`?
- Git checkout gives every file the same “clone-time” mtime, so at the start of the prerequisites job the schema output looks as old as its inputs.
- The schema generator is content-aware: if it would produce identical JSON it simply exits without touching the file. That means the timestamp in the prerequisites workspace can remain the original checkout time even though the task ran to completion.
- When `actions/upload-artifact` packages the workspace and the downstream job unpacks it, the file is written back to disk with a fresh mtime (GitHub Actions preserves the extraction time, not the old checkout time). The companion binaries in `bin/` receive the same treatment.
- As long as we restore the artifact before invoking schema-dependent tasks, Mise observes outputs that are at least as new as their sources, so it skips re-running the expensive codegen even when the JSON content hasn’t changed.

## Frequently Asked Questions

**How do I tell if a task is an orchestrator or a wrapper?**  
Check the task body. If it only fans out to other tasks (no extra commands, env, or setup) then it’s an orchestration task and should list those tasks in `depends`. If it performs work directly—or runs commands before/after invoking a shared helper—keep it as a wrapper with a `run` array. When in doubt, inspect the dependency tree with `mise tasks deps <task>` and ensure you’re not accidentally rerunning prerequisites.

**What should I run for the old `make build`?**  
Use `mise run build`. That task triggers schema generation, SDK builds, installs, and the provider binary—mirroring the legacy top-level build flow.

**Can I run only a specific task without its dependencies?**  
Mise always evaluates dependencies; there’s no flag to bypass them. In practice that rarely matters—dependency tasks exit quickly when their outputs are current, as long as you avoid `--force`. If you truly need a dependency-free shortcut, add a dedicated helper task that runs just the command you want, but be sure you understand the risks before doing so.



## Further Reading
- Mise task configuration reference: <https://mise.jdx.dev/tasks/task-configuration.html>
- CLI usage and flags: <https://mise.jdx.dev/cli/tasks/run.html>

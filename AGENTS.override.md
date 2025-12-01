## Mise Task Migration Notes

We are working on migrating the current Makefile approach to mise tasks. The goal is to keep the same workflow as we have in Make, but refactored to use the enhanced capabilities of mise tasks.

Use context7 to lookup docs for mise if needed. Library id `/jdx/mise`

Docs are being maintained in this repo at `docs/mise-tasks.md`. Read/Update these as needed.

These notes capture the working context for migrating provider Makefiles to mise tasks during the hackathon. Follow this workflow when continuing the effort.

### Repository Layout
- All work happens in `~/work/ci-mgmt/mise-tasks-hackathon`.
- We are using `~/work/pulumi-aws/test-mise-tasks` as the test repo to test out locally.
  - Key files are:
    - `~/work/pulumi-aws/test-mise-tasks/.config/mise/tasks/*` (contains the new mise tasks)
    - `~/work/pulumi-aws/test-mise-tasks/.config/provider-base.toml` (contains the new mise task file)
    - `~/work/pulumi-aws/test-mise-tasks/Makefile` (old Makefile that we are migrating)

### Iteration Loop
1. Edit `~/work/pulumi-aws/test-mise-tasks/.config/provider-base.toml` (or related file tasks).  
2. From `~/work/pulumi-aws/test-mise-tasks`, run `mise` commands.  
  - `mise run build` runs the entire build and has _a lot_ of logs.
  - `mise run build --dry-run` can be used to test syntax of the mise tasks. Produces minimal logs

### Additional Context
- The migration starts by limiting mise tasks to bridged providers; include the new task file via `include` in `provider-ci/mise.toml` (only for bridged providers initially).
- Keep the existing Makefile targets until we have parity; a shim that forwards common targets to `mise run` can be introduced later.
- If you need to inspect generated Makefiles for reference, use the test providers under `provider-ci/test-providers/`.

### Caution
- Do not edit the Makefile in provider repos. These must remain as is.
- Ensure commands are run from the correct working directory.

For my hackathon this week I wanted to investigate using [mise tasks](https://mise.jdx.dev/tasks/) in provider land as an alternative to Makefiles. I built a POC in [pulumi-aws](https://github.com/pulumi/pulumi-aws/pull/5941/files) to get a sense of what it would look like. Some highlights:

  - Parallel DAG execution cuts full provider build times roughly in half (54% faster locally).
  - Shared file tasks + repo-level overrides make customization _much_ easier. (e.g. removes the need for `buildProviderPre` and other brittle Make hooks).
  - Built-in [usage](https://github.com/jdx/usage) metadata and caching make local workflows clearer (e.g. `mise run <task> --help` or `mise run test -- --run SomeIndividualTest`).

I've also written a doc highlighting some of the benefits I see. https://docs.google.com/document/d/1_Y9aI3ktBiEdBLHieiKf_eJ0BKi-8pnbBMimYjxme8w/edit?tab=t.p94i85r61xub


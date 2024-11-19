# Provider templates

This directory contains all of the templates we use for generating GitHub
workflows (among other things) for Pulumi providers.

These templates are composable and additive, for example many templates mix in
the "pulumi-provider" to include our code of conduct.

The full list of supported templates is available in
[`generate.go`](../generate.go), but this documentation focuses on the
"generic" template and the general direction and design principles we should
apply when modifying these templates.

## Generic template

The [`generic`](./generic) template was forked from our battle-tested
[`bridged`](./bridged-provider) template with an eye towards generalizing
things such that we could enable _all_ providers to be managed by `ci-mgmt` --
with an eventual goal of allowing third-party parties to benefit from this
tooling as well.

(This is still a work in progress and the current state of the template may not
yet fully reflect these goals.)

After running the bridged template for a number of years several problems
emerged:

1. Accumulation of special-casing and one-off configuration options adds
   complexity to workflows and makes it harder to maintain and reason about all
   possible workflow behaviors.

2. Over-reliance on GitHub actions for setting up CI environments makes it
   difficult to reproduce failures locally. For example it's very easy for CI
   to use a different version of `golangci-lint` than what you have locally.

3. A tight coupling of tooling and workflows means that workflow updates can
   require manual intervention when tooling changes are included. For example
   workflows can fail until someone manually resolves errors due to a
   `golantci-lint` update.

With those problems in mind we have a couple principles for these templates
going forward:

1. Inversion of control: The provider should be the source of truth for as much
   as possible, and `ci-mgmt` should be as "dumb" as possible. The provider/CI
   interaction should be driven entirely by `make` targets, and `ci-mgmt`
   should know nothing about the provider's implementation details -- not even
   the language of the provider.
     
2. Local first: CI should leverage the same setup steps that a developer would
   run locally.

3. Separation of concerns: Workflows and tooling can and should be managed
   separately. It is OK for a long-tail provider to use an older version of
   `golangci-lint` if we haven't yet had an opportunity to update its code, but
   that should not prevent it from being released if we need to ship an urgent
   fix.

Concretely, this means:
* We should avoid adding new configuration that leaks implementation details of
  the provider to `ci-mgmt`. 
* We should provide sane default `make` targets but allow the provider to
  override them if necessary.
* We should prefer to perform setup as part of a `make` target or as part of
  tests instead of adding additional GitHub actions.

## Contract

The generic template drives all workflows via `make` targets.
(If an action _doesn't_ invoke a `make` target that's a bug!)

A `./bin` and `./sdk` must exist at the root of the provider's repo.

Targets should be parallelizable (`-j`).

### Required targets

#### Prerequisites

This workflow is the first step run during releases, pre-releases, PR tests,
and merges to main.

* `make install_plugins`: (TODO: Use a more generic `make prepare` or just drop
  this.)
* `make schema`: Ensures generated schema is in place.
* `make provider`: Builds the provider binary.
* `make test_provider`: Runs "fast" tests, typically unit tests for the
  provider. These tests should run fast enough to not need sharding across
  multiple workers. The provider is responsible for deciding how to run these,
  but default behavior will be to execute `go test ./...` under the
  `./provider` path.

#### Build provider

This workflow is run during releases, pre-releases, PR tests, and merges to
main after the prerequisites step has succeeded.

* `make provider_dist-${OS}-${ARCH}`: (TODO: use a file path) Responsible for
  building a provider binary under `./bin` for the given architecture and OS.
  These binaries will be uploaded and re-used in later steps.

#### Resync build

* `make build`: A single target to re-build everything (schema, SDKs, binaries,
  etc.).

#### Build SDK

This workflow is run during releases, pre-releases, PR tests, and merges to
main after the prerequisites step has succeeded.

* `make build_${language}`: Generates the SDK for the given language.

#### Test

This workflow is run during releases, pre-releases, PR tests, and merges to
main after the provider binaries and SDKs have been generated.

This differs from the `bridged` template in that sharding is arbitrary and left
to the discretion of the provider. Typically we have use fixed shards based on
languages, but this is restrictive and a poor developer experience in general
(https://github.com/pulumi/ci-mgmt/issues/676).

* `make install_sdks`: Install SDKs for all available languages.
* `make shard`: This target takes two environment variables -- `$SHARD_TOTAL`
  and `$SHARD_INDEX` -- and is responsible for determining tests to run for
  this shard. It will probably mutate the environment in some way, for example
  by appending to `$GITHUB_ENV`, in order to inform the `test_shard` target.
* `make test_shard`: This target is responsible for executing tests identified
  in the `shard` target.

## Configuring a template

[`config.go`](../config.go) contains all of the allowable options for `.ci-mgmt.yaml` files.

While it's possible to add new options here, in general we would like to reduce
the amount of configuration options available.

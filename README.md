# Pulumi CI Management


## Purpose

This repository contains code to manage CI/CD for the many Pulumi providers in a consistent and (mostly) automated manner. The repo's intended audience are Pulumi Corp engineers, but its contents may also serve as a helpful example for Pulumi community members looking to maintain their own providers with a similar CI/CD process to Pulumi Corp.

Pulumi providers use [GitHub Actions](https://docs.github.com/en/actions) for CI/CD. Because we maintain a long list of providers, we use this repository to:

- Generate GitHub Actions Workflow files for any provider. These can be deployed to all providers or a single provider respectively by the GitHub Actions workflows in this repository.
- Keep an [inventory of existing Pulumi providers](./provider-ci/providers).
- Maintain logic for branch protection across provider repositories.

## Usage

This repository has the following components:

- The `provider-ci` and `native-provider-ci` directories contain code to generate [GitHub Actions workflow files](https://docs.github.com/en/actions/learn-github-actions/workflow-syntax-for-github-actions) for Pulumi providers, as well as the generated output for each provider (retained for the purpose of convenient output diffing).
- The `infra/providers/` directory contains a Pulumi program which uses the [Pulumi GitHub provider](https://www.pulumi.com/registry/packages/github/) to ensure consistent [branch protections](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches) across our provider repositories.

  For an overview of how Pulumi programs work, see [the Pulumi docs](https://www.pulumi.com/docs/).

- GitHub Actions workflows to automate common operations across all providers or a single provider.

## Prerequisites

The following tools are required for generating and deploying GitHub Actions workflows:

- [Make](https://www.gnu.org/software/make/)
- [npm](https://www.npmjs.com/)
- [golangci-lint](https://golangci-lint.run/)
- [shellcheck](https://github.com/koalaman/shellcheck)

## Building

After checking out the code, run the following command:

```bash
cd provider-ci && make clean && make -j
```

Common commands:

- `make`: Generate all code and check the output.
- `make provider NAME=aws`: Generate code for single provider with debug information
- `make lint-providers`: Check the generated code for all providers.
- `make lint-providers/aws/repo`: Check the generated code for a specific provider.

### Adding generated workflows to your local provider repository

Sometimes, you want those changes NOW rather than having to wait for a GitHub PR.
This example command will generate workflows for pulumi-datadog, and place them in the specified `--out` directory.
Adjust for your provider and filesystem.

```
./bin/provider-ci generate --name pulumi/pulumi-datadog --template bridged-provider --config ./providers/datadog/config.yaml --out ../../pulumi-dtadog
```

## Adding a New Bridged Provider

To add a new provider:

1. A new provider needs a top-level `.ci-mgmt.yaml` in its _own_ repository with the following basic configuration:

   ```yaml
   # Required values:
   provider: foo # substitute the name of your provider, without the pulumi- prefix
   env: # A map of required configuration for any integration tests, etc.
     AN_OPTION: value
     ANOTHER_OPTION: true
     # etc.
   lint: true # Linting should be true in most cases, unless failing rules in the upstream provider makes this impractical.

   # Optional values:
   docker: true # Whether the provider's tests use Docker to run. If set to true, a file `testing/docker-compose.yml` must be present in the provider repository.
   setup-script: testing/setup.sh # Path to a script that's used for testing bootstraps
   ```
   `ci-mgmt` will read your provider's `.ci-mgmt.yaml` and generate the standard set of CI files from templates.

1. Add your provider to `provider-ci/providers.json` in alphabetical order. This ensures your provider receives regular 
   updates and maintenance.

1. Commit the changes to `provider-ci/providers.json` and open a pull request.

1. To receive a pull request with your new config files, you can run the 
   [Update Workflows, Single Bridged Provider](https://github.com/pulumi/ci-mgmt/actions/workflows/update-workflows-single-bridged-provider.yml)
   workflow run, using your provider name as the input. 
   Another option is to wait for the nightly cronjob to send this pull request automatically.

1. If you would like to manually generate the configuration to get started right away, you can do so in your provider 
   repository root:

   ```bash
   go run github.com/pulumi/ci-mgmt/provider-ci@master generate \
	--name pulumi/pulumi-$(PROVIDER_NAME) \
	--out . \
	--template bridged-provider \
	--config .ci-mgmt.yaml
   ```
   The generated files will be writen to your current directory.

## Updating All Bridged Providers

The [Update GH Workflows, ecosystem providers](https://github.com/pulumi/ci-mgmt/actions/workflows/update-workflows-ecosystem-providers.yml)
Workflow runs on a nightly schedule.
You may trigger this Workflow manually; however be aware that this causes a lot of GitHub Actions to run at the same
time, which may cause rate limiting across the org. Plan ahead and do this at a low-traffic time.

## Updating GitHub workflow schema

Fetch the latest JSON Schema then re-generate type definitions:

```bash
make discovery
```

## Automatically editing source code across provider repositories

You can apply ad-hoc source edits across provider repositories even on files that are not managed or generated by ci-mgmt. For example, you might need to automatically update example code to use a newer Pulumi SDK major version dependency or a newer version of the underlying infrastructure such as .NET Framework.  This can be done with sourcemigrator:

- describe your desired edits as a `SourceMigration` in `tools/sourcemigrator`

- test your changes locally:

      cd tools/sourcemigrator
      npx ts-node index.ts ~/code/my-provider

- stand up a PR to ci-mgmt

- trigger an action such as
  [update-workflows-bridged-providers.yml](https://github.com/pulumi/ci-mgmt/actions/workflows/update-workflows-bridged-providers.yml)
  from the PR; this will create PRs that synchronize the selected repositories with ci-mgmt and apply the source
  migration as part of the change

- merge the PR to ci-mgmt

- merge the PR to the desired provider repositories (not needed if these PRs are set to automerge)

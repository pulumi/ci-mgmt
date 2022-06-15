# Pulumi CI Management

## Purpose

This repository contains code to manage CI/CD for the many Pulumi providers in a consistent and (mostly) automated manner. The repo's intended audience are Pulumi Corp engineers, but its contents may also serve as a helpful example for Pulumi community members looking to maintain their own providers with a similar CI/CD process to Pulumi Corp.

Pulumi providers use [GitHub Actions](https://docs.github.com/en/actions) for CI/CD. Because we maintain a long list of providers, we use this repository to:

- Generate GitHub Actions Workflow files for any provider. These can be deployed to all providers or a single provider respectively by the GitHub Actions workflows in this repository.
- Keep an [inventory of existing Pulumi providers](./provider-ci/providers).
- Maintain logic for branch protection across provider repositories.

## Usage

This repository has the following components:

- The `provider-ci` directory contains code to generate [GitHub Actions workflow files](https://docs.github.com/en/actions/learn-github-actions/workflow-syntax-for-github-actions) for Pulumi providers, as well as the generated output for each provider (retained for the purpose of convenient output diffing).
- The `infra/providers/` directory contains a Pulumi program which uses the [Pulumi GitHub provider](https://www.pulumi.com/registry/packages/github/) to ensure consistent [branch protections](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches) across our provider repositories.

  For an overview of how Pulumi programs work, see [the Pulumi docs](https://www.pulumi.com/docs/).

- GitHub Actions workflows to automate common operations across all providers or a single provider.

## Prerequisites

The following tools are required for generating and deploying GitHub Actions workflows:

- [Make](https://www.gnu.org/software/make/)
- [npm](https://www.npmjs.com/)

## Building

After checking out the code, run the following command:

```bash
cd provider-ci && make
```

Common commands:

- `make gen`: Generate all code
- `make providers`: Generate code for all providers
- `make provider NAME=aws`: Generate code for single provider with debug information
- `make examples`: Generate examples code
- `make check`: Check for correctness
- `make format`: Auto-format all code
- `make discovery`: Check for GitHub workflow schema updates

## Adding a New Bridged Provider

To add a new provider:

1. Create a new directory and config file for the provider. From the root of the repository, run:

   ```bash
   # Change the value of PROVIDER_NAME below:
   PROVIDER_NAME=foo && mkdir provider-ci/providers/${PROVIDER_NAME} && touch provider-ci/providers/${PROVIDER_NAME}/config.yaml
   ```

1. In the `config.yaml` you created, add the configuration to be applied to the generated GitHub Actions workflows for the provider:

   ```yaml
   # Required values:
   provider: foo
   env: # A map of required configuration for any integration tests, etc.
     AN_OPTION: value
     ANOTHER_OPTION: true
     # etc.
   lint: true # Linting should be true in most cases, unless failing rules in the upstream provider makes this impractical.
   upstream-provider-org: # Name of org hosting Pulumi provider.

   # Optional values:
   docker: true # Whether the provider's tests use Docker to run. If set to true, a file `testing/docker-compose.yml` must be present in the provider repository.
   setup-script: testing/setup.sh # Path to a script that's used for testing bootstraps
   ```

1. Generate the configuration:

   ```bash
   npm run gen-examples -- -n [provider]
   ```

   The generated files will be writen to `providers/foo/repo/`.

1. Copy the generated files in to the provider repository.

## Updating All Providers

If the underlying code generation has changed and we need to deploy the workflows to all the providers:

1. Compile the TypeScript to JavaScript, and generate the files:

   ```bash
   make
   ```

1. Commit the code, submit a PR, and merge.
1. Run the "Update All Providers" GitHub Actions workflow manually in the GitHub UI. This will generate a PR to any providers whose files have changed.

## Updating GitHub workflow schema

Fetch the latest JSON Schema then re-generate type definitions:

```bash
make discovery
```

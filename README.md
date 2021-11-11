# Pulumi CI Management

## Purpose

This repository contains code to manage CI/CD for the many Pulumi providers in a consistent and (mostly) automated manner.  The repo's intended audience are Pulumi Corp engineers, but its contents may also serve as a helpful example for Pulumi community members looking to maintain their own providers with a similar CI/CD process to Pulumi Corp.

Pulumi providers use [GitHub Actions](https://docs.github.com/en/actions) for CI/CD. Because we maintain a long list of providers, we use this repository to:

* Generate GitHub Actions Workflow files for any provider. These can be manually copied to new providers. We look forward to automating this step in the future.
* Keep an [inventory of existing Pulumi providers](./provider-ci/providers).
* Maintain logic for branch protection across provider repositories
* Bulk update all Pulumi Corp provider workflows when necessary.

## Usage

This repository has the following component directories:

* The `provider-ci` directory contains code to generate [GitHub Actions workflow files](https://docs.github.com/en/actions/learn-github-actions/workflow-syntax-for-github-actions) for Pulumi providers, as well as the generated output for each provider (retained for the purpose of convenient output diffing).
* The `mp` directory contains code using [microplane](https://github.com/Clever/microplane) to deploy the generated files in `provider-ci` to the many provider repositories.
* The `infra/providers/` directory contains a Pulumi program which uses the [Pulumi GitHub provider](https://www.pulumi.com/registry/packages/github/) to ensure consistent [branch protections](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches) across our provider repositories.

  For an overview of how Pulumi programs work, see [the Pulumi docs](https://www.pulumi.com/docs/).

## Prerequisites

The following tools are required for generating and deploying GitHub Actions workflows:

* [jkcfg](https://github.com/jkcfg/jk/releases)  (Download the binary release for your system and manually copy to your `$PATH`.)
* [TypeScript](https://www.typescriptlang.org/)
* [Make](https://www.gnu.org/software/make/)
* [npm](https://www.npmjs.com/)
* [microplane v0.0.23](https://github.com/Clever/microplane/releases/tag/v0.0.23)  Note that the binary must manually installed because we require an older version of microplane and the Homebrew formula does not support older versions.

## Building

Before generating any workflow files, run the following commands:

1. Ensure the dependencies are installed:

  ```bash
  cd provider-ci && npm install
  ```

1. Build the module:

  ```bash
  make dist
  ```

  This will generate the module into `provider-ci/lib`

## Adding a New Provider

To add a new provider:

1. Create a new directory and config file for the provider.  From the root of the repository, run:

  ```bash
  # Change the value of PROVIDER_NAME below:
  PROVIDER_NAME=foo && mkdir provider-ci/providers/${PROVIDER_NAME} && touch providers/${PROVIDER_NAME}/config.yaml
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

  # Optional values:
  docker: true # Whether the provider's tests use Docker to run. If set to true, a file `testing/docker-compose.yml` must be present in the provider repository.
  setup-script: testing/setup.sh # Path to a script that's used for testing bootstraps
  ```

1. Generate the configuration:

  ```bash
  make foo
  ```

  The generated files will be writen to `providers/foo/repo/`.

1. Copy the generated files in to the provider repository.  Note that we do not use microplane (which deploys all files to all repositories) to deploy changes for a single repo for blast radius concerns.

## Upgrading All Providers

If the underlying code generation has changed and we need to generate and deploy the workflows to all the providers:

1. Generate the code for all providers:

  ```bash
  make providers
  ```

1. From the root of the repository, run:

  ```bash
  mp clone
  ```

  This will clone the repositories to the `mp/` folder. 
  
1. Run a plan of the changes across all affected the repositories:

  ```bash
  mp plan -b <branch name> -m "<commit message>" -- ~/code/go/src/github.com/pulumi/ci-mgmt/scripts/copy.sh ~/code/go/src/github.com/pulumi/ci-mgmt
  ```

1. View a detail of the plan and ensure all propsed changes conform with expectations:

  ```bash
  mp status -r <repo-name>
  ```

1. When we are happy, we can deploy the changes to the repository

  ```bash
  mp push -b <branch name> -t 180s
  ```

  If we omit the `-t` command, we risk triggering rate-limiting for the GitHub API, which will cause our Actions to go into a waiting state.

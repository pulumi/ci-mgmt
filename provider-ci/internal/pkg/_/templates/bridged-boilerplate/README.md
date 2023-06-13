[![Actions Status](https://#{{ .Module }}#/workflows/master/badge.svg)](https://#{{ .Module }}#/actions)
[![NPM version](https://img.shields.io/npm/v/#{{ .Config.sdks.nodejs }}#)](https://www.npmjs.com/package/#{{ .Config.sdks.nodejs }}#)
[![Python version](https://img.shields.io/pypi/v/#{{ .Config.sdks.python }}#)](https://pypi.org/project/#{{ .Config.sdks.python }}#)
[![NuGet version](https://img.shields.io/nuget/v/#{{ .Config.sdks.dotnet }}#)](https://www.nuget.org/packages/#{{ .Config.sdks.dotnet }}#)
[![PkgGoDev](https://pkg.go.dev/badge/#{{ .Config.sdks.go }}#/go)](https://pkg.go.dev/#{{ .Config.sdks.go }}#/go)
[![License](https://img.shields.io/github/license/#{{ .Repository }}#)](https://#{{ .Repository }}#/blob/master/LICENSE)

# #{{ .Config.providerTitle }}# Resource Provider

The #{{ title .Config.providerTitle }}# resource provider for Pulumi lets you use #{{ .Config.providerTitle }}# resources in your cloud programs.
To use this package, please [install the Pulumi CLI first](https://www.pulumi.com/docs/install/).

## Installing

This package is available in many languages in the standard packaging formats.

### Node.js (Java/TypeScript)

To use from JavaScript or TypeScript in Node.js, install using either `npm`:

    $ npm install #{{ .Config.sdks.nodejs }}#

or `yarn`:

    $ yarn add #{{ .Config.sdks.nodejs }}#

### Python

To use from Python, install using `pip`:

    $ pip install #{{ .Config.sdks.python }}#

### Go

To use from Go, use `go get` to grab the latest version of the library:

    $ go get #{{ .Config.sdks.go }}#

### .NET

To use from .NET, install using `dotnet add package`:

    $ dotnet add package #{{ .Config.sdks.dotnet }}#

<!-- If your provider has configuration, remove this comment and the comment tags below, updating the documentation. -->
<!--

## Configuration

The following Pulumi configuration can be used:

- `#{{ .Name }}#:token` - (Required) The API token to use with #{{ .Config.providerTitle }}#. When not set, the provider will use the `#{{ upper .Name }}#_TOKEN` environment variable.

-->

<!-- If your provider has reference material available elsewhere, remove this comment and the comment tags below, updating the documentation. -->
<!--

## Reference

For further information, please visit [#{{ .Config.providerTitle }}# reference documentation](https://example.com/#{{ .Name }}#).

-->

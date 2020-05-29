# Pulumi Action Generator

This repo will generate github action workflow files for all Pulumi providers

## Dependencies

You'll need:

- [jkcfg](https://github.com/jkcfg/jk/releases)
- typescript
- Make
- npm

## Building

First, build the module:

```
$ make dist
npx tsc
```

This will generate the module into `lib`

## Config

The configuration for each provider lives in `providers/<name>/config.yaml`.

It takes two parameters, a `provider` string and a map, `env` with extra environment variables the provider needs. Here's an example:

```
provider: rancher2
env:
  RANCHER_INSECURE: true
  AWS_REGION: us-west-2
```

Once you have the configuration, you can generate a single provider like so:

```
make rancher2
```

Or, alternatively, generate all the providers in one go:

```
make providers
```

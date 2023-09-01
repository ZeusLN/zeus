# lnc-core Release Process

This document describes the steps needed to release a new version of
`@lightninglabs/lnc-core` and publish the package to the NPM registry.

The steps below for Bumping proto versions and Versioning should be done in
a PR with proper review.

## Bumping proto versions

When new versions of LND, Loop, Pool, Faraday, or Lightning Terminal are
released, we should update the generated types in this package to match the
latest versions. Just make sure that the versions listed here also match the
versions that the `lightning-node-connect` release was built with. You can check
the `go.mod` files for
[wasm-client](https://github.com/lightninglabs/lightning-node-connect/blob/master/cmd/wasm-client/go.mod)
and
[mobile](https://github.com/lightninglabs/lightning-node-connect/blob/master/mobile/go.mod).

Specify the new versions the `config` section in the
[package.json](https://github.com/lightninglabs/lnc-core/blob/9d31f49dd9cacab1e7cb1d5664074fd554f42897/package.json#L7)
file.

```json
  "config": {
    "lnd_release_tag": "v0.16.0-beta",
    "loop_release_tag": "v0.22.0-beta",
    "pool_release_tag": "v0.6.2-beta",
    "faraday_release_tag": "v0.2.9-alpha",
    "lit_release_tag": "v0.9.0-alpha",
    "protoc_version": "21.9"
  },
```

After specifying the latest versions, run the following commands in the root
dir of the project.

```sh
# install package dependencies
yarn
# download new proto files
yarn run update-protos
# generate Typescript definitions from the updated protos
yarn run generate
```

## Versioning

We typically try to keep the version of `lnc-core` in sync with the version
number of [lightning-node-connect](https://github.com/lightninglabs/lightning-node-connect).
If we need to bump the version of `lnc-core` without requiring a new version of
`lightning-node-connect`, we should append an incrementing number to the end of
the version. For example,
[v0.1.11-alpha.1](https://github.com/lightninglabs/lnc-web/releases/tag/v0.1.11-alpha.1).

Increment the version number in the
[package.json](https://github.com/lightninglabs/lnc-core/blob/9d31f49dd9cacab1e7cb1d5664074fd554f42897/package.json#L3)
file.

## Publishing to NPM

Building and publishing the this package to NPM is handled automatically by
the [npm.yml](https://github.com/lightninglabs/lnc-core/blob/e136a4ee9295279acb0ae309327e19e6a59b39aa/.github/workflows/npm.yml#L1)
Github workflow. This is triggered when a new release is created.

## Github Release

[Draft a new release](https://github.com/lightninglabs/lnc-core/releases/new)
on Github. Create a new tag and auto-generate the release notes. You do not
need to include any assets.

Once you publish the release, the build and publish to NPM will complete in
a few minutes. You can confirm the new version is published by visiting
https://www.npmjs.com/package/@lightninglabs/lnc-core

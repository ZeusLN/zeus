# @lightninglabs/lnc-core

## Type definitions and utilities for Lightning Node Connect, leveraged by lnc-web and lnc-rn

## Install

`npm i @lightninglabs/lnc-core`

## Updating protos

First, update the service version under the `config` block in `package.json`.

eg.

```
"config": {
    "lnd_release_tag": "v0.14.2-beta",
    "loop_release_tag": "v0.17.0-beta",
    "pool_release_tag": "v0.5.5-alpha",
    "faraday_release_tag": "v0.2.5-alpha",
    "protoc_version": "3.15.8"
},
```

Then run the following commands:

```
# download schemas
yarn run update-protos
# format schemas
yarn run generate
```

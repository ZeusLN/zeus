#!/bin/bash -x
# Generate typescript definitions and service definitions from proto file

set -e

LND_RELEASE_TAG=$1
PROTOC_VERSION=$2

echo "LND release tag:" $LND_RELEASE_TAG
echo "Protoc version:" $PROTOC_VERSION

GENERATED_TYPES_DIR=lib/types/proto
if [ -d "$GENERATED_TYPES_DIR" ]
then
    rm -rf "$GENERATED_TYPES_DIR"
fi
mkdir -p "$GENERATED_TYPES_DIR"

# Download and install protoc
unameOut="$(uname -s)"
case "${unameOut}" in
    Linux*)     platform=Linux;;
    Darwin*)    platform=Mac;;
    *)          platform="UNKNOWN:${unameOut}"
esac

mkdir -p protoc
if [[ $platform == 'Linux' ]]; then
    PROTOC_URL="https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VERSION}/protoc-${PROTOC_VERSION}-linux-x86_64.zip"
elif [[ $platform == 'Mac' ]]; then
    PROTOC_URL="https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VERSION}/protoc-${PROTOC_VERSION}-osx-x86_64.zip"
else
    echo "Cannot download protoc. ${platform} is not currently supported by ts-protoc-gen"
    exit 1
fi

curl -L ${PROTOC_URL} -o "protoc-${PROTOC_VERSION}.zip"
unzip "protoc-${PROTOC_VERSION}.zip" -d protoc
rm "protoc-${PROTOC_VERSION}.zip"

TS_PROTO_OPTIONS="\
  --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=onlyTypes=true \
  --ts_proto_opt=stringEnums=true \
  --ts_proto_opt=forceLong=string \
  --ts_proto_opt=lowerCaseServiceMethods=true \
  --ts_proto_opt=exportCommonSymbols=false \
"

# Run protoc
echo "LND: running protoc..."
mkdir -p "$GENERATED_TYPES_DIR/lnd"
protoc/bin/protoc \
  --proto_path=protos/lnd/${LND_RELEASE_TAG} \
  --plugin=./node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=$GENERATED_TYPES_DIR/lnd \
  $TS_PROTO_OPTIONS \
  lightning.proto \
  walletunlocker.proto \
  stateservice.proto \
  autopilotrpc/autopilot.proto \
  chainrpc/chainnotifier.proto \
  invoicesrpc/invoices.proto \
  peersrpc/peers.proto \
  routerrpc/router.proto \
  signrpc/signer.proto \
  walletrpc/walletkit.proto \
  watchtowerrpc/watchtower.proto \
  wtclientrpc/wtclient.proto

# Temporarily generate schema files in order to provide metadata
# about the services and subscription methods to the api classes
SCHEMA_DIR=lib/types/schema
if [ -d "$SCHEMA_DIR" ]
then
    rm -rf "$SCHEMA_DIR"
fi
mkdir -p "$SCHEMA_DIR"

SCHEMA_PROTO_OPTIONS="\
  --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=outputEncodeMethods=false \
  --ts_proto_opt=outputClientImpl=false \
  --ts_proto_opt=outputServices=generic-definitions \
"

echo "LND: generating schema..."
mkdir -p "$SCHEMA_DIR/lnd"
protoc/bin/protoc \
  --proto_path=protos/lnd/${LND_RELEASE_TAG} \
  --plugin=./node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=$SCHEMA_DIR/lnd \
  $SCHEMA_PROTO_OPTIONS \
  lightning.proto \
  walletunlocker.proto \
  stateservice.proto \
  autopilotrpc/autopilot.proto \
  chainrpc/chainnotifier.proto \
  invoicesrpc/invoices.proto \
  peersrpc/peers.proto \
  routerrpc/router.proto \
  signrpc/signer.proto \
  walletrpc/walletkit.proto \
  watchtowerrpc/watchtower.proto \
  wtclientrpc/wtclient.proto

# Cleanup proto directory/files
rm -rf *.proto protoc

# Perform a bit of post-processing on the generated code
echo "Perform post-processing on the generated code..."
ts-node scripts/process_types.ts

# Format the generated files with prettier
echo "Formatting generated code with prettier..."
prettier --check --write --loglevel=error 'lib/types/proto/**'

# Cleanup schema directory/files
echo "Deleting schema files..."
rm -rf "$SCHEMA_DIR"

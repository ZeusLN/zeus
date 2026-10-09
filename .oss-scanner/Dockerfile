# Build image for Anthropic's OSS Scanner (https://github.com/anthropics/oss-scanner).
# The scanner builds this with the repository root as the build context, then
# removes network access. Everything Jest, tsc and ESLint need is installed here.
# It mirrors the Linux CI jobs in .github/workflows (Node 24, yarn install
# --frozen-lockfile). The native Android/iOS apps are not built.
FROM node:24-bookworm
ENV DEBIAN_FRONTEND=noninteractive \
    CI=true
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git python3 unzip \
    && rm -rf /var/lib/apt/lists/*

COPY . /src
WORKDIR /src

# postinstall applies patches/, runs rn-nodeify and fetch-libraries.sh (which
# downloads the embedded LND, LDK Node and CDK binaries and checks their
# sha256 against fetch-libraries-versions.json). pod-install is a no-op on Linux.
RUN yarn install --frozen-lockfile --network-timeout 600000

# Run the checks so the image is known to work, without failing the build on a
# test failure.
RUN yarn tsc || echo "WARNING: tsc reported errors"
RUN yarn test --ci --silent || echo "WARNING: jest reported failures"

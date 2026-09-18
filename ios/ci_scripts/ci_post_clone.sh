#!/bin/zsh
set -euo pipefail

# Homebrew must not auto-update or upgrade here: it no longer ships bottles
# for Intel x86_64 runners, so any upgrade path (cocoapods -> openssl@3,
# node@24 -> pkgconf) tries to build from source and fails on the CI image's
# toolchain. Use whatever the image already has and add nothing via brew
# unless it is missing outright.
export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALL_CLEANUP=TRUE
export HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK=1

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "===== Checking CocoaPods ====="
if ! command -v pod >/dev/null 2>&1; then
  brew install cocoapods
fi
pod --version

echo "===== Installing Node.js ====="
# Official darwin tarball instead of brew: works on both Intel and Apple
# Silicon runners and never compiles from source.
NODE_VERSION="24.21.0"
case "$(uname -m)" in
  arm64) NODE_ARCH="arm64" ;;
  *) NODE_ARCH="x64" ;;
esac
NODE_DIST="node-v${NODE_VERSION}-darwin-${NODE_ARCH}"
cd "$HOME"
curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_DIST}.tar.gz"
curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"
grep " ${NODE_DIST}.tar.gz\$" SHASUMS256.txt | shasum -a 256 -c -
tar -xzf "${NODE_DIST}.tar.gz"
export PATH="$HOME/${NODE_DIST}/bin:$PATH"
node --version

echo "===== Installing yarn ====="
npm install -g yarn
yarn --version

# Xcode build phases don't inherit this script's PATH; point React Native's
# scripts at the node we just installed.
echo "export NODE_BINARY=$HOME/${NODE_DIST}/bin/node" > "$REPO_ROOT/ios/.xcode.env.local"

echo "===== Running yarn install ====="
cd "$REPO_ROOT"
yarn install

# Reset stale CocoaPods spec-repo state from cached Xcode Cloud worker
# images. The Homebrew CocoaPods 1.16+ wants the trunk source registered
# as a CDN, but a pre-existing `~/.cocoapods/repos/trunk` from older
# installs makes `pod install` abort with:
#   [!] Unable to add a source with url `https://cdn.cocoapods.org/`
#       named `trunk`.
# Wiping the dir and explicitly registering the CDN source up front
# makes the install path deterministic on every run.
rm -rf "$HOME/.cocoapods/repos/trunk" 2>/dev/null || true
pod repo add-cdn trunk https://cdn.cocoapods.org/ 2>/dev/null || true

echo "===== Running pod install ====="
cd "$REPO_ROOT/ios"
pod install

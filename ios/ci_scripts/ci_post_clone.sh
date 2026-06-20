#!/bin/zsh

echo "===== Installling CocoaPods ====="
export HOMEBREW_NO_INSTALL_CLEANUP=TRUE
brew install cocoapods
echo "===== Installing Node.js ====="
brew install node@24
brew link node@24 --overwrite
# Ensure node is findable at the Homebrew default path for Xcode build phases
if [ ! -f /opt/homebrew/opt/node/bin/node ] && [ -f /opt/homebrew/opt/node@24/bin/node ]; then
  ln -s /opt/homebrew/opt/node@24/bin/node /opt/homebrew/bin/node 2>/dev/null || true
fi
echo "===== Installing yarn ====="
brew install yarn

# Install dependencies
echo "===== Running yarn install ====="
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
cd ios
pod install

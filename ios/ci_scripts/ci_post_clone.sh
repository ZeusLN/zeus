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
echo "===== Running pod install ====="
cd ios
pod install

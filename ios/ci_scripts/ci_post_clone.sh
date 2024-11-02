#!/bin/zsh

echo "===== Installling CocoaPods ====="
export HOMEBREW_NO_INSTALL_CLEANUP=TRUE
brew install cocoapods
echo "===== Installing Node.js ====="
brew install node@22
brew link node@22
echo "===== Installing yarn ====="
brew install yarn

# Install dependencies
echo "===== Running yarn install ====="
yarn install
echo "===== Running pod install ====="
cd ios
pod install

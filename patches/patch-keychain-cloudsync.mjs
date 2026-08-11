// Fix react-native-keychain treating cloudSync: false as cloudSync: true on iOS
//
// cloudSyncValue() checks options[@"cloudSync"] for presence, not value. The JS
// boolean false crosses the bridge as a non-nil @NO NSNumber, which is truthy
// as an Objective-C pointer, so every call that passes { cloudSync: false }
// (all of storage/index.ts) actually writes kSecAttrSynchronizable = true and
// the item syncs to iCloud Keychain. Wallet seeds must never leave the device,
// so this patch makes the check respect the boolean value. [nil boolValue] is
// NO, so omitting the option still means non-synchronizable.
//
// Upstream: react-native-keychain 10.0.0 (latest at time of writing) is
// affected; the presence check dates to the feature's introduction in v9.1.0.
//
// This patch is security-load-bearing: if the expected pattern is missing
// (e.g. after a dependency bump), it THROWS so postinstall fails loudly
// instead of silently shipping seeds to iCloud again.

import fs from 'fs';

const BUGGY = `CFBooleanRef cloudSyncValue(NSDictionary *options)
{
  if (options && options[@"cloudSync"]) {
    return kCFBooleanTrue;
  }
  return kCFBooleanFalse;
}`;

const FIXED = `CFBooleanRef cloudSyncValue(NSDictionary *options)
{
  if (options && [options[@"cloudSync"] boolValue]) {
    return kCFBooleanTrue;
  }
  return kCFBooleanFalse;
}`;

export function patchKeychainCloudSync() {
    console.log('Patching react-native-keychain cloudSync handling');

    const managerPath =
        './node_modules/react-native-keychain/ios/RNKeychainManager/RNKeychainManager.m';

    if (!fs.existsSync(managerPath)) {
        throw new Error(
            'patch-keychain-cloudsync: RNKeychainManager.m not found; ' +
                'the cloudSync fix cannot be applied'
        );
    }

    const content = fs.readFileSync(managerPath, 'utf8');

    if (content.includes(FIXED)) {
        console.log('  - Already patched, skipping');
        return;
    }

    if (!content.includes(BUGGY)) {
        throw new Error(
            'patch-keychain-cloudsync: cloudSyncValue() does not match the ' +
                'expected pattern. react-native-keychain may have changed; ' +
                'verify whether the cloudSync truthiness bug still exists ' +
                'and update this patch before building.'
        );
    }

    fs.writeFileSync(managerPath, content.replace(BUGGY, FIXED));
    console.log('  - Patched RNKeychainManager.m cloudSyncValue()');
}

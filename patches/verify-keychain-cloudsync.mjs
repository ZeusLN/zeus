// Verify react-native-keychain respects cloudSync: false on iOS
//
// Up to 10.0.0, cloudSyncValue() checked options[@"cloudSync"] for presence,
// not value. The JS boolean false crosses the bridge as a non-nil @NO
// NSNumber, so every call that passed { cloudSync: false } (all of
// storage/index.ts) wrote kSecAttrSynchronizable = true and the item synced
// to iCloud Keychain. Zeus patched the check at postinstall until upstream
// fixed it in 11.0.0 (oblador/react-native-keychain#800, fixed by #824):
// cloudSyncValue() now returns true only for an NSNumber that is true.
//
// Wallet seeds must never leave the device, so this check THROWS unless the
// installed cloudSyncValue() is exactly the 11.0.0 version. A dependency
// bump that changes it fails postinstall until someone re-reads the new
// code and updates FIXED below.
//
// Tracking: https://github.com/ZeusLN/zeus/issues/4403

import fs from 'fs';

export const MANAGER_PATH =
    './node_modules/react-native-keychain/ios/RNKeychainManager/RNKeychainManager.mm';

export const FIXED = `CFBooleanRef cloudSyncValue(NSDictionary *options)
{
  id cloudSync = options[@"cloudSync"];
  if ([cloudSync isKindOfClass:[NSNumber class]] && [cloudSync boolValue]) {
    return kCFBooleanTrue;
  }
  return kCFBooleanFalse;
}`;

// Pure check, exported for tests. Throws if the source does not contain the
// fixed cloudSyncValue() exactly once.
export function checkKeychainCloudSync(content) {
    if (content.split(FIXED).length - 1 !== 1) {
        throw new Error(
            'verify-keychain-cloudsync: cloudSyncValue() does not match the ' +
                'version that respects cloudSync: false. ' +
                'react-native-keychain may have changed; verify that ' +
                'cloudSync: false still writes non-synchronizable items and ' +
                'update this check before building.'
        );
    }
}

export function verifyKeychainCloudSync() {
    console.log('Verifying react-native-keychain cloudSync handling');

    if (!fs.existsSync(MANAGER_PATH)) {
        throw new Error(
            'verify-keychain-cloudsync: RNKeychainManager.mm not found; ' +
                'cloudSync: false handling cannot be verified'
        );
    }

    checkKeychainCloudSync(fs.readFileSync(MANAGER_PATH, 'utf8'));
    console.log('  - cloudSyncValue() respects cloudSync: false');
}

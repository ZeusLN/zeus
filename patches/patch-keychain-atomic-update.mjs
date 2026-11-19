// Make react-native-keychain overwrites atomic on iOS
//
// setInternetCredentialsForServer and setGenericPasswordForOptions overwrite
// an item by deleting every match for the server/service and then calling
// SecItemAdd. If the process dies between the two calls (embedded LND runs
// in-process, so an lnd crash, a jetsam kill or a watchdog kill all qualify),
// the item is gone. For zeus-settings-v2 that means every wallet config and
// the next launch lands on the intro screen. The same happens if SecItemAdd
// itself fails after the delete succeeded.
//
// This patch tries SecItemUpdate on the same match first, which replaces the
// account, data and accessibility class of the existing item in one call, and
// only adds a new item when none exists (errSecItemNotFound). An update
// failure leaves the old item in place and rejects.
//
// The match is the one the delete used: class + server (internet) or service
// (generic) + synchronizable. The delete removed items for every account under
// that server/service; the update rewrites every match to the new account and
// data, so getInternetCredentials (kSecMatchLimitOne) still returns the new
// value. If several matches would collapse onto one primary key, SecItemUpdate
// returns errSecDuplicateItem and the patch falls back to the original
// delete + add, which is what ran before.
//
// Writes that request an access control (biometrics, passcode) or an access
// group keep the original delete + add path: updating a protected item can
// require authentication, and the internet-password delete ignores the access
// group while the add sets it. Zeus uses neither (storage/index.ts).
//
// Upstream: react-native-keychain 10.0.0 (latest at time of writing).
// Composes with patch-keychain-cloudsync.mjs: that patch only edits
// cloudSyncValue(), which this code calls.
//
// Like the cloudSync patch this THROWS when the expected source is missing,
// so a dependency bump cannot silently bring the data-loss window back.

import fs from 'fs';

export const MARKER = '// ZEUS PATCH: keychain-atomic-update';

const MANAGER_PATH =
    './node_modules/react-native-keychain/ios/RNKeychainManager/RNKeychainManager.m';

const HELPER_ANCHOR = `- (void)hasCredentialsWithSecClass:(CFTypeRef)secClass`;

const HELPER = `${MARKER}
// Replaces the matching item in place with SecItemUpdate, falling back to
// SecItemAdd only when nothing matches. See patches/patch-keychain-atomic-update.mjs.
- (void)upsertKeychainEntry:(NSDictionary *)attributes
                      query:(NSDictionary *)query
                withOptions:(NSDictionary * __nullable)options
             deleteExisting:(OSStatus (^)(void))deleteExisting
                   resolver:(RCTPromiseResolveBlock)resolve
                   rejecter:(RCTPromiseRejectBlock)reject
{
  if (accessControlValue(options) || accessGroupValue(options) != nil) {
    deleteExisting();
    return [self insertKeychainEntry:attributes withOptions:options resolver:resolve rejecter:reject];
  }

  NSMutableDictionary *mQuery = query.mutableCopy;
  if (@available(macOS 10.15, iOS 13.0, *)) {
    mQuery[(__bridge NSString *)kSecUseDataProtectionKeychain] = @(YES);
  }

  NSDictionary *changes = @{
    (__bridge NSString *)kSecAttrAccount: attributes[(__bridge NSString *)kSecAttrAccount],
    (__bridge NSString *)kSecValueData: attributes[(__bridge NSString *)kSecValueData],
    (__bridge NSString *)kSecAttrAccessible: (__bridge id)accessibleValue(options)
  };

  OSStatus osStatus = SecItemUpdate((__bridge CFDictionaryRef) mQuery, (__bridge CFDictionaryRef) changes);

  if (osStatus == errSecItemNotFound) {
    return [self insertKeychainEntry:attributes withOptions:options resolver:resolve rejecter:reject];
  }

  if (osStatus == errSecDuplicateItem) {
    deleteExisting();
    return [self insertKeychainEntry:attributes withOptions:options resolver:resolve rejecter:reject];
  }

  if (osStatus != noErr) {
    NSError *error = [NSError errorWithDomain:NSOSStatusErrorDomain code:osStatus userInfo:nil];
    return rejectWithError(reject, error);
  }

  return resolve(@{
    @"service": serviceValue(options),
    @"storage": @"keychain"
  });
}

`;

const GENERIC_ORIGINAL = `  [self deletePasswordsForOptions:options];

  [self insertKeychainEntry:attributes withOptions:options resolver:resolve rejecter:reject];
}`;

const GENERIC_PATCHED = `  ${MARKER}
  NSDictionary *query = @{
    (__bridge NSString *)kSecClass: (__bridge id)(kSecClassGenericPassword),
    (__bridge NSString *)kSecAttrService: service,
    (__bridge NSString *)kSecAttrSynchronizable: (__bridge id)(cloudSync)
  };

  [self upsertKeychainEntry:attributes
                      query:query
                withOptions:options
             deleteExisting:^OSStatus{ return [self deletePasswordsForOptions:options]; }
                   resolver:resolve
                   rejecter:reject];
}`;

const INTERNET_ORIGINAL = `  [self deleteCredentialsForServer:server withOptions: options];
  CFBooleanRef cloudSync = cloudSyncValue(options);

  NSDictionary *attributes = @{
    (__bridge NSString *)kSecClass: (__bridge id)(kSecClassInternetPassword),
    (__bridge NSString *)kSecAttrServer: server,
    (__bridge NSString *)kSecAttrAccount: username,
    (__bridge NSString *)kSecValueData: [password dataUsingEncoding:NSUTF8StringEncoding],
    (__bridge NSString *)kSecAttrSynchronizable: (__bridge id)(cloudSync),
  };

  [self insertKeychainEntry:attributes withOptions:options resolver:resolve rejecter:reject];
}`;

const INTERNET_PATCHED = `  ${MARKER}
  CFBooleanRef cloudSync = cloudSyncValue(options);

  NSDictionary *attributes = @{
    (__bridge NSString *)kSecClass: (__bridge id)(kSecClassInternetPassword),
    (__bridge NSString *)kSecAttrServer: server,
    (__bridge NSString *)kSecAttrAccount: username,
    (__bridge NSString *)kSecValueData: [password dataUsingEncoding:NSUTF8StringEncoding],
    (__bridge NSString *)kSecAttrSynchronizable: (__bridge id)(cloudSync),
  };

  NSDictionary *query = @{
    (__bridge NSString *)kSecClass: (__bridge id)(kSecClassInternetPassword),
    (__bridge NSString *)kSecAttrServer: server,
    (__bridge NSString *)kSecAttrSynchronizable: (__bridge id)(cloudSync)
  };

  [self upsertKeychainEntry:attributes
                      query:query
                withOptions:options
             deleteExisting:^OSStatus{ return [self deleteCredentialsForServer:server withOptions:options]; }
                   resolver:resolve
                   rejecter:reject];
}`;

const countOf = (content, needle) => content.split(needle).length - 1;

// Pure transform, exported for tests. Returns the patched source, or the
// input unchanged if it is already patched. Throws if the source does not
// match what this patch was written against.
export function applyKeychainAtomicUpdate(content) {
    if (content.includes(MARKER)) {
        return content;
    }

    for (const [name, needle] of [
        ['hasCredentialsWithSecClass anchor', HELPER_ANCHOR],
        ['setGenericPasswordForOptions body', GENERIC_ORIGINAL],
        ['setInternetCredentialsForServer body', INTERNET_ORIGINAL]
    ]) {
        if (countOf(content, needle) !== 1) {
            throw new Error(
                `patch-keychain-atomic-update: ${name} does not match the ` +
                    'expected pattern. react-native-keychain may have ' +
                    'changed; verify whether its iOS setters still delete ' +
                    'before adding and update this patch before building.'
            );
        }
    }

    return content
        .replace(HELPER_ANCHOR, `${HELPER}${HELPER_ANCHOR}`)
        .replace(GENERIC_ORIGINAL, GENERIC_PATCHED)
        .replace(INTERNET_ORIGINAL, INTERNET_PATCHED);
}

export function patchKeychainAtomicUpdate() {
    console.log('Patching react-native-keychain iOS overwrites to be atomic');

    if (!fs.existsSync(MANAGER_PATH)) {
        throw new Error(
            'patch-keychain-atomic-update: RNKeychainManager.m not found; ' +
                'the atomic update fix cannot be applied'
        );
    }

    const content = fs.readFileSync(MANAGER_PATH, 'utf8');
    const patched = applyKeychainAtomicUpdate(content);

    if (patched === content) {
        console.log('  - Already patched, skipping');
        return;
    }

    fs.writeFileSync(MANAGER_PATH, patched);
    console.log(
        '  - Patched RNKeychainManager.m setGenericPassword/setInternetCredentials'
    );
}

#import "ZeusSecureStorage.h"
#import <Security/Security.h>

// Encrypted key-value storage for credentials, replacing react-native-keychain
// (#4471). Entries are the same keychain items react-native-keychain writes:
// internet passwords with server "zeus:<key>" and account equal to the server,
// accessible after first unlock. Existing data needs no migration and an older
// build reads what this one writes.
//
// Writes go to the device-local partition only and update an existing item in
// place, so there is no moment when it is missing (#5413). Reads and deletes
// can also address the synchronizable (iCloud) partition, which the desync
// migration, the purge and the recovery tool still need.

static NSString *const ErrorCode = @"E_SECURE_STORAGE";

@implementation ZeusSecureStorage

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

// One serial queue, so operations on an entry never interleave
- (dispatch_queue_t)methodQueue {
    static dispatch_queue_t queue;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        queue = dispatch_queue_create("app.zeusln.zeus.securestorage", DISPATCH_QUEUE_SERIAL);
    });
    return queue;
}

static NSMutableDictionary *baseQuery(NSString *server, BOOL synchronizable) {
    NSMutableDictionary *query = [@{
        (__bridge NSString *)kSecClass: (__bridge id)kSecClassInternetPassword,
        (__bridge NSString *)kSecAttrServer: server,
        (__bridge NSString *)kSecAttrSynchronizable: synchronizable ? @YES : @NO
    } mutableCopy];
    if (@available(iOS 13.0, *)) {
        query[(__bridge NSString *)kSecUseDataProtectionKeychain] = @YES;
    }
    return query;
}

static void rejectStatus(RCTPromiseRejectBlock reject, NSString *operation, OSStatus status) {
    NSError *error = [NSError errorWithDomain:NSOSStatusErrorDomain code:status userInfo:nil];
    reject(ErrorCode, [NSString stringWithFormat:@"%@ failed: %d", operation, (int)status], error);
}

RCT_EXPORT_METHOD(get:(NSString *)server
                  cloudSync:(BOOL)cloudSync
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSMutableDictionary *query = baseQuery(server, cloudSync);
    query[(__bridge NSString *)kSecMatchLimit] = (__bridge id)kSecMatchLimitOne;
    query[(__bridge NSString *)kSecReturnData] = @YES;

    CFTypeRef result = NULL;
    OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);
    if (status == errSecItemNotFound) {
        resolve([NSNull null]);
        return;
    }
    // Anything else, a locked keychain included, is an error and never a
    // missing entry
    if (status != errSecSuccess) {
        rejectStatus(reject, @"SecItemCopyMatching", status);
        return;
    }
    NSData *data = CFBridgingRelease(result);
    NSString *value = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    if (value == nil) {
        reject(ErrorCode, @"Stored value is not UTF-8", nil);
        return;
    }
    resolve(value);
}

RCT_EXPORT_METHOD(set:(NSString *)server
                  value:(NSString *)value
                  cloudSync:(BOOL)cloudSync
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSData *data = [value dataUsingEncoding:NSUTF8StringEncoding];
    NSMutableDictionary *query = baseQuery(server, cloudSync);
    NSDictionary *changes = @{
        (__bridge NSString *)kSecAttrAccount: server,
        (__bridge NSString *)kSecValueData: data,
        (__bridge NSString *)kSecAttrAccessible: (__bridge id)kSecAttrAccessibleAfterFirstUnlock
    };

    OSStatus status = SecItemUpdate((__bridge CFDictionaryRef)query, (__bridge CFDictionaryRef)changes);
    if (status == errSecDuplicateItem) {
        // Items under several accounts match and cannot all take one account.
        // Replace them all, as react-native-keychain did.
        SecItemDelete((__bridge CFDictionaryRef)query);
        status = errSecItemNotFound;
    }
    if (status == errSecItemNotFound) {
        NSMutableDictionary *attributes = baseQuery(server, cloudSync);
        [attributes addEntriesFromDictionary:changes];
        status = SecItemAdd((__bridge CFDictionaryRef)attributes, NULL);
    }
    if (status != errSecSuccess) {
        rejectStatus(reject, @"Keychain write", status);
        return;
    }
    resolve(@YES);
}

RCT_EXPORT_METHOD(remove:(NSString *)server
                  cloudSync:(BOOL)cloudSync
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    OSStatus status = SecItemDelete((__bridge CFDictionaryRef)baseQuery(server, cloudSync));
    if (status != errSecSuccess && status != errSecItemNotFound) {
        rejectStatus(reject, @"SecItemDelete", status);
        return;
    }
    resolve(@YES);
}

// Servers only, never values
RCT_EXPORT_METHOD(listServers:(BOOL)cloudSync
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSDictionary *query = @{
        (__bridge NSString *)kSecClass: (__bridge id)kSecClassInternetPassword,
        (__bridge NSString *)kSecAttrSynchronizable: cloudSync ? @YES : @NO,
        (__bridge NSString *)kSecMatchLimit: (__bridge id)kSecMatchLimitAll,
        (__bridge NSString *)kSecReturnAttributes: @YES
    };

    CFTypeRef result = NULL;
    OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);
    if (status == errSecItemNotFound) {
        resolve(@[]);
        return;
    }
    if (status != errSecSuccess) {
        rejectStatus(reject, @"SecItemCopyMatching", status);
        return;
    }

    NSArray *items = CFBridgingRelease(result);
    NSMutableOrderedSet<NSString *> *servers = [NSMutableOrderedSet orderedSet];
    for (NSDictionary *item in items) {
        NSString *server = item[(__bridge NSString *)kSecAttrServer];
        if (server.length > 0) {
            [servers addObject:server];
        }
    }
    resolve([servers array]);
}

// Delete every internet-password item the app owns, in both partitions
RCT_EXPORT_METHOD(wipe:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    for (NSNumber *synchronizable in @[@NO, @YES]) {
        NSDictionary *query = @{
            (__bridge NSString *)kSecClass: (__bridge id)kSecClassInternetPassword,
            (__bridge NSString *)kSecAttrSynchronizable: synchronizable
        };
        OSStatus status = SecItemDelete((__bridge CFDictionaryRef)query);
        if (status != errSecSuccess && status != errSecItemNotFound) {
            rejectStatus(reject, @"SecItemDelete", status);
            return;
        }
    }
    resolve(@YES);
}

@end

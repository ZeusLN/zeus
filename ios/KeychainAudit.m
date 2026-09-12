#import "KeychainAudit.h"
#import <Security/Security.h>

// Enumerates keychain internet-password items so JS can audit and clean up
// the app's keychain partitions. react-native-keychain only enumerates
// generic-password services (getAllGenericPasswordServices); Zeus stores all
// app data as internet passwords, so listing them needs this module.
//
// Servers only, never values: secrets stay off this path and are read through
// react-native-keychain's existing credential APIs.

@implementation KeychainAudit

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_EXPORT_METHOD(getInternetPasswordServers:(BOOL)synchronizable
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSDictionary *query = @{
            (__bridge NSString *)kSecClass: (__bridge id)kSecClassInternetPassword,
            (__bridge NSString *)kSecAttrSynchronizable: synchronizable ? @YES : @NO,
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
            reject(@"ERR_KEYCHAIN_AUDIT",
                   [NSString stringWithFormat:@"SecItemCopyMatching failed: %d", (int)status],
                   nil);
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
    });
}

@end

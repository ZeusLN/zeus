#import "KeychainAudit.h"
#import <Security/Security.h>
#import <UIKit/UIKit.h>

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

// Reads KEYCHAIN_SURVIVED_REINSTALL, which the first-run check in
// AppDelegate.mm sets. Read here at call time rather than through RN's
// Settings module: Settings.get serves a snapshot taken when JS loaded and
// only learns of later writes through an async event, and the first-run check
// can run after JS has loaded when launch happened before protected data was
// available.
//
// While that check is still deferred the flag is not known yet, and an unset
// flag would let JS copy the iCloud partition into a keychain the check is
// about to clear. So the promise resolves only once the check has run.
RCT_EXPORT_METHOD(keychainSurvivedReinstall:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    // AppDelegate sets and clears the pending state on the main queue
    dispatch_async(dispatch_get_main_queue(), ^{
        id delegate = [UIApplication sharedApplication].delegate;
        BOOL pending =
            [delegate respondsToSelector:NSSelectorFromString(@"firstRunKeychainCheckPending")] &&
            [[delegate valueForKey:@"firstRunKeychainCheckPending"] boolValue];

        if (!pending) {
            resolve(@([[NSUserDefaults standardUserDefaults]
                          boolForKey:@"KEYCHAIN_SURVIVED_REINSTALL"]));
            return;
        }

        NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
        __block id observer = [center
            addObserverForName:@"ZeusFirstRunKeychainCheckDidRun"
                        object:nil
                         queue:[NSOperationQueue mainQueue]
                    usingBlock:^(NSNotification *note) {
                        [[NSNotificationCenter defaultCenter] removeObserver:observer];
                        observer = nil;
                        resolve(@([[NSUserDefaults standardUserDefaults]
                                      boolForKey:@"KEYCHAIN_SURVIVED_REINSTALL"]));
                    }];
    });
}

@end

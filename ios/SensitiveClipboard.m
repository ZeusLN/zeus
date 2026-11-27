#import "SensitiveClipboard.h"
#import <UIKit/UIKit.h>

// Copies secrets (seed phrases, channel backups) for utils/ClipboardUtils.
// The item is local-only, so it does not sync to the user's other devices
// through Universal Clipboard, and iOS removes it at the expiration date.
// ClipboardUtils then has no timer to run and does not read the clipboard
// back, which would show the paste prompt if another app wrote to it.

@implementation SensitiveClipboard

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

// Same queue as @react-native-clipboard/clipboard
- (dispatch_queue_t)methodQueue {
    return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(setString:(NSString *)value
                  expiresInMs:(double)expiresInMs
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (value == nil || !(expiresInMs > 0)) {
        reject(@"ERR_SENSITIVE_CLIPBOARD", @"Invalid value or expiry", nil);
        return;
    }
    NSDate *expiry = [NSDate dateWithTimeIntervalSinceNow:expiresInMs / 1000.0];
    [[UIPasteboard generalPasteboard]
        setItems:@[ @{ @"public.utf8-plain-text" : value } ]
         options:@{
             UIPasteboardOptionLocalOnly : @YES,
             UIPasteboardOptionExpirationDate : expiry
         }];
    resolve(nil);
}

@end

#import "ShareBridge.h"
#import <React/RCTLog.h>
#import <UIKit/UIKit.h>

static BOOL _screenCaptureProtectionEnabled = NO;
static UIView *_privacyOverlayView = nil;

@implementation ShareBridge

RCT_EXPORT_MODULE(MobileTools);

- (NSURL *)getSharedFileURL {
    NSString *appGroupID = @"group.com.zeusln.zeus";
    NSURL *containerURL = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:appGroupID];
    if (containerURL == nil) {
        return nil;
    }
    return [containerURL URLByAppendingPathComponent:@"sharedQR.txt"];
}

- (void)showOverlay {
    dispatch_async(dispatch_get_main_queue(), ^{
        UIWindow *window = [UIApplication sharedApplication].keyWindow;
        if (!window) return;
        if (!_privacyOverlayView) {
            _privacyOverlayView = [[UIView alloc] init];
            _privacyOverlayView.backgroundColor = [UIColor blackColor];
            _privacyOverlayView.autoresizingMask =
                UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
        }
        _privacyOverlayView.frame = window.bounds;
        [window addSubview:_privacyOverlayView];
    });
}

- (void)hideOverlay {
    dispatch_async(dispatch_get_main_queue(), ^{
        [_privacyOverlayView removeFromSuperview];
    });
}

- (void)screenCaptureChanged {
    if ([UIScreen mainScreen].isCaptured) {
        [self showOverlay];
    } else {
        [self hideOverlay];
    }
}

- (void)appWillResignActive {
    if (_screenCaptureProtectionEnabled) {
        [self showOverlay];
    }
}

- (void)appDidBecomeActive {
    if (![UIScreen mainScreen].isCaptured) {
        [self hideOverlay];
    }
}

RCT_EXPORT_METHOD(setSecureFlag:(BOOL)enable
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    _screenCaptureProtectionEnabled = enable;

    NSNotificationCenter *nc = [NSNotificationCenter defaultCenter];
    // Remove first to avoid duplicate registration
    [nc removeObserver:self name:UIScreenCapturedDidChangeNotification object:nil];
    [nc removeObserver:self name:UIApplicationWillResignActiveNotification object:nil];
    [nc removeObserver:self name:UIApplicationDidBecomeActiveNotification object:nil];

    if (enable) {
        [nc addObserver:self selector:@selector(screenCaptureChanged)
                   name:UIScreenCapturedDidChangeNotification object:nil];
        [nc addObserver:self selector:@selector(appWillResignActive)
                   name:UIApplicationWillResignActiveNotification object:nil];
        [nc addObserver:self selector:@selector(appDidBecomeActive)
                   name:UIApplicationDidBecomeActiveNotification object:nil];

        if ([UIScreen mainScreen].isCaptured) {
            [self showOverlay];
        }
    } else {
        [self hideOverlay];
    }

    resolve(@(YES));
}

RCT_EXPORT_METHOD(getSharedImageBase64:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    NSURL *fileURL = [self getSharedFileURL];
    if (fileURL == nil) {
      resolve(nil);
      return;
    }

    if (![[NSFileManager defaultManager] fileExistsAtPath:fileURL.path]) {
        resolve(nil);
        return;
    }
    NSString *base64String = [NSString stringWithContentsOfURL:fileURL encoding:NSUTF8StringEncoding error:nil];

    if (base64String && base64String.length > 0) {
      resolve(base64String);
    } else {
      resolve(nil);
    }
  }
  @catch (NSException *exception) {
    reject(@"SHARE_ERROR", exception.reason, nil);
  }
}

- (void)clearSharedFile {
    NSURL *fileURL = [self getSharedFileURL];
    if (fileURL != nil) {
        [[NSFileManager defaultManager] removeItemAtURL:fileURL error:nil];
    }
}

RCT_EXPORT_METHOD(clearSharedIntent:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
   @try {
     NSURL *fileURL = [self getSharedFileURL];
     if (fileURL != nil && [[NSFileManager defaultManager] fileExistsAtPath:fileURL.path]) {
         [[NSFileManager defaultManager] removeItemAtURL:fileURL error:nil];
     }
     resolve(@(YES));
   }
   @catch (NSException *exception) {
     reject(@"CLEAR_ERROR", exception.reason, nil);
   }
}

- (NSDictionary *)constantsToExport
{
  return @{ @"isCatalyst": @(NO) };
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
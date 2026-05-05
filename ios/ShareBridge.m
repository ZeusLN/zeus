#import "ShareBridge.h"
#import <React/RCTLog.h>
#import <UIKit/UIKit.h>

// Passes all touches through to subviews so the RN app remains interactive
// when parented inside the secure UITextField container.
@interface RNSecureContainer : UITextField
@end
@implementation RNSecureContainer
- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event {
    for (UIView *subview in self.subviews) {
        UIView *hit = [subview hitTest:[self convertPoint:point toView:subview] withEvent:event];
        if (hit) return hit;
    }
    return nil;
}
@end

static RNSecureContainer *_secureTextField = nil;
static UIView *_originalRootParent = nil;
static NSUInteger _originalRootViewIndex = 0;

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

- (void)applySecureTextFieldHack {
    UIWindow *window = [UIApplication sharedApplication].keyWindow;
    if (!window || !window.rootViewController) return;
    UIView *rootView = window.rootViewController.view;
    if (!rootView || _secureTextField) return;

    RNSecureContainer *container = [[RNSecureContainer alloc] initWithFrame:window.bounds];
    container.secureTextEntry = YES;
    container.backgroundColor = [UIColor clearColor];
    container.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    [window insertSubview:container atIndex:0];

    // Force layout so UITextField creates its private internal subviews
    // (e.g. _UITextLayoutCanvasView) — the canvas is what iOS treats as
    // "secure" content and excludes from screenshots/recordings.
    [container layoutIfNeeded];

    UIView *canvasView = nil;
    for (UIView *sub in container.subviews) {
        if ([NSStringFromClass([sub class]) containsString:@"CanvasView"]) {
            canvasView = sub;
            break;
        }
    }
    if (!canvasView) canvasView = container.subviews.firstObject;
    if (!canvasView) {
        [container removeFromSuperview];
        return;
    }

    _secureTextField = container;
    _originalRootParent = rootView.superview;
    _originalRootViewIndex = [rootView.superview.subviews indexOfObject:rootView];

    [canvasView addSubview:rootView];
    rootView.frame = canvasView.bounds;
    rootView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
}

- (void)removeSecureTextFieldHack {
    if (!_secureTextField || !_originalRootParent) return;
    UIWindow *window = [UIApplication sharedApplication].keyWindow;
    UIView *rootView = window ? window.rootViewController.view : nil;
    if (rootView) {
        [_originalRootParent insertSubview:rootView atIndex:_originalRootViewIndex];
    }
    [_secureTextField removeFromSuperview];
    _secureTextField = nil;
    _originalRootParent = nil;
    _originalRootViewIndex = 0;
}

- (void)screenCaptureChanged {
    [self sendEventWithName:@"ScreenRecordingStateChanged"
                       body:@{@"isCapturing": @([UIScreen mainScreen].isCaptured)}];
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"ScreenRecordingStateChanged"];
}

RCT_EXPORT_METHOD(setSecureFlag:(BOOL)enable
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSNotificationCenter *nc = [NSNotificationCenter defaultCenter];
    [nc removeObserver:self name:UIScreenCapturedDidChangeNotification object:nil];

    if (enable) {
        dispatch_async(dispatch_get_main_queue(), ^{
            [self applySecureTextFieldHack];
            if ([UIScreen mainScreen].isCaptured) {
                [self screenCaptureChanged];
            }
        });

        [nc addObserver:self selector:@selector(screenCaptureChanged)
                   name:UIScreenCapturedDidChangeNotification object:nil];
    } else {
        dispatch_async(dispatch_get_main_queue(), ^{
            [self removeSecureTextFieldHack];
        });
        [self sendEventWithName:@"ScreenRecordingStateChanged"
                           body:@{@"isCapturing": @NO}];
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
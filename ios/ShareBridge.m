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
// The view moved into the canvas. Restored by reference, since the active
// window may be gone (e.g. on a bridge reload in the background).
static UIView *_reparentedRootView = nil;

@interface ShareBridge ()
{
    BOOL _hasListeners;
}
@end

@implementation ShareBridge

RCT_EXPORT_MODULE(MobileTools);

- (UIWindow *)activeWindow {
    for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
        if ([scene isKindOfClass:[UIWindowScene class]] &&
            scene.activationState == UISceneActivationStateForegroundActive) {
            UIWindowScene *windowScene = (UIWindowScene *)scene;
            for (UIWindow *w in windowScene.windows) {
                if (w.isKeyWindow) return w;
            }
            return windowScene.windows.firstObject;
        }
    }
    return nil;
}

- (NSURL *)getSharedFileURL {
    NSString *appGroupID = @"group.com.zeusln.zeus";
    NSURL *containerURL = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:appGroupID];
    if (containerURL == nil) {
        return nil;
    }
    return [containerURL URLByAppendingPathComponent:@"sharedQR.txt"];
}

// Returns NO when the root view could not be moved into a secure canvas,
// so the caller can report that protection is off.
- (BOOL)applySecureTextFieldHack {
    if (_secureTextField) return YES;
    UIWindow *window = [self activeWindow];
    if (!window || !window.rootViewController) return NO;
    UIView *rootView = window.rootViewController.view;
    if (!rootView) return NO;

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
    // Fail closed: only the canvas view inherits iOS's secure-content
    // exclusion. Other UITextField subviews (border, placeholder, clear
    // button) do not, so falling back to e.g. subviews.firstObject would
    // silently render content unprotected.
    if (!canvasView) {
        [container removeFromSuperview];
        return NO;
    }

    _secureTextField = container;
    _originalRootParent = rootView.superview;
    _originalRootViewIndex = [rootView.superview.subviews indexOfObject:rootView];
    _reparentedRootView = rootView;

    [canvasView addSubview:rootView];
    rootView.frame = canvasView.bounds;
    rootView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    return YES;
}

- (void)removeSecureTextFieldHack {
    if (!_secureTextField) return;
    UIView *rootView = _reparentedRootView;
    if (rootView && _originalRootParent) {
        NSUInteger index = MIN(_originalRootViewIndex, _originalRootParent.subviews.count);
        [_originalRootParent insertSubview:rootView atIndex:index];
        rootView.frame = _originalRootParent.bounds;
    }
    [_secureTextField removeFromSuperview];
    _secureTextField = nil;
    _originalRootParent = nil;
    _originalRootViewIndex = 0;
    _reparentedRootView = nil;
}

- (void)screenCaptureChanged {
    if (!_hasListeners) return;
    [self sendEventWithName:@"ScreenRecordingStateChanged"
                       body:@{@"isCapturing": @([self activeWindow].windowScene.screen.isCaptured)}];
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"ScreenRecordingStateChanged"];
}

- (void)startObserving {
    _hasListeners = YES;
}

- (void)stopObserving {
    _hasListeners = NO;
}

// On a bridge reload, put the root view back and drop the secure container,
// which is static and would otherwise outlive this module instance.
- (void)invalidate {
    [super invalidate];
    [[NSNotificationCenter defaultCenter] removeObserver:self
                                                    name:UIScreenCapturedDidChangeNotification
                                                  object:nil];
    dispatch_async(dispatch_get_main_queue(), ^{
        [self removeSecureTextFieldHack];
    });
}

RCT_EXPORT_METHOD(setSecureFlag:(BOOL)enable
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSNotificationCenter *nc = [NSNotificationCenter defaultCenter];
    [nc removeObserver:self name:UIScreenCapturedDidChangeNotification object:nil];

    // Settle the promise on the main queue, after the view work, so a
    // failed enable reaches JS as a rejection.
    dispatch_async(dispatch_get_main_queue(), ^{
        if (enable) {
            if (![self applySecureTextFieldHack]) {
                reject(@"SECURE_FLAG_FAILED",
                       @"Could not enable screen capture protection", nil);
                return;
            }
            [nc addObserver:self selector:@selector(screenCaptureChanged)
                       name:UIScreenCapturedDidChangeNotification object:nil];
            if ([self activeWindow].windowScene.screen.isCaptured) {
                [self screenCaptureChanged];
            }
        } else {
            [self removeSecureTextFieldHack];
            if (self->_hasListeners) {
                [self sendEventWithName:@"ScreenRecordingStateChanged"
                                   body:@{@"isCapturing": @NO}];
            }
        }
        resolve(@(YES));
    });
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
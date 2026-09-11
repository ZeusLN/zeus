#ifdef __cplusplus
// Include CallInvoker.h textually before RCTAppDelegate.h. RCTTurboModuleManager.h
// imports the ReactCommon clang module, whose umbrella does not cover
// CallInvoker.h (it belongs to the unmodularized React-callinvoker pod), so
// NativeMethodCallInvoker would otherwise be invisible at its use site in
// RCTTurboModule.h when React core is built from source on RN 0.87.
#import <ReactCommon/CallInvoker.h>
#endif
#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>

@interface AppDelegate : RCTAppDelegate

@end

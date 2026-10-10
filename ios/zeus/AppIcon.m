//
//  AppIcon.m
//  zeus
//
//  Objective-C bridge for AppIcon Swift class. Wraps
//  UIApplication.setAlternateIconName so Settings > Display can switch
//  between bundled icon variants (default / Black / White).
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppIcon, NSObject)

RCT_EXTERN_METHOD(setAlternateIcon:(NSString * _Nullable)name
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getAlternateIcon:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end

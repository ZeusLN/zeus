#import "ShareBridge.h"
#import <React/RCTLog.h>

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
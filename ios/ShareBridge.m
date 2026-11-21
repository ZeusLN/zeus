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


// Take the shared image: read it and remove that same file in one call. The
// share extension can write a new sharedQR.txt at any time, so the file is
// first renamed out of the way (an atomic rename within the container) and
// then read. A share written after the rename lands at sharedQR.txt again and
// is left for the next call instead of being removed unread.
//
// JS stops waiting for the image soon after settleByMs, its Date.now()
// deadline. This call can wait behind other modules on a shared method
// queue, and a take that ran after JS gave up would remove the share with
// nobody to receive the image. So the take rejects with SHARE_TIMEOUT and
// leaves the share in place when it starts after settleByMs, or when its
// read of the file ends after it.
RCT_EXPORT_METHOD(takeSharedImageBase64:(double)settleByMs
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if ([[NSDate date] timeIntervalSince1970] * 1000 >= settleByMs) {
    reject(@"SHARE_TIMEOUT", @"Shared image take started after its deadline", nil);
    return;
  }

  @try {
    NSURL *fileURL = [self getSharedFileURL];
    if (fileURL == nil) {
      resolve(nil);
      return;
    }

    NSFileManager *fileManager = [NSFileManager defaultManager];
    if (![fileManager fileExistsAtPath:fileURL.path]) {
      resolve(nil);
      return;
    }

    NSURL *takenURL = [[fileURL URLByDeletingLastPathComponent]
        URLByAppendingPathComponent:@"sharedQR.taken.txt"];
    // A leftover from a take that was interrupted would make the move fail
    [fileManager removeItemAtURL:takenURL error:nil];

    NSError *moveError = nil;
    if (![fileManager moveItemAtURL:fileURL toURL:takenURL error:&moveError]) {
      // Deliver the image rather than lose it: read it in place and leave
      // the file, so the next call hands it over again
      RCTLogWarn(@"Failed to take shared image: %@", moveError);
      NSString *base64String = [NSString stringWithContentsOfURL:fileURL
                                                        encoding:NSUTF8StringEncoding
                                                           error:nil];
      resolve(base64String.length > 0 ? base64String : nil);
      return;
    }

    NSError *readError = nil;
    NSString *base64String = [NSString stringWithContentsOfURL:takenURL
                                                      encoding:NSUTF8StringEncoding
                                                         error:&readError];
    if (base64String == nil) {
      // Put the file back for the next call, unless a newer share has
      // already taken its place, in which case that one wins
      RCTLogWarn(@"Failed to read shared image: %@", readError);
      if (![fileManager moveItemAtURL:takenURL toURL:fileURL error:nil]) {
        [fileManager removeItemAtURL:takenURL error:nil];
      }
      resolve(nil);
      return;
    }

    // A large file or a busy disk can keep the read going past the
    // deadline. Put the share back the same way as for a failed read.
    if ([[NSDate date] timeIntervalSince1970] * 1000 >= settleByMs) {
      if (![fileManager moveItemAtURL:takenURL toURL:fileURL error:nil]) {
        [fileManager removeItemAtURL:takenURL error:nil];
      }
      reject(@"SHARE_TIMEOUT", @"Shared image take ran past its deadline", nil);
      return;
    }
    [fileManager removeItemAtURL:takenURL error:nil];

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

- (NSDictionary *)constantsToExport
{
  return @{ @"isCatalyst": @(NO) };
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
#import "BackgroundTaskManager.h"
#import <UIKit/UIKit.h>

@interface BackgroundTaskManager()

@property (nonatomic, assign) UIBackgroundTaskIdentifier backgroundTaskIdentifier;
@property (nonatomic, strong) NSDate *taskStartTime;
@property (nonatomic, strong) NSTimer *remainingTimeTimer;

@end

@implementation BackgroundTaskManager

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

- (instancetype)init {
    if (self = [super init]) {
        _backgroundTaskIdentifier = UIBackgroundTaskInvalid;
    }
    return self;
}

RCT_EXPORT_METHOD(startBackgroundTask:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self endBackgroundTaskInternal];
    
    self.taskStartTime = [NSDate date];
    NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
    formatter.dateFormat = @"yyyy-MM-dd'T'HH:mm:ss'Z'";
    formatter.timeZone = [NSTimeZone timeZoneWithAbbreviation:@"UTC"];
    NSString *startTimeString = [formatter stringFromDate:self.taskStartTime];
    
    __weak __typeof__(self) weakSelf = self;
    self.backgroundTaskIdentifier = [[UIApplication sharedApplication] beginBackgroundTaskWithName:@"NWCConnectionSetup" expirationHandler:^{
        __strong __typeof__(weakSelf) strongSelf = weakSelf;
        if (strongSelf) {
            NSTimeInterval elapsed = [[NSDate date] timeIntervalSinceDate:strongSelf.taskStartTime];
            NSLog(@"iOS: Background task expiring after %.2f seconds", elapsed);
            [strongSelf endBackgroundTaskInternal];
        }
    }];
    
    if (self.backgroundTaskIdentifier == UIBackgroundTaskInvalid) {
        NSLog(@"iOS: Failed to start background task");
        reject(@"BACKGROUND_TASK_ERROR", @"Failed to start background task", nil);
        return;
    }
    
    NSTimeInterval remainingTime = [[UIApplication sharedApplication] backgroundTimeRemaining];
    NSLog(@"iOS: Background task started at %@ with ID: %lu, initial remaining time: %.2f seconds",
          startTimeString, (unsigned long)self.backgroundTaskIdentifier, remainingTime);
    
    [self startRemainingTimeLogger];
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(endBackgroundTask:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self endBackgroundTaskInternal];
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(getRemainingBackgroundTime:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSTimeInterval remainingTime = [[UIApplication sharedApplication] backgroundTimeRemaining];
    NSTimeInterval elapsed = self.taskStartTime ? [[NSDate date] timeIntervalSinceDate:self.taskStartTime] : 0;
    NSLog(@"iOS: getRemainingBackgroundTime called - elapsed: %.2f seconds, remaining: %.2f seconds",
          elapsed, remainingTime);
    resolve(@{@"remainingTime": @(remainingTime)});
}

RCT_EXPORT_METHOD(cleanup) {
    NSLog(@"iOS: cleanup() called");
    [self endBackgroundTaskInternal];
}

- (void)startRemainingTimeLogger {
    [self.remainingTimeTimer invalidate];
    __weak __typeof__(self) weakSelf = self;
    self.remainingTimeTimer = [NSTimer scheduledTimerWithTimeInterval:5.0 repeats:YES block:^(NSTimer * _Nonnull timer) {
        __strong __typeof__(weakSelf) strongSelf = weakSelf;
        if (strongSelf && strongSelf.backgroundTaskIdentifier != UIBackgroundTaskInvalid) {
            NSTimeInterval remainingTime = [[UIApplication sharedApplication] backgroundTimeRemaining];
            NSTimeInterval elapsed = [[NSDate date] timeIntervalSinceDate:strongSelf.taskStartTime];
            NSLog(@"iOS: Background task still running - elapsed: %.2f seconds, remaining: %.2f seconds",
                  elapsed, remainingTime);
        }
    }];
}

- (void)endBackgroundTaskInternal {
    if (self.backgroundTaskIdentifier == UIBackgroundTaskInvalid) {
        return;
    }
    
    [self.remainingTimeTimer invalidate];
    self.remainingTimeTimer = nil;
    
    NSTimeInterval elapsed = self.taskStartTime ? [[NSDate date] timeIntervalSinceDate:self.taskStartTime] : 0;
    NSLog(@"iOS: Background task ending after %.2f seconds with ID: %lu",
          elapsed, (unsigned long)self.backgroundTaskIdentifier);
    
    [[UIApplication sharedApplication] endBackgroundTask:self.backgroundTaskIdentifier];
    self.backgroundTaskIdentifier = UIBackgroundTaskInvalid;
    self.taskStartTime = nil;
}

- (void)dealloc {
    NSLog(@"iOS: BackgroundTaskManager dealloc");
    [self endBackgroundTaskInternal];
}

@end


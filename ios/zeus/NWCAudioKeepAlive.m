#import "NWCAudioKeepAlive.h"
#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>
#import <sys/utsname.h>

// ─── Event name constants ────────────────────────────────────────────────────
static NSString *const kEventInterrupted       = @"NWCAudioInterrupted";
static NSString *const kEventInterruptionEnded = @"NWCAudioInterruptionEnded";
static NSString *const kEventRouteChanged      = @"NWCAudioRouteChanged";
static NSString *const kEventStatusUpdate      = @"NWCAudioStatusUpdate";
static NSString *const kEventSuspended         = @"NWCAudioSuspended";

// How often (seconds) to emit a heartbeat status event while active
static const NSTimeInterval kStatusIntervalSeconds = 30.0;

// Silence buffer duration in seconds (short buffer looped forever)
static const double kSilentBufferDuration = 0.1;
static const double kSampleRate           = 44100.0;

@interface NWCAudioKeepAlive ()

@property (nonatomic, strong) AVAudioEngine      *audioEngine;
@property (nonatomic, strong) AVAudioPlayerNode  *playerNode;

// Monitoring
@property (nonatomic, strong) NSDate   *sessionStartTime;
@property (nonatomic, strong) NSDate   *backgroundEnteredTime;
@property (nonatomic, strong) NSTimer  *statusTimer;
@property (nonatomic, assign) BOOL      isActive;
@property (nonatomic, assign) BOOL      hasListeners;

// Stats
@property (nonatomic, assign) NSUInteger disconnectCount;
@property (nonatomic, strong) NSString  *lastDisconnectReason;
@property (nonatomic, strong) NSString  *iosVersion;
@property (nonatomic, strong) NSString  *deviceModel;

@end

@implementation NWCAudioKeepAlive

RCT_EXPORT_MODULE();

// ─── RCTEventEmitter ─────────────────────────────────────────────────────────

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[
        kEventInterrupted,
        kEventInterruptionEnded,
        kEventRouteChanged,
        kEventStatusUpdate,
        kEventSuspended
    ];
}

- (void)startObserving {
    self.hasListeners = YES;
}

- (void)stopObserving {
    self.hasListeners = NO;
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

- (instancetype)init {
    if (self = [super init]) {
        _isActive        = NO;
        _hasListeners    = NO;
        _disconnectCount = 0;
        _iosVersion      = [[UIDevice currentDevice] systemVersion];
        _deviceModel     = [self deviceModelIdentifier];
    }
    return self;
}

- (void)dealloc {
    NSTimer *timer = _statusTimer;
    _statusTimer = nil;
    if (timer) {
        dispatch_async(dispatch_get_main_queue(), ^{
            [timer invalidate];
        });
    }
    [self teardownAudioEngine];
    [self unregisterNotifications];
}


/**
 * Configures AVAudioSession with .playback category (mixWithOthers so we
 * don't hijack Spotify etc.), builds an AVAudioEngine that loops a silent
 * PCM buffer, and activates the session.  Returns a status dict on resolve.
 */
RCT_EXPORT_METHOD(startAudioKeepAlive:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.isActive) {
        NSLog(@"[NWCAudio] Already active – ignoring duplicate start");
        resolve([self currentStatusDict]);
        return;
    }

    NSError *error = nil;

    // 1. Configure AVAudioSession
    AVAudioSession *session = [AVAudioSession sharedInstance];
    BOOL ok = [session setCategory:AVAudioSessionCategoryPlayback
                       withOptions:AVAudioSessionCategoryOptionMixWithOthers
                             error:&error];
    if (!ok) {
        NSLog(@"[NWCAudio] setCategory failed: %@", error.localizedDescription);
        reject(@"AUDIO_SESSION_ERROR", @"Failed to set audio session category", error);
        return;
    }

    ok = [session setActive:YES error:&error];
    if (!ok) {
        NSLog(@"[NWCAudio] setActive failed: %@", error.localizedDescription);
        reject(@"AUDIO_SESSION_ERROR", @"Failed to activate audio session", error);
        return;
    }

    // 2. Build engine + silent buffer loop
    if (![self setupAudioEngine:&error]) {
        NSLog(@"[NWCAudio] engine setup failed: %@", error.localizedDescription);
        [session setActive:NO error:nil];
        reject(@"AUDIO_ENGINE_ERROR", @"Failed to set up audio engine", error);
        return;
    }

    // 3. Register for system notifications
    [self registerNotifications];

    self.sessionStartTime       = [NSDate date];
    self.backgroundEnteredTime  = nil;
    self.isActive               = YES;

    // 4. Start heartbeat timer (main thread for RunLoop compatibility)
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.statusTimer invalidate];
        if (!self.isActive) {
            return;
        }
        __weak typeof(self) weakSelf = self;
        self.statusTimer = [NSTimer scheduledTimerWithTimeInterval:kStatusIntervalSeconds
                                                          repeats:YES
                                                            block:^(NSTimer *t) {
            [weakSelf emitStatusUpdate:NO reason:nil];
        }];
    });

    NSLog(@"[NWCAudio] Started – iOS %@ on %@", self.iosVersion, self.deviceModel);
    resolve([self currentStatusDict]);
}

/**
 * Stops the audio engine and deactivates the AVAudioSession.
 */
RCT_EXPORT_METHOD(stopAudioKeepAlive:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self stopInternal:@"manual_stop"];
    resolve([self currentStatusDict]);
}

/**
 * Returns the current status without modifying state.
 */
RCT_EXPORT_METHOD(getStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve([self currentStatusDict]);
}

// ─── Audio engine ────────────────────────────────────────────────────────────

- (BOOL)setupAudioEngine:(NSError **)outError {
    self.audioEngine = [[AVAudioEngine alloc] init];
    self.playerNode  = [[AVAudioPlayerNode alloc] init];

    [self.audioEngine attachNode:self.playerNode];

    // Use stereo 44.1 kHz float format
    AVAudioFormat *format = [[AVAudioFormat alloc]
        initStandardFormatWithSampleRate:kSampleRate
                                channels:2];
    if (!format) {
        if (outError) {
            *outError = [NSError errorWithDomain:@"NWCAudioKeepAlive"
                                            code:1
                                        userInfo:@{NSLocalizedDescriptionKey:
                                                   @"Failed to create audio format"}];
        }
        return NO;
    }

    [self.audioEngine connect:self.playerNode
                           to:self.audioEngine.mainMixerNode
                       format:format];

    // Build a silent PCM buffer (zero-filled float samples)
    AVAudioFrameCount frameCount = (AVAudioFrameCount)(kSampleRate * kSilentBufferDuration);
    AVAudioPCMBuffer *silentBuffer = [[AVAudioPCMBuffer alloc]
        initWithPCMFormat:format
           frameCapacity:frameCount];
    if (!silentBuffer) {
        if (outError) {
            *outError = [NSError errorWithDomain:@"NWCAudioKeepAlive"
                                            code:2
                                        userInfo:@{NSLocalizedDescriptionKey:
                                                   @"Failed to allocate PCM buffer"}];
        }
        return NO;
    }
    silentBuffer.frameLength = frameCount;

    // Explicitly zero both channels (buffers may contain garbage memory)
    for (AVAudioChannelCount ch = 0; ch < format.channelCount; ch++) {
        memset(silentBuffer.floatChannelData[ch], 0,
               frameCount * sizeof(float));
    }

    // Schedule the buffer for infinite looping before starting the engine
    [self.playerNode scheduleBuffer:silentBuffer
                             atTime:nil
                            options:AVAudioPlayerNodeBufferLoops
                  completionHandler:nil];

    // Keep at a near-zero but non-zero volume so iOS does not optimize away
    // the audio engine (a true 0.0 can cause the engine to be suspended).
    self.audioEngine.mainMixerNode.outputVolume = 0.001f;

    NSError *startError = nil;
    if (![self.audioEngine startAndReturnError:&startError]) {
        if (outError) *outError = startError;
        self.audioEngine = nil;
        self.playerNode  = nil;
        return NO;
    }

    [self.playerNode play];
    NSLog(@"[NWCAudio] Engine running – silent loop active");
    return YES;
}

- (void)teardownAudioEngine {
    if (self.playerNode.isPlaying) {
        [self.playerNode stop];
    }
    if (self.audioEngine.isRunning) {
        [self.audioEngine stop];
    }
    self.playerNode  = nil;
    self.audioEngine = nil;
}

// ─── Internal stop ───────────────────────────────────────────────────────────

- (void)stopInternal:(NSString *)reason {
    if (!self.isActive) return;

    self.isActive = NO;

    NSTimer *timer = self.statusTimer;
    self.statusTimer = nil;
    dispatch_async(dispatch_get_main_queue(), ^{
        [timer invalidate];
    });

    [self teardownAudioEngine];
    [self unregisterNotifications];

    NSError *error = nil;
    [[AVAudioSession sharedInstance] setActive:NO
                                   withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
                                         error:&error];
    if (error) {
        NSLog(@"[NWCAudio] setActive:NO error: %@", error.localizedDescription);
    }

    NSTimeInterval uptime = self.sessionStartTime
        ? [[NSDate date] timeIntervalSinceDate:self.sessionStartTime]
        : 0;
    NSLog(@"[NWCAudio] Stopped after %.0f s – reason: %@", uptime, reason);
}

// ─── AVAudioSession notifications ────────────────────────────────────────────

- (void)registerNotifications {
    NSNotificationCenter *nc = [NSNotificationCenter defaultCenter];

    [nc addObserver:self
           selector:@selector(handleInterruption:)
               name:AVAudioSessionInterruptionNotification
             object:[AVAudioSession sharedInstance]];

    [nc addObserver:self
           selector:@selector(handleRouteChange:)
               name:AVAudioSessionRouteChangeNotification
             object:[AVAudioSession sharedInstance]];

    [nc addObserver:self
           selector:@selector(handleMediaServerReset:)
               name:AVAudioSessionMediaServicesWereResetNotification
             object:[AVAudioSession sharedInstance]];

    [nc addObserver:self
           selector:@selector(handleDidEnterBackground:)
               name:UIApplicationDidEnterBackgroundNotification
             object:nil];

    [nc addObserver:self
           selector:@selector(handleWillEnterForeground:)
               name:UIApplicationWillEnterForegroundNotification
             object:nil];
}

- (void)unregisterNotifications {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

// ─── Notification handlers ───────────────────────────────────────────────────

- (void)handleInterruption:(NSNotification *)notification {
    NSNumber *typeValue = notification.userInfo[AVAudioSessionInterruptionTypeKey];
    if (!typeValue) return;

    AVAudioSessionInterruptionType type =
        (AVAudioSessionInterruptionType)typeValue.unsignedIntegerValue;

    if (type == AVAudioSessionInterruptionTypeBegan) {
        self.disconnectCount++;
        self.lastDisconnectReason = @"audio_interruption";
        NSLog(@"[NWCAudio] Interruption began (disconnect #%lu)",
              (unsigned long)self.disconnectCount);

        [self safeEmit:kEventInterrupted body:@{
            @"reason":          @"interruption_began",
            @"disconnectCount": @(self.disconnectCount),
            @"uptimeSeconds":   @([self uptimeSeconds])
        }];

    } else if (type == AVAudioSessionInterruptionTypeEnded) {
        NSNumber *options = notification.userInfo[AVAudioSessionInterruptionOptionKey];
        BOOL shouldResume = options &&
            (options.unsignedIntegerValue & AVAudioSessionInterruptionOptionShouldResume);

        NSLog(@"[NWCAudio] Interruption ended – shouldResume: %d", shouldResume);

        if (shouldResume && self.isActive) {
            [self resumeAudioEngine];
        }

        [self safeEmit:kEventInterruptionEnded body:@{
            @"shouldResume":  @(shouldResume),
            @"uptimeSeconds": @([self uptimeSeconds])
        }];
    }
}

- (void)handleRouteChange:(NSNotification *)notification {
    NSNumber *reasonValue = notification.userInfo[AVAudioSessionRouteChangeReasonKey];
    AVAudioSessionRouteChangeReason reason =
        (AVAudioSessionRouteChangeReason)reasonValue.unsignedIntegerValue;

    NSString *reasonStr = [self routeChangeReasonString:reason];
    NSString *currentOutput = [self currentAudioOutputDescription];
    NSLog(@"[NWCAudio] Route changed: %@ → output: %@", reasonStr, currentOutput);

    [self safeEmit:kEventRouteChanged body:@{
        @"reason":        reasonStr,
        @"currentOutput": currentOutput,
        @"uptimeSeconds": @([self uptimeSeconds])
    }];
}

- (void)handleMediaServerReset:(NSNotification *)notification {
    NSLog(@"[NWCAudio] Media server reset – rebuilding engine");
    self.disconnectCount++;
    self.lastDisconnectReason = @"media_server_reset";

    if (self.isActive) {
        [self teardownAudioEngine];
        NSError *error = nil;
        if (![self setupAudioEngine:&error]) {
            NSLog(@"[NWCAudio] Failed to rebuild engine after reset: %@",
                  error.localizedDescription);
            [self safeEmit:kEventSuspended body:@{
                @"reason":     @"media_server_reset_recovery_failed",
                @"uptimeSeconds": @([self uptimeSeconds])
            }];
        }
    }
}

- (void)handleDidEnterBackground:(NSNotification *)notification {
    self.backgroundEnteredTime = [NSDate date];
    NSLog(@"[NWCAudio] App entered background – audio engine running: %d",
          self.audioEngine.isRunning);

    [self emitStatusUpdate:NO reason:@"entered_background"];
}

- (void)handleWillEnterForeground:(NSNotification *)notification {
    NSTimeInterval bgDuration = self.backgroundEnteredTime
        ? [[NSDate date] timeIntervalSinceDate:self.backgroundEnteredTime]
        : 0;
    NSLog(@"[NWCAudio] App returning to foreground after %.0f s in background",
          bgDuration);
    self.backgroundEnteredTime = nil;

    [self emitStatusUpdate:NO reason:@"returned_to_foreground"];
}

// ─── Audio engine resume ─────────────────────────────────────────────────────

- (void)resumeAudioEngine {
    if (self.audioEngine.isRunning) return;

    NSError *error = nil;

    // Re-activate session first
    [[AVAudioSession sharedInstance] setActive:YES error:&error];
    if (error) {
        NSLog(@"[NWCAudio] Re-activate session error: %@", error.localizedDescription);
    }

    if (![self.audioEngine startAndReturnError:&error]) {
        NSLog(@"[NWCAudio] Engine restart failed: %@", error.localizedDescription);
        self.disconnectCount++;
        self.lastDisconnectReason = @"engine_restart_failed";
        [self safeEmit:kEventSuspended body:@{
            @"reason":     @"engine_restart_failed",
            @"uptimeSeconds": @([self uptimeSeconds])
        }];
        return;
    }

    if (!self.playerNode.isPlaying) {
        [self.playerNode play];
    }
    NSLog(@"[NWCAudio] Engine resumed successfully");
}

// ─── Event helpers ───────────────────────────────────────────────────────────

- (void)emitStatusUpdate:(BOOL)isSuspected reason:(NSString *)reason {
    if (!self.hasListeners) return;

    NSMutableDictionary *body = [[self currentStatusDict] mutableCopy];
    if (reason) body[@"reason"] = reason;
    if (isSuspected) body[@"suspectedSuspension"] = @YES;

    [self safeEmit:kEventStatusUpdate body:body];
}

- (void)safeEmit:(NSString *)eventName body:(NSDictionary *)body {
    if (!self.hasListeners) return;
    [self sendEventWithName:eventName body:body];
}

// ─── Status dict ─────────────────────────────────────────────────────────────

- (NSDictionary *)currentStatusDict {
    NSTimeInterval uptime    = [self uptimeSeconds];
    NSTimeInterval bgElapsed = self.backgroundEnteredTime
        ? [[NSDate date] timeIntervalSinceDate:self.backgroundEnteredTime]
        : 0;

    return @{
        @"isActive":              @(self.isActive),
        @"engineRunning":         @(self.audioEngine.isRunning),
        @"uptimeSeconds":         @(uptime),
        @"backgroundDuration":    @(bgElapsed),
        @"disconnectCount":       @(self.disconnectCount),
        @"lastDisconnectReason":  self.lastDisconnectReason ?: @"none",
        @"iosVersion":            self.iosVersion ?: @"unknown",
        @"deviceModel":           self.deviceModel ?: @"unknown",
        @"currentOutput":         [self currentAudioOutputDescription]
    };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

- (NSTimeInterval)uptimeSeconds {
    return self.sessionStartTime
        ? [[NSDate date] timeIntervalSinceDate:self.sessionStartTime]
        : 0;
}

- (NSString *)currentAudioOutputDescription {
    AVAudioSessionRouteDescription *route =
        [AVAudioSession sharedInstance].currentRoute;
    NSMutableArray *outputs = [NSMutableArray array];
    for (AVAudioSessionPortDescription *port in route.outputs) {
        [outputs addObject:port.portName ?: port.portType];
    }
    return outputs.count > 0 ? [outputs componentsJoinedByString:@", "] : @"none";
}

- (NSString *)routeChangeReasonString:(AVAudioSessionRouteChangeReason)reason {
    switch (reason) {
        case AVAudioSessionRouteChangeReasonUnknown:              return @"unknown";
        case AVAudioSessionRouteChangeReasonNewDeviceAvailable:   return @"new_device_available";
        case AVAudioSessionRouteChangeReasonOldDeviceUnavailable: return @"old_device_unavailable";
        case AVAudioSessionRouteChangeReasonCategoryChange:       return @"category_change";
        case AVAudioSessionRouteChangeReasonOverride:             return @"override";
        case AVAudioSessionRouteChangeReasonWakeFromSleep:        return @"wake_from_sleep";
        case AVAudioSessionRouteChangeReasonNoSuitableRouteForCategory: return @"no_suitable_route";
        case AVAudioSessionRouteChangeReasonRouteConfigurationChange:   return @"route_config_change";
        default:                                                  return @"other";
    }
}

- (NSString *)deviceModelIdentifier {
    struct utsname sysInfo;
    uname(&sysInfo);
    return [NSString stringWithCString:sysInfo.machine
                              encoding:NSUTF8StringEncoding];
}

@end

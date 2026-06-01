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
static NSString *const kEventTrackChanged      = @"NWCAudioTrackChanged";

// How often (seconds) to emit a heartbeat status event while active
static const NSTimeInterval kStatusIntervalSeconds = 30.0;

// Available ambient audio tracks bundled with the app
static NSArray<NSString *> *kAvailableTracks(void) {
    return @[@"Soft Pulse", @"Fireplace", @"White Noise", @"Gentle Rain"];
}

@interface NWCAudioKeepAlive () <AVAudioPlayerDelegate>

@property (nonatomic, strong) AVAudioPlayer     *audioPlayer;

// Track management
@property (nonatomic, copy)   NSArray<NSString *> *trackNames;
@property (nonatomic, assign) NSInteger            currentTrackIndex;
@property (nonatomic, assign) BOOL                 isMuted;

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
        kEventSuspended,
        kEventTrackChanged,
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
        _isActive          = NO;
        _hasListeners      = NO;
        _disconnectCount   = 0;
        _trackNames        = kAvailableTracks();
        _currentTrackIndex = 0;
        _isMuted           = NO;
        _iosVersion        = [[UIDevice currentDevice] systemVersion];
        _deviceModel       = [self deviceModelIdentifier];
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
    [self teardownAudioPlayer];
    [self unregisterNotifications];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Starts the AVAudioSession (.playback + mixWithOthers) and begins looping
 * the currently selected ambient track.  Returns a status dict on resolve.
 */
RCT_EXPORT_METHOD(startAudioKeepAlive:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.isActive) {
        NSLog(@"[NWCAudio] Already active – ignoring duplicate start");
        resolve([self currentStatusDict]);
        return;
    }

    NSError *error = nil;

    // 1. Configure AVAudioSession for background playback
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

    // 2. Load and play the selected track
    if (![self loadAndPlayTrackAtIndex:self.currentTrackIndex error:&error]) {
        NSLog(@"[NWCAudio] Failed to load track: %@", error.localizedDescription);
        [session setActive:NO error:nil];
        reject(@"AUDIO_PLAYER_ERROR", @"Failed to load audio track", error);
        return;
    }

    // 3. Register for system notifications
    [self registerNotifications];

    self.sessionStartTime      = [NSDate date];
    self.backgroundEnteredTime = nil;
    self.isActive              = YES;

    // 4. Start heartbeat timer on main thread
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.statusTimer invalidate];
        if (!self.isActive) return;
        __weak typeof(self) weakSelf = self;
        self.statusTimer = [NSTimer scheduledTimerWithTimeInterval:kStatusIntervalSeconds
                                                          repeats:YES
                                                            block:^(NSTimer *t) {
            [weakSelf emitStatusUpdate:NO reason:nil];
        }];
    });

    NSLog(@"[NWCAudio] Started – iOS %@ on %@ – track: %@",
          self.iosVersion, self.deviceModel, self.trackNames[self.currentTrackIndex]);
    resolve([self currentStatusDict]);
}

/**
 * Stops playback and deactivates the AVAudioSession.
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

/**
 * Returns the list of available ambient audio tracks.
 */
RCT_EXPORT_METHOD(getAvailableTracks:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSMutableArray *result = [NSMutableArray array];
    for (NSInteger i = 0; i < self.trackNames.count; i++) {
        [result addObject:@{
            @"index": @(i),
            @"name":  self.trackNames[i],
            @"isSelected": @(i == self.currentTrackIndex)
        }];
    }
    resolve(result);
}

/**
 * Selects a track by index and immediately switches to it if active.
 */
RCT_EXPORT_METHOD(setTrack:(NSInteger)index
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (index < 0 || index >= (NSInteger)self.trackNames.count) {
        reject(@"INVALID_TRACK", @"Track index out of range", nil);
        return;
    }

    self.currentTrackIndex = index;

    if (self.isActive) {
        NSError *error = nil;
        if (![self loadAndPlayTrackAtIndex:index error:&error]) {
            reject(@"AUDIO_PLAYER_ERROR", @"Failed to switch audio track", error);
            return;
        }
    }

    [self safeEmit:kEventTrackChanged body:@{
        @"trackIndex": @(index),
        @"trackName":  self.trackNames[index]
    }];

    resolve([self currentStatusDict]);
}

/**
 * Advances to the next track (wraps around).
 */
RCT_EXPORT_METHOD(nextTrack:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSInteger next = (self.currentTrackIndex + 1) % self.trackNames.count;
    [self setTrack:next resolver:resolve rejecter:reject];
}

/**
 * Goes back to the previous track (wraps around).
 */
RCT_EXPORT_METHOD(previousTrack:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSInteger prev = (self.currentTrackIndex - 1 + self.trackNames.count) % self.trackNames.count;
    [self setTrack:prev resolver:resolve rejecter:reject];
}

/**
 * Mutes or unmutes the audio track. The session stays alive; only volume is 0.
 */
RCT_EXPORT_METHOD(setMuted:(BOOL)muted
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    self.isMuted = muted;
    self.audioPlayer.volume = muted ? 0.0f : 1.0f;
    NSLog(@"[NWCAudio] %@", muted ? @"Muted" : @"Unmuted");
    resolve([self currentStatusDict]);
}

// ─── Audio player ────────────────────────────────────────────────────────────

- (BOOL)loadAndPlayTrackAtIndex:(NSInteger)index error:(NSError **)outError {
    NSString *trackName = self.trackNames[index];
    NSString *path = [[NSBundle mainBundle] pathForResource:trackName ofType:@"mp3"];
    if (!path) {
        if (outError) {
            *outError = [NSError errorWithDomain:@"NWCAudioKeepAlive"
                                            code:3
                                        userInfo:@{NSLocalizedDescriptionKey:
                                                   [NSString stringWithFormat:@"Audio resource not found: %@.mp3", trackName]}];
        }
        NSLog(@"[NWCAudio] Resource not found: %@.mp3", trackName);
        return NO;
    }

    NSURL *url = [NSURL fileURLWithPath:path];

    // Stop and release the existing player
    [self teardownAudioPlayer];

    NSError *playerError = nil;
    AVAudioPlayer *player = [[AVAudioPlayer alloc] initWithContentsOfURL:url error:&playerError];
    if (!player) {
        if (outError) *outError = playerError;
        NSLog(@"[NWCAudio] AVAudioPlayer init failed: %@", playerError.localizedDescription);
        return NO;
    }

    player.numberOfLoops = -1; // infinite loop
    player.volume        = self.isMuted ? 0.0f : 1.0f;
    player.delegate      = self;

    if (![player prepareToPlay]) {
        if (outError) {
            *outError = [NSError errorWithDomain:@"NWCAudioKeepAlive"
                                            code:4
                                        userInfo:@{NSLocalizedDescriptionKey:
                                                   @"AVAudioPlayer failed to prepare"}];
        }
        return NO;
    }

    [player play];
    self.audioPlayer = player;
    NSLog(@"[NWCAudio] Now playing: %@%@", trackName, self.isMuted ? @" (muted)" : @"");
    return YES;
}

- (void)teardownAudioPlayer {
    if (self.audioPlayer.isPlaying) {
        [self.audioPlayer stop];
    }
    self.audioPlayer.delegate = nil;
    self.audioPlayer = nil;
}

// ─── AVAudioPlayerDelegate ───────────────────────────────────────────────────

- (void)audioPlayerDecodeErrorDidOccur:(AVAudioPlayer *)player error:(NSError *)error {
    NSLog(@"[NWCAudio] Decode error: %@", error.localizedDescription);
    self.disconnectCount++;
    self.lastDisconnectReason = @"decode_error";
    [self safeEmit:kEventSuspended body:@{
        @"reason":        @"decode_error",
        @"uptimeSeconds": @([self uptimeSeconds])
    }];
}

- (void)audioPlayerDidFinishPlaying:(AVAudioPlayer *)player successfully:(BOOL)flag {
    // numberOfLoops = -1 means this should never fire, but guard against it
    if (self.isActive) {
        NSLog(@"[NWCAudio] Player finished unexpectedly – restarting");
        [player play];
    }
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

    [self teardownAudioPlayer];
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
            [self resumeAudioPlayer];
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

    NSString *reasonStr     = [self routeChangeReasonString:reason];
    NSString *currentOutput = [self currentAudioOutputDescription];
    NSLog(@"[NWCAudio] Route changed: %@ → output: %@", reasonStr, currentOutput);

    [self safeEmit:kEventRouteChanged body:@{
        @"reason":        reasonStr,
        @"currentOutput": currentOutput,
        @"uptimeSeconds": @([self uptimeSeconds])
    }];
}

- (void)handleMediaServerReset:(NSNotification *)notification {
    NSLog(@"[NWCAudio] Media server reset – reloading player");
    self.disconnectCount++;
    self.lastDisconnectReason = @"media_server_reset";

    if (self.isActive) {
        NSError *error = nil;
        [[AVAudioSession sharedInstance] setActive:YES error:nil];
        if (![self loadAndPlayTrackAtIndex:self.currentTrackIndex error:&error]) {
            NSLog(@"[NWCAudio] Failed to rebuild player after reset: %@",
                  error.localizedDescription);
            [self safeEmit:kEventSuspended body:@{
                @"reason":        @"media_server_reset_recovery_failed",
                @"uptimeSeconds": @([self uptimeSeconds])
            }];
        }
    }
}

- (void)handleDidEnterBackground:(NSNotification *)notification {
    self.backgroundEnteredTime = [NSDate date];
    NSLog(@"[NWCAudio] App entered background – player playing: %d",
          self.audioPlayer.isPlaying);
    [self emitStatusUpdate:NO reason:@"entered_background"];
}

- (void)handleWillEnterForeground:(NSNotification *)notification {
    NSTimeInterval bgDuration = self.backgroundEnteredTime
        ? [[NSDate date] timeIntervalSinceDate:self.backgroundEnteredTime]
        : 0;
    NSLog(@"[NWCAudio] App returning to foreground after %.0f s in background",
          bgDuration);
    self.backgroundEnteredTime = nil;

    // If the player was stopped while in background, restart it
    if (self.isActive && !self.audioPlayer.isPlaying) {
        NSError *error = nil;
        [self loadAndPlayTrackAtIndex:self.currentTrackIndex error:&error];
    }

    [self emitStatusUpdate:NO reason:@"returned_to_foreground"];
}

// ─── Audio player resume ─────────────────────────────────────────────────────

- (void)resumeAudioPlayer {
    if (self.audioPlayer.isPlaying) return;

    NSError *error = nil;
    [[AVAudioSession sharedInstance] setActive:YES error:&error];
    if (error) {
        NSLog(@"[NWCAudio] Re-activate session error: %@", error.localizedDescription);
    }

    if (self.audioPlayer) {
        [self.audioPlayer play];
        NSLog(@"[NWCAudio] Player resumed");
    } else {
        // Player was deallocated – recreate it
        if (![self loadAndPlayTrackAtIndex:self.currentTrackIndex error:&error]) {
            NSLog(@"[NWCAudio] Player restart failed: %@", error.localizedDescription);
            self.disconnectCount++;
            self.lastDisconnectReason = @"player_restart_failed";
            [self safeEmit:kEventSuspended body:@{
                @"reason":        @"player_restart_failed",
                @"uptimeSeconds": @([self uptimeSeconds])
            }];
        }
    }
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
        @"isActive":             @(self.isActive),
        @"playerPlaying":        @(self.audioPlayer.isPlaying),
        @"isMuted":              @(self.isMuted),
        @"currentTrackIndex":    @(self.currentTrackIndex),
        @"currentTrackName":     self.trackNames[self.currentTrackIndex],
        @"availableTracks":      self.trackNames,
        @"uptimeSeconds":        @(uptime),
        @"backgroundDuration":   @(bgElapsed),
        @"disconnectCount":      @(self.disconnectCount),
        @"lastDisconnectReason": self.lastDisconnectReason ?: @"none",
        @"iosVersion":           self.iosVersion ?: @"unknown",
        @"deviceModel":          self.deviceModel ?: @"unknown",
        @"currentOutput":        [self currentAudioOutputDescription]
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

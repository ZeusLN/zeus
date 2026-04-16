#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

/**
 * NWCAudioKeepAlive
 *
 * Experimental iOS module that uses AVAudioSession (.playback category) and a
 * looping silent AVAudioEngine buffer to keep the app alive in the background,
 * enabling persistent WebSocket (Nostr relay / NWC) connections.
 *
 * NOTE: This technique is for experimentation only and may be rejected by App
 * Store review if the audio session is deemed non-functional.
 *
 * Emitted events (listen via NativeEventEmitter):
 *   - NWCAudioInterrupted       Audio session was interrupted (e.g. phone call)
 *   - NWCAudioInterruptionEnded Audio interruption ended; session will resume
 *   - NWCAudioRouteChanged      Audio output route changed
 *   - NWCAudioStatusUpdate      Periodic heartbeat with uptime/background stats
 *   - NWCAudioSuspended         App appears to be suspended despite audio session
 */
@interface NWCAudioKeepAlive : RCTEventEmitter <RCTBridgeModule>

@end

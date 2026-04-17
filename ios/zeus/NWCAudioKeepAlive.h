#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

/**
 * NWCAudioKeepAlive
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

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

/**
 * NWCAudioKeepAlive
 *
 * Keeps the NWC relay connection alive in background by playing a looping
 * ambient audio track via AVAudioPlayer with AVAudioSessionCategoryPlayback.
 * The user can mute the audio; the session (and background entitlement) stays
 * active regardless of the volume level.
 *
 * Exported methods (all return Promises):
 *   startAudioKeepAlive()          → start session + begin playing current track
 *   stopAudioKeepAlive()           → stop playback + deactivate session
 *   getStatus()                    → current status dict (no side-effects)
 *   getAvailableTracks()           → [{index, name, isSelected}, ...]
 *   setTrack(index)                → switch to track by index (live or deferred)
 *   nextTrack()                    → advance to next track (wraps)
 *   previousTrack()                → go back to previous track (wraps)
 *   setMuted(muted)                → mute/unmute volume (session stays alive)
 *
 * Emitted events (listen via NativeEventEmitter):
 *   NWCAudioInterrupted            Audio session interrupted (e.g. phone call)
 *   NWCAudioInterruptionEnded      Interruption ended; session will resume
 *   NWCAudioRouteChanged           Audio output route changed
 *   NWCAudioStatusUpdate           Periodic heartbeat with uptime/background stats
 *   NWCAudioSuspended              App appears suspended despite active session
 *   NWCAudioTrackChanged           Track was switched; payload: {trackIndex, trackName}
 */
@interface NWCAudioKeepAlive : RCTEventEmitter <RCTBridgeModule>

@end

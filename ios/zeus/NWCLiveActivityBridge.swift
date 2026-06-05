import Foundation

/// ObjC bridge for NWC app-group display state (shared with widget / Live Activity intents).
@objc final class NWCLiveActivityBridge: NSObject {

    @objc static func appGroupTrackIndex() -> Int {
        NWCLiveActivityShared.readDisplay().trackIndex
    }

    @objc static func appGroupIsMuted() -> Bool {
        NWCLiveActivityShared.readDisplay().isMuted
    }

    @objc static func syncAppGroupFromAudio(trackIndex: Int, isMuted: Bool) {
        let (_, _, revision) = NWCLiveActivityShared.readDisplay()
        NWCLiveActivityShared.writeDisplay(
            trackIndex: trackIndex,
            isMuted: isMuted,
            revision: revision
        )
    }

    /// Returns the persisted preferred track index, or `fallback` if unset.
    /// Distinct from the display-state track index so the Live Activity
    /// refresh timer doesn't surface the preference while a different track
    /// is actually playing.
    @objc(preferredTrackIndexWithFallback:)
    static func preferredTrackIndex(fallback: Int) -> Int {
        NWCLiveActivityShared.readPreferredTrackIndex() ?? fallback
    }

    @objc(setPreferredTrackIndex:)
    static func setPreferredTrackIndex(_ index: Int) {
        NWCLiveActivityShared.writePreferredTrackIndex(index)
    }
}

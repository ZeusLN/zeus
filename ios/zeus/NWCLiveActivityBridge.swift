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
}

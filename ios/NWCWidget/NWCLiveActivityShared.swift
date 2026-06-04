import ActivityKit
import Foundation

/// Shared Live Activity display state (app group). Used by the main app and Live Activity intents.
enum NWCLiveActivityShared {
    static let appGroupID = "group.com.zeusln.zeus"
    static var tracks: [String] { NWCAmbientTracks.trackNames() }

    private static let keyTrackIndex = "nwc.trackIndex"
    private static let keyIsMuted = "nwc.isMuted"
    private static let keyRevision = "nwc.contentRevision"
    private static let keyActivityId = "nwc.activityId"

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroupID)
    }

    static func trackName(at index: Int) -> String {
        let count = tracks.count
        guard count > 0 else { return "" }
        return tracks[((index % count) + count) % count]
    }

    static func readDisplay() -> (trackIndex: Int, isMuted: Bool, revision: UInt) {
        let d = defaults
        let index = d?.integer(forKey: keyTrackIndex) ?? 0
        let muted = d?.bool(forKey: keyIsMuted) ?? false
        let revision = UInt(max(0, d?.integer(forKey: keyRevision) ?? 0))
        return (index, muted, revision)
    }

    static func writeDisplay(trackIndex: Int, isMuted: Bool, revision: UInt) {
        let d = defaults
        d?.set(trackIndex, forKey: keyTrackIndex)
        d?.set(isMuted, forKey: keyIsMuted)
        d?.set(Int(revision), forKey: keyRevision)
    }

    static func setPreferredActivityId(_ id: String?) {
        let d = defaults
        if let id {
            d?.set(id, forKey: keyActivityId)
        } else {
            d?.removeObject(forKey: keyActivityId)
        }
    }

    @available(iOS 16.1, *)
    static func resolveLiveActivity() -> Activity<NWCLiveActivityAttributes>? {
        let live = Activity<NWCLiveActivityAttributes>.activities.filter(isLive)
        guard !live.isEmpty else { return nil }
        if let preferred = defaults?.string(forKey: keyActivityId),
           let match = live.first(where: { $0.id == preferred }) {
            return match
        }
        if live.count > 1 {
            NSLog("[NWCLiveActivityShared] %d live activities; using newest by startedAt", live.count)
        }
        return live.max(by: { $0.attributes.startedAt < $1.attributes.startedAt })
    }

    /// Ends duplicate live activities, keeping at most one (by `keepingId`, or none if nil).
    @available(iOS 16.1, *)
    static func endDuplicateActivities(keepingId: String?) async {
        let finalState = NWCLiveActivityAttributes.ContentState(
            currentTrackName: nil,
            isMuted: false,
            contentRevision: 0
        )
        for act in Activity<NWCLiveActivityAttributes>.activities {
            guard isLive(act) else { continue }
            if let keepingId, act.id == keepingId { continue }
            if #available(iOS 16.2, *) {
                let content = ActivityContent(state: finalState, staleDate: Date())
                await act.end(content, dismissalPolicy: .immediate)
            } else {
                await act.end(using: finalState, dismissalPolicy: .immediate)
            }
        }
        if keepingId == nil {
            setPreferredActivityId(nil)
        }
    }

    @available(iOS 16.1, *)
    private static func isLive(_ act: Activity<NWCLiveActivityAttributes>) -> Bool {
        if act.activityState == .ended { return false }
        if #available(iOS 16.2, *) {
            if act.activityState == .dismissed { return false }
        }
        return true
    }

    /// Push display state to ActivityKit. Call from Live Activity intents (host process) for immediate island refresh.
    @available(iOS 16.2, *)
    static func pushLiveActivity(
        trackIndex: Int,
        isMuted: Bool,
        bumpRevision: Bool = true
    ) async {
        guard let act = resolveLiveActivity() else {
            NSLog("[NWCLiveActivityShared] push skipped – no activity")
            return
        }

        var revision = readDisplay().revision
        if bumpRevision { revision &+= 1 }
        writeDisplay(trackIndex: trackIndex, isMuted: isMuted, revision: revision)

        let state = NWCLiveActivityAttributes.ContentState(
            currentTrackName: trackName(at: trackIndex),
            isMuted: isMuted,
            contentRevision: revision
        )
        let content = ActivityContent(
            state: state,
            staleDate: Date().addingTimeInterval(3600)
        )
        await act.update(content)
        NSLog("[NWCLiveActivityShared] pushed – track=%@ muted=%d rev=%u",
              trackName(at: trackIndex), isMuted ? 1 : 0, revision)
    }

    @available(iOS 16.2, *)
    static func applyNextTrack() async {
        var (index, muted, _) = readDisplay()
        index = (index + 1) % max(tracks.count, 1)
        await pushLiveActivity(trackIndex: index, isMuted: muted)
    }

    @available(iOS 16.2, *)
    static func applyPrevTrack() async {
        var (index, muted, _) = readDisplay()
        let count = max(tracks.count, 1)
        index = (index - 1 + count) % count
        await pushLiveActivity(trackIndex: index, isMuted: muted)
    }

    @available(iOS 16.2, *)
    static func applyToggleMute() async {
        let (index, muted, _) = readDisplay()
        await pushLiveActivity(trackIndex: index, isMuted: !muted)
    }
}

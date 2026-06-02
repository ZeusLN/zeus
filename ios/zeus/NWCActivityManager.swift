import Foundation
import ActivityKit

/// Manages the NWC Live Activity (Dynamic Island + lock-screen banner).
@available(iOS 16.1, *)
@objc final class NWCActivityManager: NSObject {

    @objc static let shared = NWCActivityManager()

    // Callbacks wired by NWCAudioKeepAlive.m so widget button taps reach the audio engine.
    @objc var onNextTrack:  (() -> Void)?
    @objc var onPrevTrack:  (() -> Void)?
    @objc var onToggleMute: (() -> Void)?
    @objc var onStop:       (() -> Void)?

    // Only adopt an existing activity that is still live (not ended/dismissed).
    // Orphaned activities from previous crashes are ended in init().
    private var activity: Activity<NWCLiveActivityAttributes>?

    override private init() {
        super.init()
        NWCBridge = NWCWidgetBridgeImpl(manager: self)
        cleanupOrphanedActivities()
    }

    // ─── ObjC entry points ────────────────────────────────────────────────────

    @objc func startActivity(trackName: String, isMuted: Bool) {
        DispatchQueue.main.async { [weak self] in
            self?.startActivityOnMain(trackName: trackName, isMuted: isMuted)
        }
    }

    @objc func updateActivity(trackName: String?, isMuted: Bool) {
        DispatchQueue.main.async { [weak self] in
            self?.updateActivityOnMain(trackName: trackName, isMuted: isMuted)
        }
    }

    @objc func stopActivity() {
        DispatchQueue.main.async { [weak self] in
            self?.stopActivityOnMain()
        }
    }

    // ─── Main-queue implementation ────────────────────────────────────────────

    // 5-minute rolling staleDate – safety net if the app is killed mid-session.
    private var staleDate: Date { Date().addingTimeInterval(300) }

    private func startActivityOnMain(trackName: String, isMuted: Bool) {
        let auth = ActivityAuthorizationInfo()
        guard auth.areActivitiesEnabled else {
            NSLog("[NWCActivity] Live Activities disabled – go to Settings → ZEUS → Live Activities")
            return
        }

        // Re-use any existing live activity (active OR stale — both accept updates).
        if let existing = activity, isLive(existing) {
            NSLog("[NWCActivity] activity already active, updating instead")
            updateActivityOnMain(trackName: trackName, isMuted: isMuted)
            return
        }

        let attrs = NWCLiveActivityAttributes(startedAt: .now)
        let state = NWCLiveActivityAttributes.ContentState(
            currentTrackName: trackName,
            isMuted: isMuted
        )

        do {
            if #available(iOS 16.2, *) {
                let content = ActivityContent(state: state, staleDate: staleDate)
                activity = try Activity.request(attributes: attrs, content: content, pushType: .none)
            } else {
                activity = try Activity.request(attributes: attrs, contentState: state, pushType: .none)
            }
            NSLog("[NWCActivity] started – id=%@ track=%@", activity?.id ?? "?", trackName)
        } catch {
            NSLog("[NWCActivity] FAILED to start – %@ (%@)",
                  error.localizedDescription, String(describing: error))
        }
    }

    private func updateActivityOnMain(trackName: String?, isMuted: Bool) {
        guard let current = activity, isLive(current) else {
            NSLog("[NWCActivity] update skipped – no live activity")
            return
        }
        let state = NWCLiveActivityAttributes.ContentState(
            currentTrackName: trackName,
            isMuted: isMuted
        )
        Task {
            if #available(iOS 16.2, *) {
                // Rolling the staleDate forward keeps the activity alive during a long session.
                let content = ActivityContent(state: state, staleDate: staleDate)
                await current.update(content)
            } else {
                await current.update(using: state)
            }
            NSLog("[NWCActivity] updated – track=%@ muted=%d",
                  trackName ?? "nil", isMuted ? 1 : 0)
        }
    }

    private func stopActivityOnMain() {
        guard let current = activity else { return }
        activity = nil
        let finalState = NWCLiveActivityAttributes.ContentState(
            currentTrackName: nil,
            isMuted: false
        )
        Task {
            if #available(iOS 16.2, *) {
                let content = ActivityContent(state: finalState, staleDate: Date())
                await current.end(content, dismissalPolicy: .immediate)
            } else {
                await current.end(using: finalState, dismissalPolicy: .immediate)
            }
            NSLog("[NWCActivity] ended")
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /// True when the activity can still be updated (active or stale but not ended/dismissed).
    private func isLive(_ act: Activity<NWCLiveActivityAttributes>) -> Bool {
        if act.activityState == .ended { return false }
        if #available(iOS 16.2, *) {
            if act.activityState == .dismissed { return false }
        }
        return true
    }

    /// End any activities left over from a previous session (e.g. a crash that
    /// prevented the normal stopActivity() call from completing).
    private func cleanupOrphanedActivities() {
        let orphans = Activity<NWCLiveActivityAttributes>.activities
        guard !orphans.isEmpty else { return }
        NSLog("[NWCActivity] cleaning up %d orphaned activit(y|ies)", orphans.count)
        Task {
            for orphan in orphans {
                if #available(iOS 16.2, *) {
                    let content = ActivityContent(
                        state: NWCLiveActivityAttributes.ContentState(
                            currentTrackName: nil, isMuted: false),
                        staleDate: Date()
                    )
                    await orphan.end(content, dismissalPolicy: .immediate)
                } else {
                    await orphan.end(using: nil, dismissalPolicy: .immediate)
                }
            }
        }
    }
}

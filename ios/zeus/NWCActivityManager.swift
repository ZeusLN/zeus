import Foundation
import ActivityKit

/// Manages the NWC Live Activity (Dynamic Island + lock-screen banner).
@available(iOS 16.1, *)
@objc final class NWCActivityManager: NSObject {

    @objc static let shared = NWCActivityManager()

    @objc var onNextTrack:  (() -> Void)?
    @objc var onPrevTrack:  (() -> Void)?
    @objc var onToggleMute: (() -> Void)?
    @objc var onStop:       (() -> Void)?

    private var activity: Activity<NWCLiveActivityAttributes>?

    override private init() {
        super.init()
        NWCBridge = NWCWidgetBridgeImpl(manager: self)
        // Synchronous cleanup so a force-quit island is gone on next cold start.
        endAllActivitiesBlocking()
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

    /// Normal stop (async). Ends every NWC activity, not only the cached reference.
    @objc func stopActivity() {
        DispatchQueue.main.async { [weak self] in
            self?.stopActivityOnMain()
        }
    }

    /// Ends all NWC Live Activities and blocks until ActivityKit completes.
    /// Required on force-quit: async `stopActivity` often never runs before iOS kills the process.
    @objc func endAllActivitiesImmediately() {
        endAllActivitiesBlocking()
    }

    // ─── Main-queue implementation ────────────────────────────────────────────

    private var staleDate: Date { Date().addingTimeInterval(300) }

    private func startActivityOnMain(trackName: String, isMuted: Bool) {
        let auth = ActivityAuthorizationInfo()
        guard auth.areActivitiesEnabled else {
            NSLog("[NWCActivity] Live Activities disabled – Settings → ZEUS → Live Activities")
            return
        }

        if let existing = activity, Self.isLive(existing) {
            NSLog("[NWCActivity] activity already live, updating instead")
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
        guard let current = activity, Self.isLive(current) else {
            NSLog("[NWCActivity] update skipped – no live activity")
            return
        }
        let state = NWCLiveActivityAttributes.ContentState(
            currentTrackName: trackName,
            isMuted: isMuted
        )
        Task {
            if #available(iOS 16.2, *) {
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
        activity = nil
        Task {
            await Self.endEveryNWCLiveActivity()
            NSLog("[NWCActivity] ended (async)")
        }
    }

    // ─── Blocking end (force-quit + cold-start cleanup) ───────────────────────

    private func endAllActivitiesBlocking() {
        let sem = DispatchSemaphore(value: 0)
        Task.detached(priority: .userInitiated) {
            await Self.endEveryNWCLiveActivity()
            await MainActor.run { [weak self] in
                self?.activity = nil
            }
            sem.signal()
        }
        _ = sem.wait(timeout: .now() + 5)
    }

    private static func endEveryNWCLiveActivity() async {
        let finalState = NWCLiveActivityAttributes.ContentState(
            currentTrackName: nil,
            isMuted: false
        )
        for act in Activity<NWCLiveActivityAttributes>.activities {
            guard isLive(act) else { continue }
            if #available(iOS 16.2, *) {
                let content = ActivityContent(state: finalState, staleDate: Date())
                await act.end(content, dismissalPolicy: .immediate)
            } else {
                await act.end(using: finalState, dismissalPolicy: .immediate)
            }
            NSLog("[NWCActivity] ended activity id=%@", act.id)
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static func isLive(_ act: Activity<NWCLiveActivityAttributes>) -> Bool {
        if act.activityState == .ended { return false }
        if #available(iOS 16.2, *) {
            if act.activityState == .dismissed { return false }
        }
        return true
    }
}

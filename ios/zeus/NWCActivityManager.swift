import Foundation
import ActivityKit
import UIKit

@available(iOS 16.1, *)
@objc final class NWCActivityManager: NSObject {

    @objc static let shared = NWCActivityManager()

    private var activity: Activity<NWCLiveActivityAttributes>?
    private var refreshTimer: DispatchSourceTimer?

    override private init() {
        super.init()
        scheduleStaleActivityCleanupOnLaunch()
    }

    @objc func startActivity(trackName: String, isMuted: Bool) {
        runOnMain { [weak self] in
            self?.startActivityOnMain(trackName: trackName, isMuted: isMuted)
        }
    }

    @objc func updateActivity(trackName: String?, isMuted: Bool) {
        runOnMain { [weak self] in
            self?.updateActivityOnMain(trackName: trackName, isMuted: isMuted)
        }
    }

    @objc func stopActivity() {
        runOnMain { [weak self] in
            self?.stopActivityOnMain()
        }
    }

    @objc func endAllActivitiesImmediately() {
        stopRefreshTimer()
        activity = nil
        Task.detached(priority: .userInitiated) {
            await Self.endEveryNWCLiveActivity()
            NSLog("[NWCActivity] ended all (immediate)")
        }
    }

    // MARK: - Private

    private var staleDate: Date { Date().addingTimeInterval(30) }

    private func runOnMain(_ block: @escaping () -> Void) {
        if Thread.isMainThread {
            block()
        } else {
            DispatchQueue.main.async(execute: block)
        }
    }

    private func trackIndex(for name: String?) -> Int {
        guard let name, !name.isEmpty else { return 0 }
        if let idx = NWCLiveActivityShared.tracks.firstIndex(of: name) {
            return idx
        }
        return 0
    }

    private func resolveLiveActivity() -> Activity<NWCLiveActivityAttributes>? {
        if let cached = activity, Self.isLive(cached) {
            return cached
        }
        if #available(iOS 16.1, *) {
            if let found = NWCLiveActivityShared.resolveLiveActivity() {
                activity = found
                return found
            }
        }
        activity = nil
        return nil
    }

    private func pushState(trackIndex: Int, isMuted: Bool, label: String) {
        let (_, _, revision) = NWCLiveActivityShared.readDisplay()
        let newRevision = revision &+ 1
        NWCLiveActivityShared.writeDisplay(
            trackIndex: trackIndex,
            isMuted: isMuted,
            revision: newRevision
        )

        guard let current = resolveLiveActivity() else {
            NSLog("[NWCActivity] %@ skipped – no live activity", label)
            return
        }

        let trackName = NWCLiveActivityShared.trackName(at: trackIndex)
        let state = NWCLiveActivityAttributes.ContentState(
            currentTrackName: trackName,
            isMuted: isMuted,
            contentRevision: newRevision
        )

        var bgTask: UIBackgroundTaskIdentifier = .invalid
        bgTask = UIApplication.shared.beginBackgroundTask(withName: "NWCActivityUpdate") {
            if bgTask != .invalid {
                UIApplication.shared.endBackgroundTask(bgTask)
                bgTask = .invalid
            }
        }

        Task { @MainActor(priority: .userInitiated) in
            if #available(iOS 16.2, *) {
                let content = ActivityContent(state: state, staleDate: self.staleDate)
                await current.update(content)
            } else {
                await current.update(using: state)
            }
            NSLog("[NWCActivity] %@ – track=%@ muted=%d rev=%u",
                  label, trackName, isMuted ? 1 : 0, newRevision)
            if bgTask != .invalid {
                UIApplication.shared.endBackgroundTask(bgTask)
            }
        }
    }

    private func startActivityOnMain(trackName: String, isMuted: Bool) {
        let auth = ActivityAuthorizationInfo()
        guard auth.areActivitiesEnabled else {
            NSLog("[NWCActivity] Live Activities disabled – Settings → ZEUS → Live Activities")
            return
        }

        let trackIndex = trackIndex(for: trackName)
        NWCLiveActivityShared.writeDisplay(trackIndex: trackIndex, isMuted: isMuted, revision: 0)

        Task { @MainActor [weak self] in
            guard let self else { return }

            if let existing = NWCLiveActivityShared.resolveLiveActivity() {
                await NWCLiveActivityShared.endDuplicateActivities(keepingId: existing.id)
                self.activity = existing
                NWCLiveActivityShared.setPreferredActivityId(existing.id)
                self.pushState(trackIndex: trackIndex, isMuted: isMuted, label: "rebind-update")
                self.startRefreshTimer()
                return
            }

            await NWCLiveActivityShared.endDuplicateActivities(keepingId: nil)

            let attrs = NWCLiveActivityAttributes(startedAt: .now)
            let state = NWCLiveActivityAttributes.ContentState(
                currentTrackName: trackName,
                isMuted: isMuted,
                contentRevision: 0
            )

            do {
                if #available(iOS 16.2, *) {
                    let content = ActivityContent(state: state, staleDate: self.staleDate)
                    self.activity = try Activity.request(attributes: attrs, content: content, pushType: .none)
                } else {
                    self.activity = try Activity.request(attributes: attrs, contentState: state, pushType: .none)
                }
                if let id = self.activity?.id {
                    NWCLiveActivityShared.setPreferredActivityId(id)
                }
                NSLog("[NWCActivity] started – id=%@ track=%@", self.activity?.id ?? "?", trackName)
                self.startRefreshTimer()
            } catch {
                NSLog("[NWCActivity] FAILED to start – %@ (%@)",
                      error.localizedDescription, String(describing: error))
            }
        }
    }

    private func updateActivityOnMain(trackName: String?, isMuted: Bool) {
        pushState(trackIndex: trackIndex(for: trackName), isMuted: isMuted, label: "updated")
    }

    private func stopActivityOnMain() {
        stopRefreshTimer()
        activity = nil
        Task {
            await NWCLiveActivityShared.endDuplicateActivities(keepingId: nil)
            NSLog("[NWCActivity] ended (async)")
        }
    }

    private func startRefreshTimer() {
        stopRefreshTimer()
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now() + 10, repeating: 10)
        timer.setEventHandler { [weak self] in
            guard let self else { return }
            guard self.resolveLiveActivity() != nil else { return }
            let (index, muted, _) = NWCLiveActivityShared.readDisplay()
            self.pushState(trackIndex: index, isMuted: muted, label: "refresh")
        }
        timer.resume()
        refreshTimer = timer
    }

    private func stopRefreshTimer() {
        refreshTimer?.cancel()
        refreshTimer = nil
    }

    private func scheduleStaleActivityCleanupOnLaunch() {
        Task.detached(priority: .utility) {
            await NWCLiveActivityShared.endDuplicateActivities(keepingId: nil)
            await MainActor.run { [weak self] in
                self?.activity = nil
            }
            NSLog("[NWCActivity] launch cleanup finished")
        }
    }

    private static func endEveryNWCLiveActivity() async {
        await NWCLiveActivityShared.endDuplicateActivities(keepingId: nil)
    }

    private static func isLive(_ act: Activity<NWCLiveActivityAttributes>) -> Bool {
        if act.activityState == .ended { return false }
        if #available(iOS 16.2, *) {
            if act.activityState == .dismissed { return false }
        }
        return true
    }
}

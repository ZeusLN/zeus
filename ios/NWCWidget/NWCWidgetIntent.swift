import AppIntents
import ActivityKit

// Must match NWCAudioKeepAlive.m
private let kNWCNextTrack  = "com.zeusln.zeus.nwc.nextTrack"
private let kNWCPrevTrack  = "com.zeusln.zeus.nwc.prevTrack"
private let kNWCToggleMute = "com.zeusln.zeus.nwc.toggleMute"
private let kNWCStop       = "com.zeusln.zeus.nwc.stop"

private func postDarwin(_ name: String) {
    CFNotificationCenterPostNotification(
        CFNotificationCenterGetDarwinNotifyCenter(),
        CFNotificationName(name as CFString),
        nil, nil, true
    )
}

@available(iOS 17.0, *)
struct NWCNextTrackIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Next Track"
    func perform() async throws -> some IntentResult {
        if #available(iOS 16.2, *) {
            await NWCLiveActivityShared.applyNextTrack()
        }
        postDarwin(kNWCNextTrack)
        return .result()
    }
}

@available(iOS 17.0, *)
struct NWCPrevTrackIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Previous Track"
    func perform() async throws -> some IntentResult {
        if #available(iOS 16.2, *) {
            await NWCLiveActivityShared.applyPrevTrack()
        }
        postDarwin(kNWCPrevTrack)
        return .result()
    }
}

@available(iOS 17.0, *)
struct NWCToggleMuteIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Toggle Mute"
    func perform() async throws -> some IntentResult {
        if #available(iOS 16.2, *) {
            await NWCLiveActivityShared.applyToggleMute()
        }
        postDarwin(kNWCToggleMute)
        return .result()
    }
}

@available(iOS 17.0, *)
struct NWCStopIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Stop NWC"
    func perform() async throws -> some IntentResult {
        postDarwin(kNWCStop)
        return .result()
    }
}

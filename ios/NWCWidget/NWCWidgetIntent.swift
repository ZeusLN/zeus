import AppIntents
import WidgetKit

// Darwin notification names – must match NWCAudioKeepAlive.m exactly.
// CFNotificationCenter is the correct IPC mechanism for widget extension → host app
// because LiveActivityIntent.perform() runs in the extension process, not the main app.
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

struct NWCNextTrackIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Next Track"
    func perform() async throws -> some IntentResult {
        postDarwin(kNWCNextTrack)
        return .result()
    }
}

struct NWCPrevTrackIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Previous Track"
    func perform() async throws -> some IntentResult {
        postDarwin(kNWCPrevTrack)
        return .result()
    }
}

struct NWCToggleMuteIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Toggle Mute"
    func perform() async throws -> some IntentResult {
        postDarwin(kNWCToggleMute)
        return .result()
    }
}

struct NWCStopIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Stop NWC"
    func perform() async throws -> some IntentResult {
        postDarwin(kNWCStop)
        return .result()
    }
}

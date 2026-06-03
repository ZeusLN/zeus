import Foundation
import ActivityKit

@available(iOS 16.1, *)
struct NWCLiveActivityAttributes: ActivityAttributes {

    struct ContentState: Codable, Hashable {
        var currentTrackName: String?
        var isMuted: Bool
    }

    var startedAt: Date
}

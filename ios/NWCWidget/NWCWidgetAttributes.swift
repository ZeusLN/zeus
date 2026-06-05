import Foundation
import ActivityKit

@available(iOS 16.1, *)
struct NWCLiveActivityAttributes: ActivityAttributes {

    struct ContentState: Codable, Hashable {
        var currentTrackName: String?
        var isMuted: Bool
        /// Bumped on every push so the island re-renders after long background sessions.
        var contentRevision: UInt
    }

    var startedAt: Date
}

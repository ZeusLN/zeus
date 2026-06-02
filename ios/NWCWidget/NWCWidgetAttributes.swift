import Foundation
import ActivityKit

// Shared between NWCWidget extension and the main zeus app target.
// Both targets compile this file; ActivityKit matches activities by type name.

@available(iOS 16.1, *)
struct NWCLiveActivityAttributes: ActivityAttributes {

    struct ContentState: Codable, Hashable {
        /// Currently playing track name, or nil when audio is stopped.
        var currentTrackName: String?
        /// Whether the user has muted the audio (session stays alive).
        var isMuted: Bool
    }

    /// Fixed: when the NWC session started (drives the elapsed timer).
    var startedAt: Date
}

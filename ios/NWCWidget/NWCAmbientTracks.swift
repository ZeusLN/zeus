import Foundation

/// Single source of truth for bundled NWC ambient track display names.
@objc final class NWCAmbientTracks: NSObject {
    @objc static func trackNames() -> [String] {
        ["Fireplace", "White Noise", "Gentle Rain"]
    }
}

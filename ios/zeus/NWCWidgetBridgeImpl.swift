import Foundation

/// Real bridge implementation compiled into the main zeus app target only.
/// Routes Live Activity button taps back to NWCActivityManager's callback blocks
/// (which NWCAudioKeepAlive.m registers at session start).
@available(iOS 16.1, *)
final class NWCWidgetBridgeImpl: NWCWidgetBridgeProtocol {

    private weak var manager: NWCActivityManager?

    init(manager: NWCActivityManager) {
        self.manager = manager
    }

    func nextTrack() {
        DispatchQueue.main.async { [weak self] in
            self?.manager?.onNextTrack?()
        }
    }

    func prevTrack() {
        DispatchQueue.main.async { [weak self] in
            self?.manager?.onPrevTrack?()
        }
    }

    func toggleMute() {
        DispatchQueue.main.async { [weak self] in
            self?.manager?.onToggleMute?()
        }
    }

    func stopNWC() {
        DispatchQueue.main.async { [weak self] in
            self?.manager?.onStop?()
        }
    }
}

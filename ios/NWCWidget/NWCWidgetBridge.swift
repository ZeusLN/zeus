import Foundation

// Compiled into BOTH the NWCWidget extension AND the main zeus app target.
//
// In the widget extension process the NoOp implementation is used.
// In the main app process NWCActivityManager.init() immediately swaps
// NWCBridge to the real NWCWidgetBridgeImpl, so Live Activity button taps
// (which run inside the host-app process via LiveActivityIntent) are routed
// back to the running audio session.

protocol NWCWidgetBridgeProtocol {
    func nextTrack()
    func prevTrack()
    func toggleMute()
    func stopNWC()
}

/// Global. NoOp by default; replaced by NWCWidgetBridgeImpl in the main app.
var NWCBridge: NWCWidgetBridgeProtocol = NWCWidgetBridgeNoOp()

final class NWCWidgetBridgeNoOp: NWCWidgetBridgeProtocol {
    func nextTrack()  {}
    func prevTrack()  {}
    func toggleMute() {}
    func stopNWC()    {}
}

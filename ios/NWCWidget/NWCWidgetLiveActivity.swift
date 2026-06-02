import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

// ─── Zeus icon (widget asset catalog: zeusLogo @1x/@2x/@3x) ─────────────────
// Uses the same layout as Primal's dynamicIslandLogo — explicit frame + fit.
// Asset is built from zeus_icon.jpg (opaque), not the 1024 App Store icon.

private struct ZeusIcon: View {
    var size: CGFloat = 20

    var body: some View {
        Image(.zeusLogo)
            .resizable()
            .renderingMode(.original)
            .aspectRatio(contentMode: .fit)
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
    }
}

// ─── Circle button style ──────────────────────────────────────────────────────

private struct CircleButtonStyle: ButtonStyle {
    var size: CGFloat = 38
    var tint: Color = Color.white.opacity(0.14)

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(width: size, height: size)
            .background(Circle().fill(tint.opacity(configuration.isPressed ? 0.5 : 1)))
            .scaleEffect(configuration.isPressed ? 0.90 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

// ─── Expanded / lock-screen content ──────────────────────────────────────────

private struct NWCExpandedView: View {
    let context: ActivityViewContext<NWCLiveActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {

            // Row 1 – header
            HStack(spacing: 10) {
                ZeusIcon(size: 28)

                Text("Active: NWC")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)

                Spacer()

                Text(context.attributes.startedAt, style: .timer)
                    .font(.system(size: 15, weight: .medium).monospacedDigit())
                    .foregroundStyle(.white.opacity(0.55))
                    .monospacedDigit()
            }

            // Row 2 – track name
            let muted = context.state.isMuted
            if let track = context.state.currentTrackName {
                Text(muted ? "Muted · \(track)" : "Now playing: \(track)")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.5))
                    .lineLimit(1)
            }

            // Row 3 – controls (all buttons same size)
            HStack(spacing: 0) {
                Button(intent: NWCPrevTrackIntent()) {
                    Image(systemName: "backward.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.85))
                }
                .buttonStyle(CircleButtonStyle())

                Spacer()

                Button(intent: NWCToggleMuteIntent()) {
                    Image(systemName: muted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(muted ? Color.orange : .white.opacity(0.85))
                        .contentTransition(.symbolEffect(.replace))
                }
                .buttonStyle(CircleButtonStyle(
                    tint: muted ? Color.orange.opacity(0.25) : Color.white.opacity(0.14)
                ))

                Spacer()

                Button(intent: NWCNextTrackIntent()) {
                    Image(systemName: "forward.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.85))
                }
                .buttonStyle(CircleButtonStyle())

                Spacer()

                Button(intent: NWCStopIntent()) {
                    Text("End Session")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.red)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(
                            Capsule()
                                .fill(Color.red.opacity(0.15))
                                .overlay(Capsule().strokeBorder(Color.red.opacity(0.4), lineWidth: 0.5))
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// ─── Widget ───────────────────────────────────────────────────────────────────

struct NWCWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: NWCLiveActivityAttributes.self) { context in
            // Lock-screen / notification-banner
            NWCExpandedView(context: context)
                .padding(.horizontal, 20)
                .padding(.vertical, 14)
                .background(Color.black)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.bottom) {
                    NWCExpandedView(context: context)
                        .padding(.horizontal, 8)
                        .padding(.bottom, 6)
                }
            } compactLeading: {
                ZeusIcon(size: 20)
            } compactTrailing: {
                Button(intent: NWCToggleMuteIntent()) {
                    Image(systemName: context.state.isMuted
                          ? "speaker.slash.fill"
                          : "speaker.wave.2.fill")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(context.state.isMuted ? .orange : .white)
                        .contentTransition(.symbolEffect(.replace))
                }
                .buttonStyle(.plain)
                .padding(.trailing, 2)
            } minimal: {
                ZeusIcon(size: 16)
            }
            .widgetURL(URL(string: "zeus://nwc"))
            .keylineTint(Color(red: 1, green: 0.82, blue: 0))
        }
    }
}

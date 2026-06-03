import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

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

private struct NWCExpandedView: View {
    let context: ActivityViewContext<NWCLiveActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
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

            if let track = context.state.currentTrackName {
                Text(context.state.isMuted ? "Muted · \(track)" : "Now playing: \(track)")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.5))
                    .lineLimit(1)
            }

            HStack(spacing: 0) {
                Button(intent: NWCPrevTrackIntent()) {
                    Image(systemName: "backward.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.85))
                }
                .buttonStyle(CircleButtonStyle())

                Spacer()

                Button(intent: NWCToggleMuteIntent()) {
                    Image(systemName: context.state.isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(context.state.isMuted ? Color.orange : .white.opacity(0.85))
                }
                .buttonStyle(CircleButtonStyle(
                    tint: context.state.isMuted ? Color.orange.opacity(0.25) : Color.white.opacity(0.14)
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

struct NWCWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: NWCLiveActivityAttributes.self) { context in
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
                }
                .buttonStyle(.plain)
                .padding(.trailing, 2)
            } minimal: {
                ZeusIcon(size: 16)
            }
            .keylineTint(Color(red: 1, green: 0.82, blue: 0))
        }
    }
}

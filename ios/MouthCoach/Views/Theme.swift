import SwiftUI

// Colors match the web app (warm neutrals, dark green type, soft green and blue).
extension Color {
    static let mcCream = Color(red: 0.965, green: 0.945, blue: 0.910)
    static let mcInk = Color(red: 0.114, green: 0.231, blue: 0.173)
    static let mcInkSoft = Color(red: 0.247, green: 0.353, blue: 0.286)
    static let mcSage = Color(red: 0.247, green: 0.490, blue: 0.361)
    static let mcSageSoft = Color(red: 0.839, green: 0.918, blue: 0.859)
    static let mcSky = Color(red: 0.184, green: 0.400, blue: 0.565)
    static let mcSkySoft = Color(red: 0.847, green: 0.906, blue: 0.953)
    static let mcAmberSoft = Color(red: 0.969, green: 0.918, blue: 0.816)
    static let mcAmberInk = Color(red: 0.416, green: 0.290, blue: 0.071)
    static let mcRecord = Color(red: 0.706, green: 0.137, blue: 0.094)
}

/// Soft, colorful backdrop for the glass surfaces to refract.
struct BackdropView: View {
    var body: some View {
        ZStack {
            Color.mcCream
            RadialGradient(colors: [Color(red: 0.46, green: 0.75, blue: 0.57).opacity(0.7), .clear], center: .topLeading, startRadius: 0, endRadius: 420)
            RadialGradient(colors: [Color(red: 0.49, green: 0.69, blue: 0.89).opacity(0.7), .clear], center: .topTrailing, startRadius: 0, endRadius: 420)
            RadialGradient(colors: [Color(red: 0.96, green: 0.75, blue: 0.55).opacity(0.6), .clear], center: .bottomTrailing, startRadius: 0, endRadius: 460)
        }
        .ignoresSafeArea()
    }
}

/// Liquid Glass card on iOS 26, frosted material on earlier versions.
struct GlassCard: ViewModifier {
    var cornerRadius: CGFloat = 28
    var tint: Color?

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            content.glassEffect(tint.map { Glass.regular.tint($0.opacity(0.25)) } ?? .regular, in: shape)
        } else {
            fallback(content, shape)
        }
        #else
        fallback(content, shape)
        #endif
    }

    private func fallback(_ content: Content, _ shape: RoundedRectangle) -> some View {
        content
            .background(.ultraThinMaterial, in: shape)
            .overlay(shape.strokeBorder(.white.opacity(0.6), lineWidth: 1))
            .shadow(color: Color.mcInk.opacity(0.12), radius: 18, y: 10)
    }
}

extension View {
    func glassCard(cornerRadius: CGFloat = 28, tint: Color? = nil) -> some View {
        modifier(GlassCard(cornerRadius: cornerRadius, tint: tint))
    }

    /// Prominent (tinted) glass button on iOS 26, bordered prominent before.
    @ViewBuilder func primaryButton(tint: Color = .mcSage) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            self.buttonStyle(.glassProminent).tint(tint).controlSize(.large)
        } else {
            self.buttonStyle(.borderedProminent).tint(tint).controlSize(.large)
        }
        #else
        self.buttonStyle(.borderedProminent).tint(tint).controlSize(.large)
        #endif
    }

    /// Clear glass button on iOS 26, bordered before.
    @ViewBuilder func secondaryButton() -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            self.buttonStyle(.glass).tint(.mcInk).controlSize(.large)
        } else {
            self.buttonStyle(.bordered).tint(.mcInk).controlSize(.large)
        }
        #else
        self.buttonStyle(.bordered).tint(.mcInk).controlSize(.large)
        #endif
    }
}

struct Eyebrow: View {
    var text: String
    var body: some View {
        Text(text.uppercased())
            .font(.caption.weight(.bold))
            .tracking(1.4)
            .foregroundStyle(Color.mcInkSoft)
            .accessibilityAddTraits(.isHeader)
    }
}

struct Pill: View {
    var text: String
    var foreground: Color
    var background: Color
    var body: some View {
        Text(text)
            .font(.caption.weight(.bold))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .foregroundStyle(foreground)
            .background(background, in: Capsule())
    }
}

import SwiftUI

enum LipOverlayMode: String, CaseIterable {
    case yellow = "Yellow"
    case blue = "Blue"
    case both = "Both"

    var showsReference: Bool { self != .blue }
    var showsMeasured: Bool { self != .yellow }
}

/// The preview is mirrored; Vision coordinates are not. Match that transform
/// here so both outlines follow the lips seen by the learner.
struct LiveMouthOverlay: View {
    let lips: LiveLipGeometry?
    let params: MouthParams
    let mode: LipOverlayMode

    var body: some View {
        Canvas { context, size in
            let trackedLips = lips.flatMap { $0.width > 0.01 ? $0 : nil }
            let center = trackedLips.map { CGPoint(x: (1 - $0.center.x) * size.width, y: $0.center.y * size.height) }
                ?? CGPoint(x: size.width / 2, y: size.height * 0.67)
            let measuredWidth = trackedLips.map { $0.width * size.width } ?? min(size.width * 0.38, 150)
            if mode.showsMeasured, let lips = trackedLips {
                for points in [lips.outer, lips.inner] where points.count > 2 {
                    var path = Path()
                    for (index, point) in points.enumerated() {
                        let position = CGPoint(x: (1 - point.x) * size.width, y: point.y * size.height)
                        if index == 0 { path.move(to: position) } else { path.addLine(to: position) }
                    }
                    path.closeSubpath()
                    context.stroke(path, with: .color(Color(red: 0.22, green: 0.66, blue: 1)),
                                   style: StrokeStyle(lineWidth: 2.8, lineCap: .round, lineJoin: .round))
                }
            }
            if mode.showsReference {
                // Scale to the learner's measured lip width, then vary it by
                // the reference pose. The center stays attached to their lips.
                let half = measuredWidth * min(1.14, max(0.86, params.halfWidth / 72)) / 2
                let opening = measuredWidth * max(0.025, params.open / 125)
                let outer = opening / 2 + measuredWidth * 0.12
                var outline = Path()
                outline.move(to: CGPoint(x: center.x - half, y: center.y))
                outline.addCurve(to: CGPoint(x: center.x + half, y: center.y),
                                 control1: CGPoint(x: center.x - half * 0.52, y: center.y - outer),
                                 control2: CGPoint(x: center.x + half * 0.52, y: center.y - outer))
                outline.addCurve(to: CGPoint(x: center.x - half, y: center.y),
                                 control1: CGPoint(x: center.x + half * 0.52, y: center.y + outer),
                                 control2: CGPoint(x: center.x - half * 0.52, y: center.y + outer))
                var openingPath = Path()
                openingPath.move(to: CGPoint(x: center.x - half * 0.86, y: center.y))
                openingPath.addCurve(to: CGPoint(x: center.x + half * 0.86, y: center.y),
                                     control1: CGPoint(x: center.x - half * 0.45, y: center.y - opening * 0.58),
                                     control2: CGPoint(x: center.x + half * 0.45, y: center.y - opening * 0.58))
                openingPath.addCurve(to: CGPoint(x: center.x - half * 0.86, y: center.y),
                                     control1: CGPoint(x: center.x + half * 0.45, y: center.y + opening * 0.58),
                                     control2: CGPoint(x: center.x - half * 0.45, y: center.y + opening * 0.58))
                let style = StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round)
                let yellow = Color(red: 0.90, green: 0.96, blue: 0.35)
                context.stroke(outline, with: .color(yellow), style: style)
                context.stroke(openingPath, with: .color(yellow), style: style)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

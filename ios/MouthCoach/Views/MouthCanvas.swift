import SwiftUI

/// Simplified front view of the lower face, drawn from `MouthParams`. The
/// interior is a plain dark area: the illustration never shows tongue position.
struct MouthCanvas: View {
    var params: MouthParams
    var correction: CorrectionGuide?
    var accessibilityText: String

    var body: some View {
        Canvas { context, size in
            let scale = size.width / 400
            context.scaleBy(x: scale, y: scale)
            let g = buildMouth(params)

            // Lower face
            context.fill(Path(ellipseIn: CGRect(x: 22, y: -118, width: 356, height: 428)),
                         with: .radialGradient(Gradient(colors: [Color(red: 0.96, green: 0.87, blue: 0.80), Color(red: 0.91, green: 0.79, blue: 0.69)]),
                                               center: CGPoint(x: 200, y: 110), startRadius: 0, endRadius: 260))
            var nose = Path()
            nose.move(to: CGPoint(x: 166, y: 58))
            nose.addQuadCurve(to: CGPoint(x: 200, y: 76), control: CGPoint(x: 182, y: 78))
            nose.addQuadCurve(to: CGPoint(x: 234, y: 58), control: CGPoint(x: 218, y: 78))
            context.stroke(nose, with: .color(Color(red: 0.83, green: 0.66, blue: 0.55)), style: StrokeStyle(lineWidth: 3, lineCap: .round))
            var chin = Path()
            chin.move(to: CGPoint(x: 150, y: 268))
            chin.addQuadCurve(to: CGPoint(x: 250, y: 268), control: CGPoint(x: 200, y: 290))
            context.stroke(chin, with: .color(Color(red: 0.83, green: 0.66, blue: 0.55).opacity(0.6)), style: StrokeStyle(lineWidth: 3, lineCap: .round))

            // Interior and lower teeth
            let interior = path(g.interior)
            context.fill(interior, with: .color(Color(red: 0.29, green: 0.12, blue: 0.15)))
            context.drawLayer { layer in
                layer.clip(to: interior)
                layer.fill(Path(roundedRect: cgRect(g.lowerTeeth), cornerRadius: 3), with: .color(Color(red: 0.96, green: 0.94, blue: 0.89)))
            }

            // Lips, then upper teeth over the lower lip so the /f/ contact is visible.
            context.fill(path(g.lowerLip), with: .color(Color(red: 0.78, green: 0.44, blue: 0.47)))
            context.fill(path(g.upperLip), with: .color(Color(red: 0.68, green: 0.35, blue: 0.39)))
            context.drawLayer { layer in
                layer.clip(to: path(g.upperTeethClip))
                layer.fill(Path(roundedRect: cgRect(g.upperTeeth), cornerRadius: 3), with: .color(Color(red: 1, green: 0.98, blue: 0.96)))
            }
            if params.open < 2 {
                context.stroke(path(g.lipLine), with: .color(Color(red: 0.49, green: 0.23, blue: 0.26)), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
            }

            if let correction { drawCorrection(correction, current: g, in: &context) }
        }
        .aspectRatio(4 / 3, contentMode: .fit)
        .accessibilityElement()
        .accessibilityLabel(accessibilityText)
        .accessibilityAddTraits(.isImage)
    }

    private func drawCorrection(_ guide: CorrectionGuide, current: MouthGeometry, in context: inout GraphicsContext) {
        let arrowColor = Color.mcSky
        let target = buildMouth(.shape(guide.targetShape))

        // Highlighted lip regions
        let highlight = GraphicsContext.Shading.color(arrowColor.opacity(0.18))
        let stroke = StrokeStyle(lineWidth: 2.5)
        switch guide.highlight {
        case .upperLip?, .bothLips?:
            context.fill(path(current.upperLip), with: highlight)
            context.stroke(path(current.upperLip), with: .color(arrowColor), style: stroke)
            if guide.highlight == .bothLips {
                context.fill(path(current.lowerLip), with: highlight)
                context.stroke(path(current.lowerLip), with: .color(arrowColor), style: stroke)
            }
        case .lowerLip?:
            context.fill(path(current.lowerLip), with: highlight)
            context.stroke(path(current.lowerLip), with: .color(arrowColor), style: stroke)
        case .corners?:
            for corner in [current.left, current.right] {
                let circle = Path(ellipseIn: CGRect(x: corner.x - 11, y: corner.y - 11, width: 22, height: 22))
                context.fill(circle, with: highlight)
                context.stroke(circle, with: .color(arrowColor), style: stroke)
            }
        case nil:
            break
        }

        // Dashed target outline
        context.stroke(path(target.outline), with: .color(Color.mcSage), style: StrokeStyle(lineWidth: 2.5, lineJoin: .round, dash: [7, 6]))

        // Directional arrows
        let cx = 200.0, cy = target.left.y
        for direction in guide.arrows ?? [] {
            let lines: [(CGPoint, CGPoint)]
            switch direction {
            case .close:
                lines = [(CGPoint(x: cx, y: target.outerTopY - 40), CGPoint(x: cx, y: target.outerTopY - 10)),
                         (CGPoint(x: cx, y: target.outerBottomY + 40), CGPoint(x: cx, y: target.outerBottomY + 10))]
            case .inward:
                lines = [(CGPoint(x: target.left.x - 52, y: cy), CGPoint(x: target.left.x - 12, y: cy)),
                         (CGPoint(x: target.right.x + 52, y: cy), CGPoint(x: target.right.x + 12, y: cy))]
            case .spread:
                lines = [(CGPoint(x: target.left.x - 8, y: cy), CGPoint(x: target.left.x - 46, y: cy)),
                         (CGPoint(x: target.right.x + 8, y: cy), CGPoint(x: target.right.x + 46, y: cy))]
            case .lowerLipUp:
                lines = [(CGPoint(x: cx, y: target.outerBottomY + 46), CGPoint(x: cx, y: target.outerBottomY + 12))]
            }
            for (from, to) in lines { drawArrow(from: from, to: to, color: arrowColor, in: &context) }
        }
    }

    private func drawArrow(from: CGPoint, to: CGPoint, color: Color, in context: inout GraphicsContext) {
        var line = Path()
        line.move(to: from)
        line.addLine(to: to)
        context.stroke(line, with: .color(color), style: StrokeStyle(lineWidth: 4, lineCap: .round))
        let angle = atan2(to.y - from.y, to.x - from.x)
        var head = Path()
        head.move(to: CGPoint(x: to.x + cos(angle) * 6, y: to.y + sin(angle) * 6))
        head.addLine(to: CGPoint(x: to.x + cos(angle + 2.5) * 10, y: to.y + sin(angle + 2.5) * 10))
        head.addLine(to: CGPoint(x: to.x + cos(angle - 2.5) * 10, y: to.y + sin(angle - 2.5) * 10))
        head.closeSubpath()
        context.fill(head, with: .color(color))
    }

    private func path(_ commands: [PathCommand]) -> Path {
        var path = Path()
        for command in commands {
            switch command {
            case .move(let p): path.move(to: cg(p))
            case .quad(let to, let control): path.addQuadCurve(to: cg(to), control: cg(control))
            case .cubic(let to, let c1, let c2): path.addCurve(to: cg(to), control1: cg(c1), control2: cg(c2))
            case .close: path.closeSubpath()
            }
        }
        return path
    }

    private func cg(_ p: Point) -> CGPoint { CGPoint(x: p.x, y: p.y) }
    private func cgRect(_ r: Rect) -> CGRect { CGRect(x: r.x, y: r.y, width: r.width, height: r.height) }
}

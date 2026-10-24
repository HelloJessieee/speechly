import Foundation

// Port of src/animation/shapes.ts. Geometry is produced as platform-neutral
// path commands in a 400 × 300 coordinate space; the SwiftUI layer turns them
// into `Path`s. Keeping this file Foundation-only lets it be unit tested anywhere.

struct Point: Hashable {
    var x: Double
    var y: Double
}

enum PathCommand: Hashable {
    case move(Point)
    case quad(to: Point, control: Point)
    case cubic(to: Point, c1: Point, c2: Point)
    case close
}

/// Numeric description of a visible mouth state. Interpolating between two
/// sets of parameters gives smooth transitions between shapes.
struct MouthParams: Hashable {
    var open: Double
    var halfWidth: Double
    var upperThickness: Double
    var lowerThickness: Double
    var upperTeeth: Double
    var lowerTeeth: Double
    var tuck: Double
    var round: Double

    static func shape(_ id: MouthShapeID) -> MouthParams {
        switch id {
        case .rest: return MouthParams(open: 3, halfWidth: 70, upperThickness: 15, lowerThickness: 19, upperTeeth: 0, lowerTeeth: 0, tuck: 0, round: 0.2)
        case .closed: return MouthParams(open: 0, halfWidth: 68, upperThickness: 14, lowerThickness: 17, upperTeeth: 0, lowerTeeth: 0, tuck: 0, round: 0.15)
        case .open: return MouthParams(open: 34, halfWidth: 62, upperThickness: 13, lowerThickness: 17, upperTeeth: 0.7, lowerTeeth: 0.35, tuck: 0, round: 0.5)
        case .spread: return MouthParams(open: 13, halfWidth: 86, upperThickness: 11, lowerThickness: 14, upperTeeth: 0.85, lowerTeeth: 0.5, tuck: 0, round: 0.1)
        case .rounded: return MouthParams(open: 22, halfWidth: 38, upperThickness: 19, lowerThickness: 22, upperTeeth: 0.15, lowerTeeth: 0, tuck: 0, round: 1)
        case .lipTeeth: return MouthParams(open: 6, halfWidth: 72, upperThickness: 14, lowerThickness: 14, upperTeeth: 1, lowerTeeth: 0, tuck: 1, round: 0.25)
        case .teethTogether: return MouthParams(open: 11, halfWidth: 82, upperThickness: 11, lowerThickness: 14, upperTeeth: 1, lowerTeeth: 1, tuck: 0, round: 0.1)
        }
    }

    func mixed(with other: MouthParams, _ t: Double) -> MouthParams {
        func mix(_ a: Double, _ b: Double) -> Double { a + (b - a) * t }
        return MouthParams(
            open: mix(open, other.open),
            halfWidth: mix(halfWidth, other.halfWidth),
            upperThickness: mix(upperThickness, other.upperThickness),
            lowerThickness: mix(lowerThickness, other.lowerThickness),
            upperTeeth: mix(upperTeeth, other.upperTeeth),
            lowerTeeth: mix(lowerTeeth, other.lowerTeeth),
            tuck: mix(tuck, other.tuck),
            round: mix(round, other.round)
        )
    }
}

struct TimelineSample {
    var params: MouthParams
    /// Index of the keyframe whose caption describes the current movement.
    var stepIndex: Int
}

/// Samples a timeline at `time` ms, smoothly interpolating between keyframes.
func sampleTimeline(_ timeline: [Keyframe], at time: Double) -> TimelineSample {
    guard let first = timeline.first else { return TimelineSample(params: .shape(.rest), stepIndex: 0) }
    if time <= first.at { return TimelineSample(params: .shape(first.shape), stepIndex: 0) }
    for i in 0..<(timeline.count - 1) {
        let a = timeline[i], b = timeline[i + 1]
        if time <= b.at {
            let u = (time - a.at) / max(1, b.at - a.at)
            let eased = u * u * (3 - 2 * u)
            return TimelineSample(params: MouthParams.shape(a.shape).mixed(with: .shape(b.shape), eased), stepIndex: i + 1)
        }
    }
    return TimelineSample(params: .shape(timeline[timeline.count - 1].shape), stepIndex: timeline.count - 1)
}

struct Rect: Hashable {
    var x: Double, y: Double, width: Double, height: Double
}

struct MouthGeometry {
    var left: Point
    var right: Point
    var innerTopY: Double
    var innerBottomY: Double
    var outerTopY: Double
    var outerBottomY: Double
    var upperLip: [PathCommand]
    var lowerLip: [PathCommand]
    var interior: [PathCommand]
    /// Interior extended downward so the upper teeth can overlap the lower lip.
    var upperTeethClip: [PathCommand]
    var upperTeeth: Rect
    var lowerTeeth: Rect
    var lipLine: [PathCommand]
    var outline: [PathCommand]
}

let mouthCenter = Point(x: 200, y: 168)

func buildMouth(_ p: MouthParams) -> MouthGeometry {
    let cx = mouthCenter.x
    // For /f/ the whole opening rises slightly as the lower lip lifts.
    let cy = mouthCenter.y - p.tuck * 4
    let hw = p.halfWidth
    let L = Point(x: cx - hw, y: cy)
    let R = Point(x: cx + hw, y: cy)
    let innerTopY = cy - p.open / 2
    let innerBottomY = cy + p.open / 2
    // A cubic whose control points share a y value reaches 3/4 of the way to
    // them at its midpoint, so scale by 4/3 to land exactly on the target.
    func ctrlY(_ target: Double) -> Double { cy + (target - cy) * (4.0 / 3.0) }
    let kx = hw * (0.42 + p.round * 0.45)

    func inner(_ y: Double, forward: Bool) -> PathCommand {
        forward
            ? .cubic(to: R, c1: Point(x: cx - kx, y: ctrlY(y)), c2: Point(x: cx + kx, y: ctrlY(y)))
            : .cubic(to: L, c1: Point(x: cx + kx, y: ctrlY(y)), c2: Point(x: cx - kx, y: ctrlY(y)))
    }

    let outerTopY = innerTopY - p.upperThickness
    let bowDip = 3.5 * (1 - p.round * 0.6)
    let cornerY = cy - p.upperThickness * 0.7 - p.open * 0.35
    let upperOuter: [PathCommand] = [
        .move(L),
        .cubic(to: Point(x: cx - hw * 0.28, y: outerTopY), c1: Point(x: L.x + hw * 0.25, y: cornerY), c2: Point(x: cx - hw * 0.55, y: outerTopY)),
        .quad(to: Point(x: cx, y: outerTopY + bowDip), control: Point(x: cx - hw * 0.1, y: outerTopY)),
        .quad(to: Point(x: cx + hw * 0.28, y: outerTopY), control: Point(x: cx + hw * 0.1, y: outerTopY)),
        .cubic(to: R, c1: Point(x: cx + hw * 0.55, y: outerTopY), c2: Point(x: R.x - hw * 0.25, y: cornerY)),
    ]

    let outerBottomY = innerBottomY + p.lowerThickness
    let lowerOuterBack = PathCommand.cubic(
        to: L,
        c1: Point(x: cx + hw * 0.62, y: ctrlY(outerBottomY)),
        c2: Point(x: cx - hw * 0.62, y: ctrlY(outerBottomY))
    )

    let teethWidth = hw * 1.3
    let upperTeethHeight = (15 + p.tuck * 3) * p.upperTeeth
    let lowerTeethHeight = 10 * p.lowerTeeth

    return MouthGeometry(
        left: L,
        right: R,
        innerTopY: innerTopY,
        innerBottomY: innerBottomY,
        outerTopY: outerTopY,
        outerBottomY: outerBottomY,
        upperLip: upperOuter + [inner(innerTopY, forward: false), .close],
        lowerLip: [.move(L), inner(innerBottomY, forward: true), lowerOuterBack, .close],
        interior: [.move(L), inner(innerTopY, forward: true), inner(innerBottomY, forward: false), .close],
        upperTeethClip: [.move(L), inner(innerTopY, forward: true), inner(innerBottomY + p.tuck * 13, forward: false), .close],
        upperTeeth: Rect(x: cx - teethWidth / 2, y: innerTopY - 2, width: teethWidth, height: upperTeethHeight + 2),
        lowerTeeth: Rect(x: cx - teethWidth / 2, y: innerBottomY - lowerTeethHeight, width: teethWidth, height: lowerTeethHeight + 2),
        lipLine: [.move(L), inner(innerTopY, forward: true)],
        outline: upperOuter + [lowerOuterBack, .close]
    )
}

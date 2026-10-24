import Foundation

// Per-frame lip measurements, normalized by face size so they don't change
// with camera distance. Port of src/analysis/features.ts; the trimming logic
// comes from https://github.com/cdiazcastilla/lip-reading-research (MIT).
//
// On iOS the landmarks come from Apple's Vision framework (outer and inner lip
// outlines), so the measurements use outline extents rather than MediaPipe's
// fixed point indices.

struct FrameFeatures: Hashable {
    /// Inner-lip opening / face unit.
    var opening: Double
    /// Mouth-corner distance / face unit.
    var width: Double
    /// Visible lower-lip thickness / face unit.
    var lowerLip: Double
    /// Lip protrusion. Vision landmarks are 2D, so this stays 0 on iOS.
    var protrusion: Double
}

/// Lip outlines for one frame, in image pixels with y pointing down.
struct LipLandmarks {
    var outerLips: [Point]
    var innerLips: [Point]
    /// Horizontal extent of the face contour, in pixels.
    var faceContourWidth: Double
    /// Head roll in radians (positive = clockwise in the image).
    var roll: Double
}

/// Vision's face contour spans the whole jaw, while the web app's face unit is
/// the distance between cheek centers (about 0.6 of that). Scaling keeps the
/// shared thresholds in summarizeCapture comparable. Tune on real devices.
let faceUnitPerContourWidth = 0.6

func describeFrame(_ lips: LipLandmarks) -> FrameFeatures? {
    guard lips.outerLips.count >= 4, lips.innerLips.count >= 3 else { return nil }
    let scale = lips.faceContourWidth * faceUnitPerContourWidth
    guard scale > 1e-6 else { return nil }

    // Remove head roll around the mouth center so extents are measured upright.
    let all = lips.outerLips + lips.innerLips
    let center = Point(x: all.map(\.x).reduce(0, +) / Double(all.count), y: all.map(\.y).reduce(0, +) / Double(all.count))
    let c = cos(-lips.roll), s = sin(-lips.roll)
    func upright(_ p: Point) -> Point {
        let dx = p.x - center.x, dy = p.y - center.y
        return Point(x: center.x + dx * c - dy * s, y: center.y + dx * s + dy * c)
    }
    let outer = lips.outerLips.map(upright)
    let inner = lips.innerLips.map(upright)

    guard let outerMinX = outer.map(\.x).min(), let outerMaxX = outer.map(\.x).max(),
          let outerMaxY = outer.map(\.y).max(),
          let innerMinY = inner.map(\.y).min(), let innerMaxY = inner.map(\.y).max()
    else { return nil }

    let features = FrameFeatures(
        opening: (innerMaxY - innerMinY) / scale,
        width: (outerMaxX - outerMinX) / scale,
        lowerLip: max(0, outerMaxY - innerMaxY) / scale,
        protrusion: 0
    )
    let values = [features.opening, features.width, features.lowerLip]
    return values.allSatisfy(\.isFinite) ? features : nil
}

private func shrinkingAverage(_ values: [Double], half: Int = 2) -> [Double] {
    values.indices.map { i in
        let window = values[max(0, i - half)...min(values.count - 1, i + half)]
        return window.reduce(0, +) / Double(window.count)
    }
}

/// First and last frame of visible speech movement, or nil when there is none.
func trimRange(opening: [Double], width: [Double], k: Double = 0.15, pad: Int = 3) -> ClosedRange<Int>? {
    let n = opening.count
    guard n >= 8, width.count == n else { return nil }
    let medianWidth = width.sorted()[n / 2]
    let minOpening = opening.min() ?? 0
    let motion = opening.indices.map { i in
        i == 0 ? 0 : abs(opening[i] - opening[i - 1]) + 0.7 * abs(width[i] - width[i - 1])
    }
    let offset = opening.indices.map { i in opening[i] - minOpening + 0.5 * abs(width[i] - medianWidth) }
    let smoothOffset = shrinkingAverage(offset)
    let smoothMotion = shrinkingAverage(motion)
    let activity = smoothOffset.indices.map { smoothOffset[$0] + 3 * smoothMotion[$0] }
    guard let lo = activity.min(), let hi = activity.max(), hi - lo > 1e-9 else { return nil }
    let active = activity.indices.filter { activity[$0] > lo + k * (hi - lo) }
    guard let first = active.first, let last = active.last, last - first >= 6 else { return nil }
    return max(0, first - pad)...min(n - 1, last + pad)
}

import Foundation

// Port of src/analysis/summarize.ts: turns the frames captured during one
// recording into a lesson-aware analysis. Thresholds are in face units or
// ratios to the learner's own rest shape, and lean toward "unclear" rather
// than a confident wrong answer.

struct CapturedFrame {
    /// Seconds from the start of the recording.
    var t: Double
    var features: FrameFeatures?
    /// JPEG data URL of the mouth crop, when a face was found.
    var crop: String?
}

private let closedOpening = 0.012
private let openAfterClosure = 0.03
private let minFaceVisible = 0.6
private let maxSnapshots = 4
private let timelinePoints = 24

private func median(_ values: [Double]) -> Double {
    guard !values.isEmpty else { return 0 }
    return values.sorted()[values.count / 2]
}

private func rounded(_ value: Double, _ digits: Int = 3) -> Double {
    let factor = pow(10, Double(digits))
    return (value * factor).rounded() / factor
}

private struct Tracked {
    var t: Double
    var f: FrameFeatures
    var crop: String?
}

private struct Rest {
    var opening: Double, width: Double, lowerLip: Double, protrusion: Double
}

private struct CheckOutcome {
    var check: VisualCheck
    var frame: Tracked?
    var snapshotLabel: String
}

func summarizeCapture(_ frames: [CapturedFrame], lesson: Lesson) -> MouthAnalysis {
    let tracked: [Tracked] = frames.compactMap { frame in
        frame.features.map { Tracked(t: frame.t, f: $0, crop: frame.crop) }
    }
    let duration = frames.last?.t ?? 0
    let faceVisible = frames.isEmpty ? 0 : Double(tracked.count) / Double(frames.count)
    var analysis = MouthAnalysis(
        faceVisible: rounded(faceVisible, 2),
        frames: frames.count,
        durationSeconds: rounded(duration, 2),
        speech: nil,
        rest: RestShape(opening: 0, widthFaceUnits: 0),
        checks: [],
        timeline: [],
        snapshots: [],
        usable: false
    )
    guard tracked.count >= 10, faceVisible >= minFaceVisible else { return analysis }

    let opening = tracked.map(\.f.opening)
    let width = tracked.map(\.f.width)
    let range = trimRange(opening: opening, width: width)
    let start = range?.lowerBound ?? 0
    let end = range?.upperBound ?? tracked.count - 1

    // Rest shape: frames outside the movement window, or else the most closed frames.
    var restFrames = tracked.indices.filter { $0 < start || $0 > end }.map { tracked[$0] }
    if restFrames.count < 3 {
        let byOpening = tracked.sorted { $0.f.opening < $1.f.opening }
        restFrames = Array(byOpening.prefix(max(3, Int((Double(tracked.count) * 0.2).rounded()))))
    }
    let rest = Rest(
        opening: median(restFrames.map(\.f.opening)),
        width: median(restFrames.map(\.f.width)),
        lowerLip: median(restFrames.map(\.f.lowerLip)),
        protrusion: median(restFrames.map(\.f.protrusion))
    )

    let speechFrames = Array(tracked[start...end])
    var snapshotCandidates: [(String, Tracked)] = []
    for id in lesson.visualChecks {
        let outcome = runCheck(id, tracked: tracked, speechFrames: speechFrames, start: start, end: end, rest: rest, lessonId: lesson.id)
        analysis.checks.append(outcome.check)
        if let frame = outcome.frame { snapshotCandidates.append((outcome.snapshotLabel, frame)) }
    }

    let peakOpen = speechFrames.max { $0.f.opening < $1.f.opening } ?? tracked[0]
    let restFrame = restFrames.first { $0.crop != nil } ?? tracked[0]
    analysis.snapshots = pickSnapshots([("Rest, before speaking", restFrame)] + snapshotCandidates + [("Widest opening", peakOpen)])

    let points = min(timelinePoints, tracked.count)
    analysis.timeline = (0..<points).map { i in
        let s = tracked[Int((Double(i) / Double(max(1, points - 1)) * Double(tracked.count - 1)).rounded())]
        return MouthSample(
            t: rounded(s.t, 2),
            opening: rounded(s.f.opening),
            width: rounded(s.f.width / rest.width),
            lowerLip: rounded(rest.lowerLip > 0 ? s.f.lowerLip / rest.lowerLip : 1),
            protrusion: rounded(s.f.protrusion - rest.protrusion)
        )
    }
    analysis.speech = range.map { _ in SpeechRange(start: rounded(tracked[start].t, 2), end: rounded(tracked[end].t, 2)) }
    analysis.rest = RestShape(opening: rounded(rest.opening), widthFaceUnits: rounded(rest.width))
    analysis.usable = true
    return analysis
}

private func runCheck(_ id: VisualCheckID, tracked: [Tracked], speechFrames: [Tracked], start: Int, end: Int, rest: Rest, lessonId: LessonID) -> CheckOutcome {
    switch id {
    case .closure:
        return closureCheck(tracked: tracked, start: start, end: end, mustFollowOpening: lessonId == .seeMe)
    case .rounding:
        return ratioCheck(id, frames: speechFrames, pick: { $0.f.width / rest.width }, lowerIsBetter: true,
                          detectedAt: 0.88, unclearAt: 0.94, snapshotLabel: "Most rounded shape", neutralLabel: "Narrowest moment",
                          summaries: [
                              .detected: "Your mouth corners moved inward, narrower than your resting width — a rounded shape.",
                              .unclear: "Your mouth corners moved inward a little. The rounding was slight.",
                              .notDetected: "Your mouth width stayed close to your resting width, so rounding was not visible.",
                          ])
    case .spread:
        return ratioCheck(id, frames: speechFrames, pick: { $0.f.width / rest.width }, lowerIsBetter: false,
                          detectedAt: 1.05, unclearAt: 1.02, snapshotLabel: "Most spread shape", neutralLabel: "Widest moment",
                          summaries: [
                              .detected: "Your lips spread wider than at rest, as they do for “ee.”",
                              .unclear: "Your lips spread slightly wider than at rest.",
                              .notDetected: "Your lip width stayed close to rest during the vowel.",
                          ])
    case .lipTeeth:
        // The lip–teeth contact happens near the start of “fish”.
        let firstHalf = Array(speechFrames.prefix(max(3, Int((Double(speechFrames.count) / 2).rounded(.up)))))
        return ratioCheck(id, frames: firstHalf, pick: { $0.f.opening < 0.04 && rest.lowerLip > 0 ? $0.f.lowerLip / rest.lowerLip : 1 },
                          lowerIsBetter: true, detectedAt: 0.72, unclearAt: 0.85,
                          snapshotLabel: "Lower lip raised toward the upper teeth", neutralLabel: "Start of the word",
                          summaries: [
                              .detected: "Your lower lip appeared to tuck up and look thinner, as it does when it meets the upper teeth. Teeth are not tracked, so this is an estimate.",
                              .unclear: "Your lower lip may have moved up slightly. Teeth are not tracked, so this is hard to confirm.",
                              .notDetected: "Your lower lip did not visibly tuck up at the start. Teeth are not tracked, so check the snapshot.",
                          ])
    }
}

private func closureCheck(tracked: [Tracked], start: Int, end: Int, mustFollowOpening: Bool) -> CheckOutcome {
    // Look slightly before the movement window: “me” starts from closed lips.
    let from = max(0, start - 6)
    var best: (frame: Tracked, minOpening: Double, closed: Int)?
    var i = from
    while i <= end {
        if tracked[i].f.opening >= closedOpening { i += 1; continue }
        var j = i
        while j + 1 <= end, tracked[j + 1].f.opening < closedOpening { j += 1 }
        let closedFrames = j - i + 1
        let after = tracked[min(tracked.count, j + 1)..<min(tracked.count, j + 25)]
        let before = tracked[max(0, i - 25)..<i]
        let opensAfter = after.contains { $0.f.opening > openAfterClosure }
        let openedBefore = before.contains { $0.f.opening > openAfterClosure }
        if opensAfter, !mustFollowOpening || openedBefore, closedFrames >= 2, closedFrames > (best?.closed ?? 0) {
            let minOpening = tracked[i...j].map(\.f.opening).min() ?? 0
            best = (tracked[(i + j) / 2], minOpening, closedFrames)
        }
        i = j + 1
    }

    let place = mustFollowOpening ? "between the two words" : "before opening into the vowel"
    if let best {
        return CheckOutcome(
            check: VisualCheck(id: .closure, result: .detected,
                               summary: "Your lips came together \(place) (at about \(String(format: "%.1f", best.frame.t)) s).",
                               atSeconds: rounded(best.frame.t, 2), value: rounded(best.minOpening)),
            frame: best.frame, snapshotLabel: "Lips together")
    }

    // No full closure: report the most closed moment in the window.
    let window = tracked[from...end]
    let closest = window.min { $0.f.opening < $1.f.opening } ?? tracked[from]
    let result: CheckResult = closest.f.opening < closedOpening * 1.8 ? .unclear : .notDetected
    let summary = result == .unclear
        ? "Your lips came close together \(place), but a full closure was not clear."
        : "Your lips did not visibly close \(place)."
    return CheckOutcome(
        check: VisualCheck(id: .closure, result: result, summary: summary, atSeconds: rounded(closest.t, 2), value: rounded(closest.f.opening)),
        frame: closest, snapshotLabel: "Most closed moment")
}

private func ratioCheck(_ id: VisualCheckID, frames: [Tracked], pick: (Tracked) -> Double, lowerIsBetter: Bool,
                        detectedAt: Double, unclearAt: Double, snapshotLabel: String, neutralLabel: String,
                        summaries: [CheckResult: String]) -> CheckOutcome {
    guard let first = frames.first else {
        return CheckOutcome(check: VisualCheck(id: id, result: .notDetected, summary: summaries[.notDetected] ?? ""), frame: nil, snapshotLabel: neutralLabel)
    }
    let extreme = frames.reduce(first) { best, s in
        lowerIsBetter ? (pick(s) < pick(best) ? s : best) : (pick(s) > pick(best) ? s : best)
    }
    let value = pick(extreme)
    func passes(_ threshold: Double) -> Bool { lowerIsBetter ? value <= threshold : value >= threshold }
    let result: CheckResult = passes(detectedAt) ? .detected : passes(unclearAt) ? .unclear : .notDetected
    return CheckOutcome(
        check: VisualCheck(id: id, result: result, summary: summaries[result] ?? "", atSeconds: rounded(extreme.t, 2), value: rounded(value)),
        frame: extreme,
        snapshotLabel: result == .detected ? snapshotLabel : neutralLabel)
}

private func pickSnapshots(_ candidates: [(String, Tracked)]) -> [MouthSnapshot] {
    var chosen: [MouthSnapshot] = []
    for (label, frame) in candidates {
        guard let crop = frame.crop, chosen.count < maxSnapshots else { continue }
        // Skip frames that are almost at the same moment as one already chosen.
        if chosen.contains(where: { abs($0.t - frame.t) < 0.12 }) { continue }
        chosen.append(MouthSnapshot(label: label, t: rounded(frame.t, 2), dataUrl: crop))
    }
    return chosen.sorted { $0.t < $1.t }
}

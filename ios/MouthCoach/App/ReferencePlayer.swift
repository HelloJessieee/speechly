import Foundation
import Observation
import UIKit

/// Plays a keyframe timeline: play, pause, replay, seek and normal or slow speed.
@MainActor
@Observable
final class ReferencePlayer {
    private(set) var timeline: [Keyframe] = []
    private(set) var time: Double = 0
    private(set) var playing = false
    /// True once the learner has watched a timeline to the end.
    private(set) var watched = false
    var speed: Double = 1
    var loops = true
    var hapticsEnabled = false
    var hapticPreference = true

    @ObservationIgnored private var task: Task<Void, Never>?
    @ObservationIgnored private let haptic = UIImpactFeedbackGenerator(style: .light)
    @ObservationIgnored private var lastHaptic = Date.distantPast

    var duration: Double { timeline.duration }
    var progress: Double { duration > 0 ? time / duration : 0 }
    var sample: TimelineSample { sampleTimeline(timeline, at: time) }

    func load(_ timeline: [Keyframe]) {
        pause()
        self.timeline = timeline
        time = 0
    }

    func play() {
        if time >= duration { time = 0 }
        guard !playing else { return }
        playing = true
        task = Task { [weak self] in
            var last = Date()
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(16))
                guard let self, self.playing else { return }
                let now = Date()
                let previousStep = self.sample.stepIndex
                self.time = min(self.duration, self.time + now.timeIntervalSince(last) * 1000 * self.speed)
                last = now
                if self.sample.stepIndex != previousStep,
                   self.hapticsEnabled, self.hapticPreference,
                   now.timeIntervalSince(self.lastHaptic) >= 0.25 {
                    self.haptic.impactOccurred(intensity: 0.55)
                    self.lastHaptic = now
                }
                if self.time >= self.duration {
                    self.watched = true
                    if self.loops, self.duration > 0 {
                        self.time = 0
                    } else {
                        self.playing = false
                        return
                    }
                }
            }
        }
    }

    func pause() {
        playing = false
        task?.cancel()
        task = nil
    }

    func replay() {
        pause()
        time = 0
        play()
    }

    func seek(to value: Double) {
        time = max(0, min(duration, value))
    }

    func markWatched() { watched = true }
}

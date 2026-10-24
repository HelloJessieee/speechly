import AVFoundation
import Observation

/// Records short practice attempts to a temporary file that is deleted on
/// discard. In demo mode it simulates a recording without using the microphone.
@MainActor
@Observable
final class AudioRecorder: NSObject, AVAudioPlayerDelegate {
    enum Status: Equatable { case idle, recording, ready, unusable, denied, error(String) }

    struct Recording {
        /// Nil for a simulated demo attempt.
        var url: URL?
        var duration: TimeInterval
        var peakLevel: Double
        var quiet: Bool
    }

    static let maxDuration: TimeInterval = 10
    private static let minDuration: TimeInterval = 0.4
    private static let quietThreshold = 0.2
    private static let demoAutoStop: TimeInterval = 3

    private(set) var status: Status = .idle
    private(set) var elapsed: TimeInterval = 0
    /// Live microphone level, 0–1. Loudness only, not a pronunciation measure.
    private(set) var level: Double = 0
    private(set) var recording: Recording?
    private(set) var isPlaying = false
    private(set) var permissionGranted = false

    /// Called when a recording finishes, with nil when it was unusable.
    @ObservationIgnored var onFinish: ((Recording?) -> Void)?

    @ObservationIgnored private var recorder: AVAudioRecorder?
    @ObservationIgnored private var player: AVAudioPlayer?
    @ObservationIgnored private var timer: Timer?
    @ObservationIgnored private var startedAt = Date()
    @ObservationIgnored private var peak: Double = 0
    @ObservationIgnored private var simulated = false

    func requestPermission() async {
        permissionGranted = await AVAudioApplication.requestRecordPermission()
        if !permissionGranted { status = .denied }
    }

    func start(simulated: Bool) {
        discard()
        self.simulated = simulated
        peak = 0
        if !simulated {
            guard permissionGranted else { status = .denied; return }
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
                try session.setActive(true)
                let url = FileManager.default.temporaryDirectory.appendingPathComponent("attempt-\(UUID().uuidString).m4a")
                let settings: [String: Any] = [
                    AVFormatIDKey: kAudioFormatMPEG4AAC,
                    AVSampleRateKey: 44_100,
                    AVNumberOfChannelsKey: 1,
                    AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
                ]
                let recorder = try AVAudioRecorder(url: url, settings: settings)
                recorder.isMeteringEnabled = true
                guard recorder.record(forDuration: Self.maxDuration) else { throw CocoaError(.fileWriteUnknown) }
                self.recorder = recorder
            } catch {
                status = .error("Recording could not start. You can still try demo mode.")
                return
            }
        }
        startedAt = Date()
        elapsed = 0
        status = .recording
        timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }

    private func tick() {
        elapsed = min(Date().timeIntervalSince(startedAt), Self.maxDuration)
        if let recorder {
            recorder.updateMeters()
            let db = Double(recorder.averagePower(forChannel: 0))
            level = max(0, min(1, (db + 60) / 60))
            peak = max(peak, level)
        }
        let limit = simulated ? Self.demoAutoStop : Self.maxDuration
        if elapsed >= limit { stop() }
    }

    func stop() {
        guard status == .recording else { return }
        timer?.invalidate()
        timer = nil
        level = 0
        let duration = max(simulated ? 0.8 : 0, Date().timeIntervalSince(startedAt))
        elapsed = min(duration, Self.maxDuration)

        if simulated {
            finish(Recording(url: nil, duration: elapsed, peakLevel: 0, quiet: false))
            return
        }
        recorder?.stop()
        let url = recorder?.url
        recorder = nil
        let size = (url.flatMap { try? FileManager.default.attributesOfItem(atPath: $0.path)[.size] as? Int }) ?? 0
        guard let url, size > 0, elapsed >= Self.minDuration else {
            if let url { try? FileManager.default.removeItem(at: url) }
            status = .unusable
            onFinish?(nil)
            return
        }
        finish(Recording(url: url, duration: elapsed, peakLevel: peak, quiet: peak < Self.quietThreshold))
    }

    private func finish(_ result: Recording) {
        recording = result
        status = .ready
        onFinish?(result)
    }

    func togglePlayback() {
        if isPlaying {
            player?.stop()
            isPlaying = false
            return
        }
        guard let url = recording?.url, let player = try? AVAudioPlayer(contentsOf: url) else { return }
        player.delegate = self
        player.play()
        self.player = player
        isPlaying = true
    }

    func discard() {
        timer?.invalidate()
        timer = nil
        recorder?.stop()
        if let url = recorder?.url { try? FileManager.default.removeItem(at: url) }
        recorder = nil
        player?.stop()
        player = nil
        isPlaying = false
        if let url = recording?.url { try? FileManager.default.removeItem(at: url) }
        recording = nil
        elapsed = 0
        level = 0
        if status != .denied { status = .idle }
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in self.isPlaying = false }
    }
}

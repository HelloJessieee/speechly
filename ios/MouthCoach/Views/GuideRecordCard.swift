import SwiftUI

/// An optional repeat take after the sentence guide is available.
struct GuideRecordCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let recorder = model.guideRecorder
        let recording = recorder.status == .recording

        VStack(alignment: .leading, spacing: 14) {
            Eyebrow(text: "Your turn")
            Text(model.guideRecordingConfirmed
                 ? "Record another take whenever you're ready."
                 : "Follow the mouth guide, then record your attempt.")
                .font(.headline)

            if recording {
                HStack {
                    Text(String(format: "Recording · %.1fs", recorder.elapsed))
                        .font(.subheadline.monospacedDigit())
                    Spacer()
                    ProgressView(value: recorder.level)
                        .frame(width: 80)
                }
                Button("Stop", systemImage: "stop.fill") { model.stopGuideRecording() }
                    .primaryButton(tint: .mcRecord)
            } else if model.guideRecordingPendingConfirmation {
                Text("Use this take?").font(.headline)
                HStack(spacing: 10) {
                    Button(recorder.isPlaying ? "Stop playback" : "Listen", systemImage: recorder.isPlaying ? "stop.fill" : "play.fill") {
                        recorder.togglePlayback()
                    }
                    .secondaryButton()
                    Button("Use this take", systemImage: "checkmark") {
                        Task { await model.confirmGuideRecording() }
                    }
                    .primaryButton()
                }
                Button("Record again") { model.startGuideRecording() }
                    .font(.subheadline)
            } else if model.guideCaptureFinishing {
                ProgressView("Saving take…")
            } else {
                Button(model.guideRecordingConfirmed ? "Record another take" : "Record attempt", systemImage: "record.circle") {
                    model.startGuideRecording()
                }
                .primaryButton(tint: .mcRecord)
                .disabled(model.practiceMode != .live || !recorder.permissionGranted)
            }

            if model.fullAnalysisRunning, let stage = model.analysisStage {
                ProgressView(stage).font(.subheadline)
            }
            if let error = model.mirrorError {
                Text(error).font(.subheadline).foregroundStyle(Color.mcAmberInk)
                if model.guideRecordingConfirmed {
                    Button("Retry analysis") { Task { await model.analyzeConfirmedRecording() } }
                        .secondaryButton()
                }
            }
            switch recorder.status {
            case .unusable:
                Text("Too short. Try again.").foregroundStyle(Color.mcAmberInk)
            case .denied:
                Text("Allow microphone access in Settings.").foregroundStyle(Color.mcAmberInk)
            case .error(let message):
                Text(message).foregroundStyle(Color.mcAmberInk)
            case .idle, .recording, .ready:
                EmptyView()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

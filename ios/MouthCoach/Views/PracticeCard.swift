import SwiftUI

struct PracticeCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Eyebrow(text: "Live camera")
            if model.freeSpeechMode && !model.customReference {
                Text("Say a sentence. Confirm the transcript to add the yellow reference outline.")
                    .font(.subheadline).foregroundStyle(Color.mcInkSoft)
            } else {
                Picker("Lip outline", selection: Binding(get: { model.lipOverlayMode }, set: { model.lipOverlayMode = $0 })) {
                    ForEach(LipOverlayMode.allCases, id: \.self) { mode in Text(mode.rawValue).tag(mode) }
                }
                .pickerStyle(.segmented)
                Text("Yellow: looping guide · Blue: measured lips")
                    .font(.caption).foregroundStyle(Color.mcInkSoft)
            }
            if model.customReference || !model.freeSpeechMode {
                Text("Guide word: \(model.currentReferenceWord ?? "pause")")
                    .font(.subheadline.bold()).foregroundStyle(Color.mcAmberInk)
            }
            preview
            if model.practiceMode == .live { statusRow }
            if model.practiceMode == .live && !model.camera.faceFound && model.lipOverlayMode.showsReference {
                Text("The yellow outline centers until your lips are detected, then follows their size and position.")
                    .font(.caption).foregroundStyle(Color.mcInkSoft)
            }
            if model.practiceMode != .off {
                Button(model.practiceMode == .demo ? "Exit demo mode" : "Turn off camera & mic", systemImage: "power") { model.stopPractice() }
                    .font(.subheadline)
                    .foregroundStyle(Color.mcInkSoft)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            RecorderControls()
            if let recording = model.recorder.recording { playback(recording) }
        }
        .padding(18)
        .glassCard()
    }

    @ViewBuilder private var preview: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 22, style: .continuous).fill(.white.opacity(0.3))
            switch model.practiceMode {
            case .off:
                VStack(spacing: 12) {
                    Image(systemName: "camera").font(.title).foregroundStyle(Color.mcSage)
                    Button("Start camera & microphone", systemImage: "camera") { model.startCamera() }.primaryButton()
                    Button("Try demo mode") { model.startDemo() }.secondaryButton()
                    Text("Free speech audio goes to your Mac for recognition after recording.")
                        .font(.caption).foregroundStyle(Color.mcInkSoft)
                }
                .padding()
            case .demo:
                VStack(spacing: 12) {
                    Image(systemName: "face.dashed").font(.system(size: 48)).foregroundStyle(Color.mcSage)
                    Text("Demo mode — camera and microphone are off").font(.headline).multilineTextAlignment(.center)
                    Button("Use my camera instead", systemImage: "camera") { model.startCamera() }.secondaryButton()
                }
                .padding()
            case .live:
                liveView
            }
        }
        .aspectRatio(3 / 4, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    @ViewBuilder private var liveView: some View {
        switch model.camera.status {
        case .ready:
            ZStack(alignment: .top) {
                CameraPreviewView(session: model.camera.session)
                    .accessibilityLabel("Your camera preview, mirrored")
                LiveMouthOverlay(lips: model.camera.liveLips,
                                 params: model.player.sample.params,
                                 mode: model.lipOverlayMode)
                Ellipse()
                    .strokeBorder(.white.opacity(0.9), style: StrokeStyle(lineWidth: 3, dash: [8, 7]))
                    .padding(.horizontal, 60)
                    .padding(.vertical, 50)
                    .accessibilityHidden(true)
                HStack(spacing: 6) {
                    Circle().fill(model.camera.faceFound ? Color.mcSage : Color.mcAmberInk).frame(width: 8, height: 8)
                    Text(model.camera.faceFound ? "Tracking your lips" : "Face not found — move into the oval")
                        .font(.caption.bold())
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(.ultraThinMaterial, in: Capsule())
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        case .requesting, .notRequested:
            VStack(spacing: 8) {
                ProgressView()
                Text("Waiting for camera permission…").font(.headline)
            }
        case .denied, .unavailable:
            VStack(spacing: 12) {
                Text(model.camera.status == .denied
                     ? "Camera permission was denied. You can allow it in Settings, or continue in demo mode."
                     : "No front camera was found. You can continue in demo mode.")
                    .multilineTextAlignment(.center)
                    .font(.headline)
                Button("Try demo mode") { model.startDemo() }.primaryButton()
            }
            .padding()
        }
    }

    private var statusRow: some View {
        HStack(spacing: 8) {
            Pill(text: "Camera: \(model.camera.status == .ready ? "On" : model.camera.status == .denied ? "Permission denied" : "Off")",
                 foreground: model.camera.status == .ready ? .mcSage : .mcAmberInk,
                 background: model.camera.status == .ready ? .mcSageSoft : .mcAmberSoft)
            Pill(text: "Microphone: \(model.recorder.permissionGranted ? "On" : model.recorder.status == .denied ? "Permission denied" : "Off")",
                 foreground: model.recorder.permissionGranted ? .mcSage : .mcAmberInk,
                 background: model.recorder.permissionGranted ? .mcSageSoft : .mcAmberSoft)
        }
    }

    private func playback(_ recording: AudioRecorder.Recording) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Your attempt").font(.headline)
                Spacer()
                Text(String(format: "0:%04.1f", recording.duration)).font(.subheadline.monospacedDigit()).foregroundStyle(Color.mcInkSoft)
            }
            if recording.url == nil {
                Text("Demo attempt — no audio was captured.")
                    .font(.subheadline)
                    .foregroundStyle(Color.mcAmberInk)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.mcAmberSoft.opacity(0.8), in: RoundedRectangle(cornerRadius: 12))
            } else {
                Button(model.recorder.isPlaying ? "Stop playback" : "Play recording",
                       systemImage: model.recorder.isPlaying ? "stop.fill" : "play.fill") { model.recorder.togglePlayback() }
                    .secondaryButton()
                (Text("Mic signal: ").bold() + Text(recording.quiet ? "very quiet" : "sound detected")
                    + Text(" (loudness only, not pronunciation)").foregroundColor(.mcInkSoft))
                    .font(.subheadline)
            }
            Button("Discard recording", systemImage: "trash") { model.resetPractice() }
                .font(.subheadline)
                .foregroundStyle(Color.mcInkSoft)
        }
        .padding(14)
        .background(.white.opacity(0.45), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

struct RecorderControls: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let recorder = model.recorder
        let recording = recorder.status == .recording
        let enabled = model.practiceMode == .demo || (model.practiceMode == .live && recorder.permissionGranted)
        VStack(alignment: .leading, spacing: 10) {
            if model.practiceMode == .live && recorder.permissionGranted {
                HStack {
                    Text("Microphone level").font(.subheadline.weight(.semibold)).foregroundStyle(Color.mcInkSoft)
                    ProgressView(value: recorder.level).tint(.mcSage).accessibilityLabel("Microphone signal level")
                }
            }
            HStack(spacing: 12) {
                if recording {
                    Button("Stop recording", systemImage: "stop.fill") { model.stopRecording() }.primaryButton(tint: .mcRecord)
                } else {
                    Button(recorder.status == .ready ? "Record again" : model.practiceMode == .demo ? "Record (demo)" : "Record",
                           systemImage: "record.circle") { model.startRecording() }
                        .primaryButton(tint: .mcRecord)
                        .disabled(!enabled)
                }
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("\(recording ? "REC" : "Length") \(String(format: "0:%04.1f", recorder.elapsed))")
                            .font(.subheadline.bold().monospacedDigit())
                            .foregroundStyle(recording ? Color.mcRecord : Color.mcInkSoft)
                        Spacer()
                        Text("max \(Int(AudioRecorder.maxDuration))s").font(.subheadline).foregroundStyle(Color.mcInkSoft)
                    }
                    ProgressView(value: recorder.elapsed, total: AudioRecorder.maxDuration).tint(.mcRecord)
                }
            }
            switch recorder.status {
            case .recording:
                Text(model.freeSpeechMode && model.referenceText.isEmpty
                     ? "Recording… say an English sentence." : "Recording… say “\(model.referenceText)”.")
                    .font(.subheadline).foregroundStyle(Color.mcInkSoft)
            case .unusable:
                Text("That recording was too short or empty. Try recording for at least one second.").font(.subheadline.bold()).foregroundStyle(Color.mcAmberInk)
            case .denied:
                Text("Microphone permission was denied. You can allow it in Settings, or try demo mode.").font(.subheadline).foregroundStyle(Color.mcAmberInk)
            case .error(let message):
                Text(message).font(.subheadline.bold()).foregroundStyle(Color.mcAmberInk)
            case .idle, .ready:
                EmptyView()
            }
        }
    }
}

struct MeasurementsView: View {
    var analysis: MouthAnalysis

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("What the camera measured").font(.headline)
                Text("From face landmarks, on your device. Compared with your own resting mouth.").font(.caption).foregroundStyle(Color.mcInkSoft)
            }
            if analysis.usable {
                ForEach(analysis.checks, id: \.id) { check in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(check.id.title).font(.subheadline.bold())
                            Spacer()
                            Pill(text: check.result.label,
                                 foreground: check.result == .detected ? .mcSage : check.result == .unclear ? .mcAmberInk : .mcInkSoft,
                                 background: check.result == .detected ? .mcSageSoft : check.result == .unclear ? .mcAmberSoft : .white.opacity(0.7))
                        }
                        Text(check.summary).font(.subheadline).foregroundStyle(Color.mcInkSoft)
                    }
                }
            } else {
                Label("Your face wasn’t visible clearly enough to measure. Center your face in the oval, with good light, and try again.", systemImage: "info.circle")
                    .font(.subheadline)
                    .foregroundStyle(Color.mcAmberInk)
            }
            if !analysis.snapshots.isEmpty {
                HStack(alignment: .top, spacing: 8) {
                    ForEach(analysis.snapshots, id: \.t) { snapshot in
                        VStack(alignment: .leading, spacing: 2) {
                            if let image = Self.image(from: snapshot.dataUrl) {
                                Image(uiImage: image)
                                    .resizable()
                                    .aspectRatio(4 / 3, contentMode: .fill)
                                    .scaleEffect(x: -1, y: 1)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .accessibilityLabel("Your mouth: \(snapshot.label), at \(String(format: "%.1f", snapshot.t)) seconds")
                            }
                            Text(snapshot.label).font(.caption2).foregroundStyle(Color.mcInkSoft)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .padding(14)
        .background(.white.opacity(0.45), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private static func image(from dataUrl: String) -> UIImage? {
        guard let comma = dataUrl.firstIndex(of: ","), let data = Data(base64Encoded: String(dataUrl[dataUrl.index(after: comma)...])) else { return nil }
        return UIImage(data: data)
    }
}

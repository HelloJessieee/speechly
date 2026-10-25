import SwiftUI

struct GuideOverlayCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Eyebrow(text: "On your lips")
            Text("Compare the guide with your own mouth")
                .font(.headline)
            if model.fullAnalysisRunning, let stage = model.analysisStage {
                ProgressView(stage).font(.caption)
            } else if model.mirrorResult?.intent?.confirmed_text != nil {
                Text("Your analysis is ready on Results.")
                    .font(.caption.weight(.semibold)).foregroundStyle(Color.mcSage)
            }
            if let error = model.mirrorError {
                Text(error).font(.caption).foregroundStyle(Color.mcAmberInk)
            }
            HStack {
                Text("Yellow guide size").font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(Int(model.referenceLipScale * 100))%")
                    .font(.subheadline.monospacedDigit()).foregroundStyle(Color.mcInkSoft)
            }
            Slider(value: Binding(get: { model.referenceLipScale }, set: { model.referenceLipScale = $0 }),
                   in: 0.65...1.35, step: 0.05)
                .tint(.mcAmberInk)
                .accessibilityLabel("Yellow guide size relative to your detected lips")
            if model.camera.status == .ready {
                ZStack {
                    CameraPreviewView(session: model.camera.session)
                    LiveMouthOverlay(lips: model.camera.liveLips,
                                     params: model.player.sample.params,
                                     mode: .yellow,
                                     referenceScale: model.referenceLipScale)
                }
                .frame(maxWidth: 240)
                .aspectRatio(3 / 4, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .frame(maxWidth: .infinity)
                Text("Reference word: \(model.currentReferenceWord ?? "pause")")
                    .font(.subheadline.bold())
                    .foregroundStyle(Color.mcAmberInk)
            } else {
                Button("Turn on camera", systemImage: "camera") { model.startCamera() }
                    .secondaryButton()
            }
            if model.customReference {
                Divider()
                GuideRecordCard()
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard()
        .task {
            if model.practiceMode == .live { await model.camera.ensureRunning() }
        }
    }
}

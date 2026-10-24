import SwiftUI

struct GuideOverlayCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Eyebrow(text: "On your lips")
            Text("Compare the guide with your own mouth")
                .font(.headline)
            Picker("Lip outline", selection: Binding(get: { model.lipOverlayMode }, set: { model.lipOverlayMode = $0 })) {
                ForEach(LipOverlayMode.allCases, id: \.self) { mode in
                    Text(mode.rawValue).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            Text("Yellow follows the looping reference. Blue follows your measured lips.")
                .font(.caption).foregroundStyle(Color.mcInkSoft)
            if model.camera.status == .ready {
                ZStack {
                    CameraPreviewView(session: model.camera.session)
                    LiveMouthOverlay(lips: model.camera.liveLips,
                                     params: model.player.sample.params,
                                     mode: model.lipOverlayMode)
                }
                .frame(maxWidth: 240)
                .aspectRatio(3 / 4, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .frame(maxWidth: .infinity)
                Text("Reference word: \(model.currentReferenceWord ?? "pause")")
                    .font(.subheadline.bold())
                    .foregroundStyle(Color.mcAmberInk)
                if !model.camera.faceFound {
                    Text("The yellow outline will resize and attach to your lips when your face is detected.")
                        .font(.caption).foregroundStyle(Color.mcInkSoft)
                }
            } else {
                Button("Turn on camera", systemImage: "camera") { model.startCamera() }
                    .secondaryButton()
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard()
    }
}

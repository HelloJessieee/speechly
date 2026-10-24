import SwiftUI

struct ReferenceCard: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var stepModeChoice: Bool?
    @State private var stepIndex = 0

    private var stepMode: Bool { stepModeChoice ?? reduceMotion }

    var body: some View {
        let lesson = model.lesson
        let player = model.player
        let timeline = player.timeline
        let activeIndex = min(stepMode ? stepIndex : player.sample.stepIndex, max(0, timeline.count - 1))
        let activeStep = timeline.isEmpty ? nil : timeline[activeIndex]
        let params = stepMode ? MouthParams.shape(activeStep?.shape ?? .rest) : player.sample.params

        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Eyebrow(text: "Reference")
                    Text(lesson.text).font(.system(size: 36, weight: .heavy))
                    Text("\(lesson.pronunciation.respelling) · \(lesson.pronunciation.ipa)")
                        .foregroundStyle(Color.mcInkSoft)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Button {
                        model.speech.speak(lesson.text, slow: player.speed < 1)
                    } label: {
                        Label(model.speech.speaking ? "Speaking…" : "Hear it", systemImage: "speaker.wave.2")
                    }
                    .secondaryButton()
                    .disabled(!model.speech.available)
                    .accessibilityLabel("Hear “\(lesson.text)” spoken by an on-device voice")
                    if !model.speech.available {
                        Text("Audio preview is unavailable on this device.")
                            .font(.caption)
                            .foregroundStyle(Color.mcInkSoft)
                            .multilineTextAlignment(.trailing)
                    }
                }
            }

            Picker("Animation mode", selection: Binding(get: { model.animationMode }, set: { model.setAnimationMode($0) })) {
                Text("Reference").tag(AnimationMode.reference)
                Text("Correction guidance").tag(AnimationMode.correction)
            }
            .pickerStyle(.segmented)

            VStack(spacing: 0) {
                MouthCanvas(
                    params: params,
                    correction: model.animationMode == .correction ? lesson.correction : nil,
                    accessibilityText: "Mouth illustration for “\(lesson.text)”: \(activeStep?.shape.label ?? ""). \(activeStep?.caption ?? "")"
                )
                HStack(spacing: 10) {
                    if let sound = activeStep?.sound {
                        Pill(text: sound, foreground: .mcSage, background: .mcSageSoft)
                    }
                    Text(activeStep?.caption ?? "").font(.body.weight(.semibold))
                    Spacer(minLength: 0)
                }
                .padding(12)
                .background(.white.opacity(0.5))
            }
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(model.animationMode == .correction ? Color.mcSky.opacity(0.5) : .white.opacity(0.7), lineWidth: 1.5))

            if model.animationMode == .correction {
                VStack(alignment: .leading, spacing: 4) {
                    Label("Practice suggestion", systemImage: "lightbulb").font(.subheadline.bold()).foregroundStyle(Color.mcSky)
                    Text(lesson.correction.instruction).font(.body.weight(.semibold))
                    Text("General guidance, not an observation about you.").font(.footnote).foregroundStyle(Color.mcInkSoft)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(Color.mcSkySoft.opacity(0.75), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            }

            if stepMode {
                stepControls(timeline: timeline, activeIndex: activeIndex)
            } else {
                playbackControls(player: player)
            }

            Toggle("Step-by-step view (no motion)", isOn: Binding(get: { stepMode }, set: { stepModeChoice = $0 }))
                .font(.subheadline.weight(.semibold))
                .tint(.mcSage)
        }
        .padding(18)
        .glassCard()
        .onChange(of: timeline) { _, _ in stepIndex = 0 }
    }

    private func playbackControls(player: ReferencePlayer) -> some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                if player.playing {
                    Button { player.pause() } label: { Label("Pause", systemImage: "pause.fill") }.primaryButton()
                } else {
                    Button { player.play() } label: {
                        Label(player.time > 0 && player.time < player.duration ? "Resume" : "Play", systemImage: "play.fill")
                    }
                    .primaryButton()
                }
                Button { player.replay() } label: { Label("Replay", systemImage: "arrow.counterclockwise") }.secondaryButton()
                Spacer(minLength: 0)
                Picker("Playback speed", selection: Binding(get: { player.speed }, set: { player.speed = $0 })) {
                    Text("Normal").tag(1.0)
                    Text("Slow").tag(0.5)
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 160)
            }
            HStack {
                Slider(value: Binding(get: { player.time }, set: { player.seek(to: $0) }), in: 0...max(1, player.duration))
                    .tint(.mcSage)
                    .accessibilityLabel("Animation progress")
                    .accessibilityValue("\(Int(player.progress * 100)) percent")
                Text(String(format: "%.1fs / %.1fs", player.time / 1000 / player.speed, player.duration / 1000 / player.speed))
                    .font(.footnote.monospacedDigit())
                    .foregroundStyle(Color.mcInkSoft)
            }
        }
    }

    private func stepControls(timeline: [Keyframe], activeIndex: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Button { go(to: activeIndex - 1, count: timeline.count) } label: { Label("Previous", systemImage: "chevron.left") }
                    .secondaryButton()
                    .disabled(activeIndex == 0)
                Spacer()
                Text("Step \(activeIndex + 1) of \(timeline.count)").font(.subheadline.bold()).foregroundStyle(Color.mcInkSoft)
                Spacer()
                Button { go(to: activeIndex + 1, count: timeline.count) } label: { Label("Next", systemImage: "chevron.right") }
                    .primaryButton()
                    .disabled(activeIndex == timeline.count - 1)
            }
            ForEach(Array(timeline.enumerated()), id: \.offset) { index, step in
                Button { go(to: index, count: timeline.count) } label: {
                    HStack(alignment: .top) {
                        Text("\(index + 1).").foregroundStyle(Color.mcInkSoft)
                        Text(step.caption) + Text(" (\(step.shape.label))").foregroundColor(.mcInkSoft)
                        Spacer(minLength: 0)
                    }
                    .font(.subheadline.weight(index == activeIndex ? .bold : .regular))
                    .padding(8)
                    .background(index == activeIndex ? Color.mcSageSoft : .clear, in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func go(to index: Int, count: Int) {
        stepIndex = max(0, min(count - 1, index))
        if stepIndex == count - 1 { model.player.markWatched() }
    }
}

struct LessonGuideCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let lesson = model.lesson
        VStack(alignment: .leading, spacing: 14) {
            Eyebrow(text: "How to say “\(lesson.text)”")
            Text(lesson.explanation).font(.title3)
            (Text("Tip: ").bold().foregroundColor(.mcSage) + Text(lesson.tip))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(Color.mcSageSoft.opacity(0.75), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            if let note = lesson.note {
                Label(note, systemImage: "info.circle")
                    .font(.footnote)
                    .padding(14)
                    .background(.white.opacity(0.45), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .glassCard()
    }
}

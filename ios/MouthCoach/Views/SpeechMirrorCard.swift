import Charts
import SwiftUI

struct RecognitionCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Eyebrow(text: "Transcript")
            if model.awaitingIntentConfirmation {
                Text("Whisper heard").font(.caption.bold()).foregroundStyle(Color.mcInkSoft)
                Text(model.mirrorResult?.asr?.text ?? "No clear words detected")
                    .font(.title3.bold())
                Text("Whisper can be wrong. Edit the text to match what you intended to say.")
                    .font(.subheadline).foregroundStyle(Color.mcInkSoft)
                TextField("What you meant to say", text: Binding(get: { model.recognizedDraft }, set: { model.recognizedDraft = $0 }))
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.sentences)
                Button("Confirm sentence", systemImage: "checkmark") {
                    Task { await model.confirmRecognizedText(model.recognizedDraft) }
                }
                .primaryButton()
                .disabled(model.mirrorLoading || model.recognizedDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            } else if !model.referenceText.isEmpty {
                Text("Confirmed sentence").font(.caption.bold()).foregroundStyle(Color.mcInkSoft)
                Text(model.referenceText).font(.title3.bold())
                Text("Swipe to Mouth Guide for the looping reference.")
                    .font(.subheadline).foregroundStyle(Color.mcInkSoft)
            } else {
                Text("Record a sentence. Whisper will propose a transcript automatically.")
                    .font(.subheadline).foregroundStyle(Color.mcInkSoft)
            }

            if model.mirrorLoading {
                ProgressView(model.awaitingIntentConfirmation
                             ? "Comparing your sentence…"
                             : "Recognizing speech… The first model load can take about a minute.")
                    .font(.subheadline)
            }
            if let error = model.mirrorError {
                Text(error).font(.subheadline).foregroundStyle(Color.mcAmberInk)
            }
            if model.recorder.recording?.url != nil && !model.mirrorLoading && !model.awaitingIntentConfirmation && model.mirrorResult == nil {
                Button(model.freeSpeechMode ? "Retry recognition" : "Analyze this practice", systemImage: "arrow.clockwise") {
                    Task {
                        if model.freeSpeechMode { await model.recognizeRecording() }
                        else { await model.analyzeRecording() }
                    }
                }
                .secondaryButton()
            }

            Text("Mac analysis service: \(SpeechMirrorService.baseURL.absoluteString)")
                .font(.caption).foregroundStyle(Color.mcInkSoft)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard()
    }
}

struct AnalysisResultCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Eyebrow(text: "Speech analysis")
            if model.awaitingIntentConfirmation {
                Text("Confirm your transcript on Practice to see the comparison.")
                    .font(.subheadline).foregroundStyle(Color.mcInkSoft)
            } else if let result = model.mirrorResult {
                section("Words") {
                    Text("Whisper heard: \(result.asr?.text ?? "No clear words")")
                    Text("You meant: \(model.referenceText)")
                    if let comparison = result.intent?.comparison {
                        Text(english(comparison, fallback: "Whisper's guess may differ from your confirmed words."))
                    }
                    Text("Whisper is a tentative guess, not a pronunciation score.")
                        .font(.caption).foregroundStyle(Color.mcInkSoft)
                }
                section("Voice measurements") {
                    Text(String(format: "Recording %.1f s · Voiced %.1f s", result.measurements.duration_s, result.measurements.voiced_duration_s))
                    Text(String(format: "Average level %.1f dBFS", result.measurements.rms_dbfs))
                    if let pitch = result.measurements.median_f0_hz {
                        Text(String(format: "Median pitch %.0f Hz", pitch))
                    }
                    Text(result.audio_quality.usable ? "Signal usable for comparison" : "Signal too weak for a reliable comparison")
                        .foregroundStyle(result.audio_quality.usable ? Color.mcSage : Color.mcAmberInk)
                }
                if !result.visual_data.pitch_trace.isEmpty {
                    section("Pitch trace") {
                        Chart(Array(result.visual_data.pitch_trace.enumerated()), id: \.offset) { point in
                            if let pitch = point.element.f0_hz {
                                LineMark(x: .value("Time", point.element.time_s), y: .value("Hz", pitch))
                            }
                        }
                        .frame(height: 120)
                    }
                }
                if !result.visual_data.volume_trace.isEmpty {
                    section("Volume trace") {
                        Chart(Array(result.visual_data.volume_trace.enumerated()), id: \.offset) { point in
                            if let level = point.element.dbfs {
                                LineMark(x: .value("Time", point.element.time_s), y: .value("dBFS", level))
                            }
                        }
                        .frame(height: 120)
                    }
                }
                section("Phoneme model") {
                    Text(result.phoneme_assessment.status == "tentative" ? "Tentative phoneme guess" : "Phoneme comparison has not run or was unavailable")
                    if !result.phoneme_assessment.target.isEmpty {
                        Text("Target: /\(result.phoneme_assessment.target.joined(separator: " "))/")
                    }
                    if let predicted = result.phoneme_assessment.predicted {
                        Text("Model heard: /\(predicted.joined(separator: " "))/")
                    }
                    ForEach(Array(result.phoneme_assessment.possible_substitutions.enumerated()), id: \.offset) { item in
                        Text("Possible \(item.element.type): \(item.element.expected ?? "—") → \(item.element.observed ?? "—")")
                    }
                    Text("Differences may reflect model error or accent; they are not a score.")
                        .font(.caption).foregroundStyle(Color.mcInkSoft)
                }
                if !result.phoneme_assessment.target.isEmpty && result.phoneme_assessment.status == "not_run" {
                    Button("Run experimental phoneme model", systemImage: "waveform") {
                        Task { await model.analyzePhonemes() }
                    }
                    .secondaryButton()
                    .disabled(model.phonemeLoading)
                }
                if model.phonemeLoading { ProgressView("The first phoneme model load may take a minute…") }
                if let error = model.phonemeError { Text(error).font(.subheadline).foregroundStyle(Color.mcAmberInk) }
                section(result.coach.source == "gemma_local" ? "Gemma suggestion" : "Practice suggestion") {
                    Text(english(result.coach.feedback,
                                 fallback: "Replay the recording, say one word separately, then return to the full sentence."))
                        .font(.body.weight(.semibold))
                    Text(english(result.coach.next_exercise,
                                 fallback: "Record the same sentence once more and compare."))
                        .font(.subheadline).foregroundStyle(Color.mcInkSoft)
                }
                if model.recorder.recording?.url != nil && !model.gemmaLoading {
                    Button("Ask Gemma for a suggestion", systemImage: "sparkles") {
                        Task { await model.generateGemma() }
                    }
                    .secondaryButton()
                }
                if model.gemmaLoading { ProgressView("Gemma is reviewing the measured evidence…") }
                if let error = model.gemmaError { Text(error).font(.subheadline).foregroundStyle(Color.mcAmberInk) }
                if let asr = result.performance.asr_ms {
                    Text("Processing: Whisper \(Int(asr)) ms"
                         + (result.performance.phoneme_ms.map { " · phonemes \(Int($0)) ms" } ?? "")
                         + (result.performance.gemma_ms.map { " · Gemma \(Int($0)) ms" } ?? ""))
                        .font(.caption).foregroundStyle(Color.mcInkSoft)
                }
            } else {
                Text("Record and confirm a sentence on Practice. Your results will appear here.")
                    .font(.subheadline).foregroundStyle(Color.mcInkSoft)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard()
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.headline).foregroundStyle(Color.mcSage)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.white.opacity(0.55), in: RoundedRectangle(cornerRadius: 16))
    }

    private func english(_ text: String, fallback: String) -> String {
        text.unicodeScalars.contains { (0x3400...0x9FFF).contains($0.value) } ? fallback : text
    }
}

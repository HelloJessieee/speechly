import Charts
import SwiftUI

struct RecognitionCard: View {
    @Environment(AppModel.self) private var model
    @State private var typedSentence = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Eyebrow(text: "Your words")
            if model.customReference {
                Text(model.referenceText).font(.title3.bold())
                Text("Your mouth guide is ready.").font(.subheadline).foregroundStyle(Color.mcInkSoft)
                Button("Start a new sentence") { model.startFreeSpeech() }.secondaryButton()
            } else {
                TextField("Type what you want to say", text: $typedSentence)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.sentences)
                    .submitLabel(.done)
                Button("Create mouth guide", systemImage: "mouth") {
                    Task { await model.createGuide(from: typedSentence) }
                }
                .primaryButton()
                .disabled(model.referenceLoading || typedSentence.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                if model.referenceLoading { ProgressView("Creating guide…") }
                if let error = model.referenceError { Text(error).font(.subheadline).foregroundStyle(Color.mcAmberInk) }
                Text("Or record below for a text guess.").font(.subheadline).foregroundStyle(Color.mcInkSoft)
            }
            if model.awaitingIntentConfirmation && !model.customReference {
                Text("Heard, approximately").font(.caption.bold()).foregroundStyle(Color.mcInkSoft)
                Text(model.mirrorResult?.asr?.text ?? "No clear words detected")
                    .font(.title3.bold())
                TextField("What you meant to say", text: Binding(get: { model.recognizedDraft }, set: { model.recognizedDraft = $0 }))
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.sentences)
                Button("Use these words", systemImage: "checkmark") {
                    Task { await model.confirmRecognizedText(model.recognizedDraft) }
                }
                .primaryButton()
                .disabled(model.mirrorLoading || model.recognizedDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            if model.mirrorLoading {
                ProgressView("Finding words…")
                    .font(.subheadline)
            }
            if model.fullAnalysisRunning && !model.mirrorLoading, let stage = model.analysisStage {
                ProgressView(stage).font(.subheadline)
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
            if model.mirrorLoading && !model.fullAnalysisRunning {
                ProgressView("Recognizing speech on your Mac…")
                    .font(.subheadline)
            }
            if model.fullAnalysisRunning, let stage = model.analysisStage {
                ProgressView(stage).font(.subheadline)
            }
            if let error = model.mirrorError {
                Text(error).font(.subheadline).foregroundStyle(Color.mcAmberInk)
            }
            if model.mirrorError == nil, let error = model.referenceError {
                Text(error).font(.subheadline).foregroundStyle(Color.mcAmberInk)
                if model.guideRecordingConfirmed && !model.referenceLoading {
                    Button("Retry mouth guide") { Task { await model.retryReference() } }
                        .secondaryButton()
                }
            }
            if !model.guideRecordingConfirmed {
                Text(model.customReference
                     ? "Record and confirm a take on Mouth Guide, or confirm your recorded sentence on Start."
                     : "Create a mouth guide on Start.")
                    .font(.subheadline).foregroundStyle(Color.mcInkSoft)
            } else if model.awaitingIntentConfirmation {
                Text("Whisper heard: \(model.mirrorResult?.asr?.text ?? "No clear words")")
                    .font(.subheadline.weight(.semibold))
                TextField("What you meant to say", text: Binding(get: { model.recognizedDraft },
                                                                  set: { model.recognizedDraft = $0 }))
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.sentences)
                Button("Confirm sentence", systemImage: "checkmark") {
                    Task { await model.confirmRecognizedText(model.recognizedDraft) }
                }
                .primaryButton()
                .disabled(model.recognizedDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            } else if let result = model.mirrorResult {
                section("Words") {
                    Text("Whisper heard: \(result.asr?.text ?? "No clear words")")
                    Text("You meant: \(model.referenceText)")
                    if let comparison = result.intent?.comparison {
                        Text(english(comparison, fallback: "Whisper's guess may differ from your confirmed words."))
                    }
                }
                if !ArticulationCoachView.cues(for: result.phoneme_assessment,
                                               referenceWords: model.referenceWordDetails).isEmpty {
                    section("3D articulation practice") {
                        ArticulationCoachView(assessment: result.phoneme_assessment,
                                              referenceWords: model.referenceWordDetails)
                    }
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
                if let visual = model.visualFeatures {
                    section("Mouth tracking") {
                        Text("Lips tracked in \(Int(visual.tracked_fraction * 100))% of sampled camera frames")
                        if let aperture = visual.median_aperture_ratio {
                            Text(String(format: "Median opening / mouth width: %.2f", aperture))
                        }
                    }
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
                    Text(result.phoneme_assessment.status == "tentative" ? "Tentative phoneme guess" :
                         result.phoneme_assessment.status == "not_run" && model.phonemeLoading ? "Phoneme comparison is running…" :
                         result.phoneme_assessment.status == "not_run" ? "Phoneme comparison has not run yet" :
                         "Phoneme comparison is unavailable")
                    if let source = result.phoneme_assessment.model {
                        Text(source).font(.caption).foregroundStyle(Color.mcInkSoft)
                    }
                    if !result.phoneme_assessment.target.isEmpty {
                        Text("Target: /\(result.phoneme_assessment.target.joined(separator: " "))/")
                    }
                    if let predicted = result.phoneme_assessment.predicted {
                        Text("Model heard: /\(predicted.joined(separator: " "))/")
                    }
                    ForEach(Array(result.phoneme_assessment.possible_substitutions.enumerated()), id: \.offset) { item in
                        Text("Possible \(item.element.type): \(item.element.expected ?? "—") → \(item.element.observed ?? "—")")
                    }
                    if let reason = result.phoneme_assessment.reason {
                        Text(english(reason, fallback: "The experimental phoneme model could not provide a reliable comparison."))
                            .font(.caption).foregroundStyle(Color.mcInkSoft)
                    }
                }
                if !model.fullAnalysisRunning && !result.phoneme_assessment.target.isEmpty && result.phoneme_assessment.status == "not_run" {
                    Button("Run experimental phoneme model", systemImage: "waveform") {
                        Task { await model.analyzePhonemes() }
                    }
                    .secondaryButton()
                    .disabled(model.phonemeLoading)
                }
                if model.phonemeLoading { ProgressView("The first phoneme model load may take a minute…") }
                if let error = model.phonemeError { Text(error).font(.subheadline).foregroundStyle(Color.mcAmberInk) }
                section(result.coach.source == "gemma_local" ? "How to improve · Gemma" : "How to improve") {
                    Text(english(result.coach.feedback,
                                 fallback: "Replay the recording, say one word separately, then return to the full sentence."))
                        .font(.body.weight(.semibold))
                    Text(english(result.coach.next_exercise,
                                 fallback: "Record the same sentence once more and compare."))
                        .font(.subheadline).foregroundStyle(Color.mcInkSoft)
                    if let reason = result.coach.reason {
                        Text(english(reason, fallback: "Gemma could not give a usable suggestion, so a measured fallback is shown."))
                            .font(.caption).foregroundStyle(Color.mcInkSoft)
                    }
                }
                if model.confirmedRecordingURL != nil && !model.gemmaLoading && !model.fullAnalysisRunning {
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
                Text(model.mirrorLoading || model.fullAnalysisRunning
                     ? "Your recording is saved. Results will appear here as each stage finishes."
                     : "Record and confirm a sentence on Practice. Your results will appear here.")
                    .font(.subheadline).foregroundStyle(Color.mcInkSoft)
            }
            if !model.fullAnalysisRunning && model.guideRecordingConfirmed &&
               model.confirmedRecordingURL != nil && !model.referenceText.isEmpty &&
               (model.mirrorResult?.intent?.confirmed_text == nil || model.mirrorError != nil) {
                Button("Retry full analysis", systemImage: "arrow.clockwise") {
                    Task { await model.analyzeConfirmedRecording() }
                }
                .secondaryButton()
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

import Foundation
import Observation

enum AnimationMode { case reference, correction }
enum PracticeMode { case off, live, demo }

/// App state and the practice flow: choose a lesson, watch, record, replay,
/// get feedback, correct and retry. Mirrors App.tsx in the web app.
@MainActor
@Observable
final class AppModel {
    let lessons: [Lesson] = LessonStore.loadBundled()

    var lessonId: LessonID = .seeMe
    var freeSpeechMode = true
    var animationMode: AnimationMode = .reference
    var practiceMode: PracticeMode = .off
    var lipOverlayMode: LipOverlayMode = .blue
    var referenceText = ""
    var referenceWordAtStep: [Int?] = []
    var referenceWords: [String] = []
    var referenceError: String?
    var referenceLoading = false
    var customReference = false
    var mirrorResult: SpeechMirrorResult?
    var mirrorError: String?
    var mirrorLoading = false
    var gemmaLoading = false
    var gemmaError: String?
    var phonemeLoading = false
    var phonemeError: String?
    var visualFeatures: SpeechMirrorVisualFeatures?
    var recognizedDraft = ""
    var awaitingIntentConfirmation = false

    var attempts: [LessonID: [PracticeAttempt]] = [:]
    var currentAttempt: PracticeAttempt?
    var feedback: PracticeFeedback?
    var feedbackLoading: FeedbackSource?
    var feedbackError: String?
    var claudeStatus = FeedbackAPIStatus(available: false, model: nil)

    let player = ReferencePlayer()
    let camera = CameraController()
    let recorder = AudioRecorder()
    let speech = SpeechPlayer()

    private let demoProvider = DemoFeedbackProvider()
    private var claudeProvider: ClaudeFeedbackProvider? { AppConfig.feedbackServerURL.map { ClaudeFeedbackProvider(baseURL: $0) } }
    @ObservationIgnored private var feedbackRequestID = 0
    @ObservationIgnored private var analysisID = 0

    init() {
        player.load([])
        recorder.onFinish = { [weak self] recording in self?.recordingFinished(recording) }
        Task {
            startCamera()
            await refreshClaudeStatus()
        }
    }

    var lesson: Lesson { lessons.first { $0.id == lessonId } ?? lessons[0] }

    // MARK: Lessons and animation

    func selectLesson(_ id: LessonID) {
        guard id != lessonId || freeSpeechMode else { return }
        resetPractice()
        speech.stop()
        freeSpeechMode = false
        lessonId = id
        customReference = false
        referenceText = lesson.text
        referenceWords = []
        referenceWordAtStep = []
        referenceError = nil
        setAnimationMode(.reference)
    }

    func startFreeSpeech() {
        resetPractice()
        freeSpeechMode = true
        customReference = false
        lipOverlayMode = .blue
        referenceText = ""
        referenceWords = []
        referenceWordAtStep = []
        referenceError = nil
        recognizedDraft = ""
        awaitingIntentConfirmation = false
        player.load([])
        if practiceMode == .off { startCamera() }
    }

    func setAnimationMode(_ mode: AnimationMode) {
        animationMode = mode
        if mode == .correction || !customReference {
            player.load(mode == .correction ? lesson.correction.timeline : lesson.timeline)
            if mode == .reference { player.play() }
        }
    }

    var currentReferenceWord: String? {
        if freeSpeechMode && !customReference { return nil }
        if customReference {
            let index = player.timeline.lastIndex { $0.at <= player.time } ?? 0
            guard index < referenceWordAtStep.count, let wordIndex = referenceWordAtStep[index], wordIndex < referenceWords.count else { return nil }
            return referenceWords[wordIndex]
        }
        if lessonId == .seeMe { return player.time < 2450 ? "See" : player.time < 4500 ? "me" : nil }
        return player.time < player.duration - 250 ? lesson.text : nil
    }

    func loadSentence(_ text: String) async {
        let phrase = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !phrase.isEmpty, phrase.count <= 160 else {
            referenceError = "Enter 1–25 English words, up to 160 characters."
            return
        }
        referenceLoading = true
        referenceError = nil
        defer { referenceLoading = false }
        do {
            let reference = try await SpeechMirrorService.shared.reference(for: phrase)
            let animation = reference.animation()
            customReference = true
            freeSpeechMode = true
            referenceText = reference.text
            referenceWords = reference.words.map(\.text)
            referenceWordAtStep = animation.wordAtStep
            animationMode = .reference
            player.load(animation.timeline)
            lipOverlayMode = .both
            player.play()
        } catch {
            referenceError = error.localizedDescription
        }
    }

    // MARK: Practice

    func startCamera() {
        practiceMode = .live
        if !player.playing { player.play() }
        Task {
            await camera.start()
            await recorder.requestPermission()
        }
    }

    func startDemo() {
        camera.stop()
        recorder.discard()
        practiceMode = .demo
    }

    func stopPractice() {
        camera.stop()
        resetPractice()
        practiceMode = .off
    }

    func startRecording() {
        resetPractice()
        camera.beginCapture()
        recorder.start(simulated: practiceMode == .demo)
    }

    func stopRecording() {
        recorder.stop()
    }

    private func recordingFinished(_ recording: AudioRecorder.Recording?) {
        let requestID = analysisID
        Task {
            let frames = await camera.endCapture()
            guard requestID == analysisID else { return }
            guard let recording else { return }
            let history = attempts[lessonId] ?? []
            let attempt = PracticeAttempt(
                id: "\(lessonId.rawValue)-\(Int(Date().timeIntervalSince1970 * 1000))",
                lessonId: lessonId,
                attemptNumber: history.count + 1,
                source: recording.url == nil ? .demo : .recording,
                durationMs: recording.duration * 1000,
                createdAt: Date(),
                analysis: frames.isEmpty ? nil : summarizeCapture(frames, lesson: lesson)
            )
            attempts[lessonId, default: []].append(attempt)
            currentAttempt = attempt
            visualFeatures = SpeechMirrorVisualFeatures(frames: frames)
            feedback = nil
            feedbackError = nil
            mirrorResult = nil
            mirrorError = nil
            if freeSpeechMode, recording.url != nil { await recognizeRecording() }
        }
    }

    func resetPractice() {
        feedbackRequestID += 1
        analysisID += 1
        recorder.discard()
        currentAttempt = nil
        feedback = nil
        feedbackLoading = nil
        feedbackError = nil
        mirrorResult = nil
        mirrorError = nil
        mirrorLoading = false
        gemmaLoading = false
        gemmaError = nil
        phonemeLoading = false
        phonemeError = nil
        visualFeatures = nil
        recognizedDraft = ""
        awaitingIntentConfirmation = false
    }

    func recognizeRecording() async {
        guard let url = recorder.recording?.url else { return }
        let requestID = analysisID
        mirrorLoading = true
        mirrorError = nil
        awaitingIntentConfirmation = false
        defer { if requestID == analysisID { mirrorLoading = false } }
        do {
            let result = try await SpeechMirrorService.shared.analyze(recordingURL: url, visualFeatures: visualFeatures)
            guard requestID == analysisID else { return }
            mirrorResult = result
            recognizedDraft = result.asr?.text ?? ""
            awaitingIntentConfirmation = true
        } catch {
            guard requestID == analysisID else { return }
            mirrorError = error.localizedDescription
        }
    }

    func confirmRecognizedText(_ text: String) async {
        let intended = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !intended.isEmpty else {
            mirrorError = "Enter the English words you meant to say. You can correct Whisper's guess."
            return
        }
        mirrorError = nil
        await loadSentence(intended)
        guard customReference, referenceError == nil else {
            mirrorError = referenceError ?? "Could not create a mouth guide for this sentence."
            return
        }
        awaitingIntentConfirmation = false
        mirrorResult = nil
        await analyzeRecording()
    }

    func analyzeRecording() async {
        guard let url = recorder.recording?.url else { return }
        let requestID = analysisID
        mirrorLoading = true
        mirrorError = nil
        defer { if requestID == analysisID { mirrorLoading = false } }
        do {
            let result = try await SpeechMirrorService.shared.analyze(recordingURL: url, intendedText: referenceText,
                                                                       visualFeatures: visualFeatures)
            guard requestID == analysisID else { return }
            mirrorResult = result
        } catch {
            guard requestID == analysisID else { return }
            mirrorError = error.localizedDescription
        }
    }

    func generateGemma() async {
        guard let url = recorder.recording?.url, !referenceText.isEmpty else { return }
        let requestID = analysisID
        gemmaLoading = true
        gemmaError = nil
        defer { if requestID == analysisID { gemmaLoading = false } }
        do {
            var result = try await SpeechMirrorService.shared.analyze(recordingURL: url, intendedText: referenceText,
                                                                       includeGemma: true, visualFeatures: visualFeatures)
            guard requestID == analysisID else { return }
            if let previous = mirrorResult, previous.phoneme_assessment.status != "not_run" {
                result.phoneme_assessment = previous.phoneme_assessment
                result.performance.phoneme_ms = previous.performance.phoneme_ms
            }
            mirrorResult = result
        } catch {
            guard requestID == analysisID else { return }
            gemmaError = error.localizedDescription
        }
    }

    func analyzePhonemes() async {
        guard let url = recorder.recording?.url, !referenceText.isEmpty else { return }
        let requestID = analysisID
        phonemeLoading = true
        phonemeError = nil
        defer { if requestID == analysisID { phonemeLoading = false } }
        do {
            var result = try await SpeechMirrorService.shared.analyze(recordingURL: url, intendedText: referenceText,
                                                                       includePhonemes: true, visualFeatures: visualFeatures)
            guard requestID == analysisID else { return }
            if let previous = mirrorResult, previous.coach.source == "gemma_local" {
                result.coach = previous.coach
                result.performance.gemma_ms = previous.performance.gemma_ms
            }
            mirrorResult = result
        } catch {
            guard requestID == analysisID else { return }
            phonemeError = error.localizedDescription
        }
    }

    // MARK: Feedback

    func refreshClaudeStatus() async {
        guard let claudeProvider else { return }
        claudeStatus = await claudeProvider.status()
    }

    /// Why Claude feedback can't be used for the current attempt, if it can't.
    var claudeUnavailableReason: String? {
        if claudeProvider == nil || !claudeStatus.available { return "Claude feedback is not set up. Start the MouthCoach server with an API key." }
        guard let analysis = currentAttempt?.analysis else { return "Claude feedback needs the camera on while you record." }
        if !analysis.usable { return "Your face was not visible clearly enough. Center your face and try again." }
        return nil
    }

    func requestFeedback(_ source: FeedbackSource) {
        guard let attempt = currentAttempt else { return }
        feedbackRequestID += 1
        let requestID = feedbackRequestID
        feedbackLoading = source
        feedbackError = nil
        let request = FeedbackRequest(lesson: lesson, attempt: attempt, history: (attempts[lessonId] ?? []).filter { $0.id != attempt.id })
        let provider: FeedbackProvider
        if source == .claude, let claudeProvider { provider = claudeProvider } else { provider = demoProvider }
        Task {
            do {
                let result = try await provider.evaluate(request)
                guard requestID == feedbackRequestID else { return }
                feedback = result
            } catch {
                guard requestID == feedbackRequestID else { return }
                feedbackError = error.localizedDescription
            }
            if requestID == feedbackRequestID { feedbackLoading = nil }
        }
    }

    func runAction(_ action: ActionID) {
        switch action.behavior {
        case .resetPractice:
            resetPractice()
        case .replayReference:
            player.speed = 0.5
            fallthrough
        case .showCorrection:
            setAnimationMode(.correction)
            player.replay()
        }
    }

    /// Index of the current step in the six-step practice flow.
    var currentStep: Int {
        if feedback != nil { return animationMode == .correction ? 5 : 4 }
        if currentAttempt != nil { return 3 }
        return player.watched ? 2 : 1
    }
}

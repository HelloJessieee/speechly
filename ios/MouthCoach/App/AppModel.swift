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

    var lessonId: LessonID = .me
    var animationMode: AnimationMode = .reference
    var practiceMode: PracticeMode = .off

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

    init() {
        player.load(lesson.timeline)
        recorder.onFinish = { [weak self] recording in self?.recordingFinished(recording) }
        Task { await refreshClaudeStatus() }
    }

    var lesson: Lesson { lessons.first { $0.id == lessonId } ?? lessons[0] }

    // MARK: Lessons and animation

    func selectLesson(_ id: LessonID) {
        guard id != lessonId else { return }
        resetPractice()
        speech.stop()
        lessonId = id
        setAnimationMode(.reference)
    }

    func setAnimationMode(_ mode: AnimationMode) {
        animationMode = mode
        player.load(mode == .correction ? lesson.correction.timeline : lesson.timeline)
    }

    // MARK: Practice

    func startCamera() {
        practiceMode = .live
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
        camera.beginCapture()
        recorder.start(simulated: practiceMode == .demo)
    }

    func stopRecording() {
        recorder.stop()
    }

    private func recordingFinished(_ recording: AudioRecorder.Recording?) {
        Task {
            let frames = await camera.endCapture()
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
            feedback = nil
            feedbackError = nil
        }
    }

    func resetPractice() {
        feedbackRequestID += 1
        recorder.discard()
        currentAttempt = nil
        feedback = nil
        feedbackLoading = nil
        feedbackError = nil
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

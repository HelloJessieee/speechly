import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

// Feedback providers. The iOS app never holds the Claude API key: Claude
// feedback goes through the same server route as the web app
// (POST /api/feedback, see server/ in the repository).

/// Maps feedback action IDs to predefined app behaviors.
enum ActionBehavior { case replayReference, showCorrection, resetPractice }

extension ActionID {
    var behavior: ActionBehavior {
        switch self {
        case .replayReference: return .replayReference
        case .practiceLipClosure, .practiceRoundedShape, .practiceLipTeethPosition: return .showCorrection
        case .recordAgain: return .resetPractice
        }
    }

    var label: String { self == .recordAgain ? "Try again" : "Watch the guidance" }
}

struct FeedbackRequest {
    var lesson: Lesson
    var attempt: PracticeAttempt
    /// Earlier attempts for the same lesson, oldest first.
    var history: [PracticeAttempt]
}

protocol FeedbackProvider {
    func evaluate(_ request: FeedbackRequest) async throws -> PracticeFeedback
}

/// Deterministic scripted feedback. It does not look at the attempt: the first
/// attempt gets the lesson's suggestion, later ones show an acknowledgement.
struct DemoFeedbackProvider: FeedbackProvider {
    var delay: Duration = .milliseconds(600)

    func evaluate(_ request: FeedbackRequest) async throws -> PracticeFeedback {
        let followUp = !request.history.isEmpty
        let content = followUp ? request.lesson.demoFeedback.acknowledgement : request.lesson.demoFeedback.suggestion
        try await Task.sleep(for: delay)
        return PracticeFeedback(
            source: .demo,
            lessonId: request.lesson.id,
            status: followUp ? .acknowledged : .suggestion,
            practiceFocus: content.practiceFocus,
            tip: content.tip,
            actionId: followUp ? .recordAgain : request.lesson.correction.actionId,
            isIllustrative: true,
            scenarioLabel: followUp ? "Example 2 of 2: acknowledging a change" : "Example 1 of 2: a corrective suggestion",
            attemptId: request.attempt.id
        )
    }
}

// MARK: - Claude feedback through the MouthCoach server

/// Measurements without snapshots, for the previous attempt.
struct AnalysisSummary: Codable {
    var faceVisible: Double
    var frames: Int
    var durationSeconds: Double
    var speech: SpeechRange?
    var rest: RestShape
    var checks: [VisualCheck]
    var timeline: [MouthSample]
    var usable: Bool

    init(_ a: MouthAnalysis) {
        faceVisible = a.faceVisible; frames = a.frames; durationSeconds = a.durationSeconds; speech = a.speech
        rest = a.rest; checks = a.checks; timeline = a.timeline; usable = a.usable
    }
}

struct FeedbackAPIRequest: Codable {
    var lessonId: LessonID
    var attemptId: String
    var attemptNumber: Int
    var analysis: MouthAnalysis
    var previous: AnalysisSummary?
}

private struct FeedbackAPIResponse: Decodable {
    var ok: Bool
    var feedback: PracticeFeedback?
    var error: String?
}

struct FeedbackAPIStatus: Decodable {
    var available: Bool
    var model: String?
}

struct FeedbackServiceError: LocalizedError {
    var message: String
    var errorDescription: String? { message }
}

struct ClaudeFeedbackProvider: FeedbackProvider {
    /// Base URL of the MouthCoach server, e.g. http://192.168.1.20:5173.
    var baseURL: URL
    var session: URLSession = .shared

    static func makeRequest(_ request: FeedbackRequest) throws -> FeedbackAPIRequest {
        guard let analysis = request.attempt.analysis, analysis.usable else {
            throw FeedbackServiceError(message: "No usable mouth measurements for this attempt.")
        }
        let previous = request.history.last { $0.analysis?.usable == true }?.analysis
        return FeedbackAPIRequest(
            lessonId: request.lesson.id,
            attemptId: request.attempt.id,
            attemptNumber: request.attempt.attemptNumber,
            analysis: analysis,
            previous: previous.map(AnalysisSummary.init)
        )
    }

    func evaluate(_ request: FeedbackRequest) async throws -> PracticeFeedback {
        var urlRequest = URLRequest(url: baseURL.appendingPathComponent("api/feedback"))
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.timeoutInterval = 90
        urlRequest.httpBody = try JSONEncoder().encode(Self.makeRequest(request))

        let data: Data
        do {
            (data, _) = try await session.data(for: urlRequest)
        } catch {
            throw FeedbackServiceError(message: "Could not reach the MouthCoach server.")
        }
        guard let response = try? JSONDecoder().decode(FeedbackAPIResponse.self, from: data) else {
            throw FeedbackServiceError(message: "The server returned an unreadable reply.")
        }
        guard response.ok, let feedback = response.feedback else {
            throw FeedbackServiceError(message: response.error ?? "Feedback is unavailable right now.")
        }
        return feedback
    }

    func status() async -> FeedbackAPIStatus {
        let url = baseURL.appendingPathComponent("api/feedback/status")
        guard let (data, _) = try? await session.data(from: url),
              let status = try? JSONDecoder().decode(FeedbackAPIStatus.self, from: data)
        else { return FeedbackAPIStatus(available: false, model: nil) }
        return status
    }
}

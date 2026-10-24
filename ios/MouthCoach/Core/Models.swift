import Foundation

// Domain types shared by every layer of the app. Property names and raw values
// match the web app's TypeScript types (src/types.ts), so lessons.json and the
// /api/feedback JSON decode without custom keys.

enum LessonID: String, Codable, CaseIterable, Hashable {
    case me, moon, fish, pea, bee
    case seeMe = "see-me"
}

/// Reusable, visible mouth states used by the reference illustration.
enum MouthShapeID: String, Codable, CaseIterable {
    case rest, closed, open, spread, rounded, lipTeeth, teethTogether

    var label: String {
        switch self {
        case .rest: return "Rest"
        case .closed: return "Closed lips"
        case .open: return "Open mouth"
        case .spread: return "Spread lips"
        case .rounded: return "Rounded lips"
        case .lipTeeth: return "Lower lip to upper teeth"
        case .teethTogether: return "Teeth close, lips spread"
        }
    }
}

struct Keyframe: Codable, Hashable {
    /// Milliseconds from the start of the timeline at normal speed.
    var at: Double
    var shape: MouthShapeID
    var caption: String
    var sound: String?
}

enum ActionID: String, Codable, CaseIterable {
    case replayReference = "replay_reference"
    case practiceLipClosure = "practice_lip_closure"
    case practiceRoundedShape = "practice_rounded_shape"
    case practiceLipTeethPosition = "practice_lip_teeth_position"
    case recordAgain = "record_again"
}

enum HighlightRegion: String, Codable { case upperLip, lowerLip, bothLips, corners }
enum ArrowDirection: String, Codable { case close, inward, lowerLipUp, spread }

struct CorrectionGuide: Codable {
    var actionId: ActionID
    var instruction: String
    var timeline: [Keyframe]
    var targetShape: MouthShapeID
    var highlight: HighlightRegion?
    var arrows: [ArrowDirection]?
}

struct FeedbackContent: Codable {
    var practiceFocus: String
    var tip: String
}

struct DemoFeedbackContent: Codable {
    var suggestion: FeedbackContent
    var acknowledgement: FeedbackContent
}

/// Visible movements that can be measured from face landmarks.
enum VisualCheckID: String, Codable {
    case closure, rounding, spread, lipTeeth

    var title: String {
        switch self {
        case .closure: return "Lip closure"
        case .rounding: return "Rounded lips"
        case .spread: return "Spread lips"
        case .lipTeeth: return "Lower lip to upper teeth"
        }
    }
}

struct Lesson: Codable, Identifiable {
    struct Pronunciation: Codable { var respelling: String; var ipa: String }
    struct Target: Codable { var label: String; var description: String }

    var id: LessonID
    var text: String
    var pronunciation: Pronunciation
    var explanation: String
    var target: Target
    var timeline: [Keyframe]
    var tip: String
    var note: String?
    var correction: CorrectionGuide
    var demoFeedback: DemoFeedbackContent
    var visualChecks: [VisualCheckID]
}

// MARK: - Mouth analysis

enum CheckResult: String, Codable {
    case detected
    case unclear
    case notDetected = "not_detected"

    var label: String {
        switch self {
        case .detected: return "Seen"
        case .unclear: return "Unclear"
        case .notDetected: return "Not seen"
        }
    }
}

struct VisualCheck: Codable, Hashable {
    var id: VisualCheckID
    var result: CheckResult
    var summary: String
    var atSeconds: Double?
    var value: Double?
}

struct MouthSample: Codable, Hashable {
    var t: Double
    var opening: Double
    var width: Double
    var lowerLip: Double
    var protrusion: Double
}

struct MouthSnapshot: Codable, Hashable {
    var label: String
    var t: Double
    /// JPEG data URL of a mouth-only crop (unmirrored).
    var dataUrl: String
}

struct SpeechRange: Codable, Hashable { var start: Double; var end: Double }
struct RestShape: Codable, Hashable { var opening: Double; var widthFaceUnits: Double }

struct MouthAnalysis: Codable, Hashable {
    var faceVisible: Double
    var frames: Int
    var durationSeconds: Double
    var speech: SpeechRange?
    var rest: RestShape
    var checks: [VisualCheck]
    var timeline: [MouthSample]
    var snapshots: [MouthSnapshot]
    var usable: Bool
}

// MARK: - Attempts and feedback

enum AttemptSource: String, Codable { case recording, demo }

struct PracticeAttempt: Identifiable {
    var id: String
    var lessonId: LessonID
    var attemptNumber: Int
    var source: AttemptSource
    var durationMs: Double
    var createdAt: Date
    var analysis: MouthAnalysis?
}

enum FeedbackStatus: String, Codable {
    case suggestion, acknowledged
    case onTrack = "on_track"
    case insufficientData = "insufficient_data"

    var label: String {
        switch self {
        case .onTrack: return "On track"
        case .suggestion: return "Something to try"
        case .acknowledged: return "Change noticed"
        case .insufficientData: return "Not enough to go on"
        }
    }
}

enum FeedbackSource: String, Codable { case demo, claude }

struct PracticeFeedback: Codable {
    var source: FeedbackSource
    var lessonId: LessonID
    var status: FeedbackStatus
    var practiceFocus: String
    var tip: String
    var actionId: ActionID
    var isIllustrative: Bool
    var scenarioLabel: String?
    var observation: String?
    var evidence: [String]?
    var comparedToPrevious: String?
    var model: String?
    var attemptId: String
}

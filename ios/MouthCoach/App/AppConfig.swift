import Foundation

enum AppConfig {
    /// Base URL of the MouthCoach server that calls Claude (Info.plist key
    /// `MouthCoachFeedbackServerURL`). The API key lives on that server only.
    static var feedbackServerURL: URL? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "MouthCoachFeedbackServerURL") as? String,
              !value.isEmpty
        else { return nil }
        return URL(string: value)
    }
}

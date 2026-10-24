import Foundation

/// Loads the lessons exported from the web app (`npm run export:lessons`).
enum LessonStore {
    static func decode(_ data: Data) throws -> [Lesson] {
        try JSONDecoder().decode([Lesson].self, from: data)
    }

    static func loadBundled(bundle: Bundle = .main) -> [Lesson] {
        guard let url = bundle.url(forResource: "lessons", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let lessons = try? decode(data)
        else {
            assertionFailure("lessons.json is missing or invalid. Run `npm run export:lessons`.")
            return []
        }
        return lessons
    }
}

extension Array where Element == Keyframe {
    /// Length of a timeline in milliseconds at normal speed.
    var duration: Double { last?.at ?? 0 }
}

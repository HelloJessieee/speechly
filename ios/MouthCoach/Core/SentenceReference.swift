import Foundation

struct ReferenceWord: Decodable {
    var text: String
    var phones: [String]
}

struct SentenceReference: Decodable {
    var text: String
    var words: [ReferenceWord]

    /// Keeps the repository's seven existing mouth shapes and timeline player.
    func animation() -> (timeline: [Keyframe], wordAtStep: [Int?]) {
        var timeline = [Keyframe(at: 0, shape: .rest, caption: "Get ready", sound: nil)]
        var wordAtStep: [Int?] = [nil]
        var time = 180.0
        for (index, word) in words.enumerated() {
            for phone in word.phones {
                timeline.append(Keyframe(at: time, shape: Self.shape(for: phone),
                                         caption: word.text, sound: "/\(phone)/"))
                wordAtStep.append(index)
                let normalized = phone.replacingOccurrences(of: "ː", with: "")
                time += normalized.rangeOfCharacter(from: CharacterSet(charactersIn: "aeiouɑæɪʊɔəɚɝɛ")) == nil ? 130 : 210
            }
            time += 80
        }
        timeline.append(Keyframe(at: time + 220, shape: .rest, caption: "Sentence complete — replaying", sound: nil))
        wordAtStep.append(nil)
        return (timeline, wordAtStep)
    }

    private static func shape(for phone: String) -> MouthShapeID {
        let p = phone.replacingOccurrences(of: "ː", with: "")
        if p.hasPrefix("p") || p.hasPrefix("b") || p.hasPrefix("m") { return .closed }
        if p.hasPrefix("f") || p.hasPrefix("v") { return .lipTeeth }
        if p.hasPrefix("u") || p.hasPrefix("ʊ") || p.hasPrefix("o") || p.hasPrefix("ɔ") || p.hasPrefix("w") { return .rounded }
        if p.hasPrefix("a") || p.hasPrefix("ɑ") || p.hasPrefix("æ") || p.hasPrefix("ɒ") || p.hasPrefix("ʌ") { return .open }
        if p.hasPrefix("i") || p.hasPrefix("ɪ") || p.hasPrefix("e") || p.hasPrefix("ɛ") || p.hasPrefix("ə") { return .spread }
        if p.hasPrefix("s") || p.hasPrefix("z") || p.hasPrefix("θ") || p.hasPrefix("ð") { return .teethTogether }
        if p.hasPrefix("ʃ") || p.hasPrefix("ʒ") || p.hasPrefix("tʃ") || p.hasPrefix("dʒ") || p.hasPrefix("ɹ") { return .rounded }
        return .rest
    }
}

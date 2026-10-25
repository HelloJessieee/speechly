import SwiftUI
import WebKit

/// A visual target pose from Articulation Studio. The model's phoneme guess is
/// tentative, so this view never treats the pose as a diagnosis of the learner.
struct ArticulationCoachView: View {
    let assessment: SpeechMirrorResult.Phone
    let referenceWords: [ReferenceWord]
    @State private var selectedID = ""
    @State private var selectedWordIndex = -1
    @State private var sideView = false
    @State private var focusedSound = false
    @State private var replayID = 0

    var body: some View {
        let cues = Self.cues(for: assessment, referenceWords: referenceWords)
        let suggestedPhone = assessment.possible_substitutions.compactMap(\.expected).first
        let suggestedWordIndex = referenceWords.firstIndex { word in
            suggestedPhone.map { word.phones.contains($0) } ?? false
        } ?? 0
        let wordIndex = selectedWordIndex >= 0 ? selectedWordIndex : suggestedWordIndex
        let word = referenceWords.indices.contains(wordIndex) ? referenceWords[wordIndex] : nil
        let wordVisemes = word?.phones.compactMap { ArticulationCue(phone: $0)?.viseme } ?? []
        if let selected = cues.first(where: { $0.id == selectedID }) ?? cues.first {
            VStack(alignment: .leading, spacing: 10) {
                Text(!focusedSound && !wordVisemes.isEmpty
                     ? "Watch the target movement for “\(word?.text ?? "")”."
                     : "See the target mouth shape for /\(selected.phone)/.")
                    .font(.subheadline.weight(.semibold))
                ArticulationModelView(visemes: !focusedSound && !wordVisemes.isEmpty ? wordVisemes : [selected.viseme],
                                      playSequence: !focusedSound && !wordVisemes.isEmpty,
                                      replayID: replayID, sideView: sideView)
                    .frame(height: 230)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .accessibilityLabel("3D target articulation animation. Drag to rotate the model.")
                Text("Drag the 3D model to rotate it.")
                    .font(.caption).foregroundStyle(Color.mcInkSoft)
                if !referenceWords.isEmpty {
                    ScrollView(.horizontal) {
                        HStack(spacing: 8) {
                            ForEach(Array(referenceWords.enumerated()), id: \.offset) { item in
                                Button(item.element.text) {
                                    selectedWordIndex = item.offset
                                    focusedSound = false
                                    replayID += 1
                                }
                                .buttonStyle(.bordered)
                                .tint(!focusedSound && wordIndex == item.offset ? Color.mcSage : Color.mcInkSoft)
                            }
                        }
                    }
                }
                if assessment.status == "tentative",
                   let difference = assessment.possible_substitutions.first,
                   let expected = difference.expected {
                    Text("Possible difference: target /\(expected)/, model heard /\(difference.observed ?? "—")/. Watch the target movement, then replay your recording.")
                        .font(.caption).foregroundStyle(Color.mcAmberInk)
                }
                Text("Practice one sound")
                    .font(.caption.bold()).foregroundStyle(Color.mcInkSoft)
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(cues) { cue in
                            Button("/\(cue.phone)/") {
                                selectedID = cue.id
                                focusedSound = true
                                replayID += 1
                            }
                                .buttonStyle(.bordered)
                                .tint(focusedSound && cue.id == selected.id ? Color.mcSage : Color.mcInkSoft)
                        }
                    }
                }
                HStack {
                    Text(focusedSound ? selected.tip : "Replay the movement, say the word slowly, then return to the sentence.")
                        .font(.subheadline)
                    Spacer(minLength: 6)
                    Button("Replay") { replayID += 1 }
                        .buttonStyle(.bordered)
                    Button(sideView ? "Front" : "Side") { sideView.toggle() }
                        .buttonStyle(.bordered)
                }
                Text("Illustrative pose only. The camera cannot measure your tongue or teeth, and one mouth shape can represent several sounds.")
                    .font(.caption).foregroundStyle(Color.mcInkSoft)
            }
        }
    }

    static func cues(for assessment: SpeechMirrorResult.Phone,
                     referenceWords: [ReferenceWord] = []) -> [ArticulationCue] {
        let possible = assessment.status == "tentative"
            ? assessment.possible_substitutions.compactMap(\.expected) : []
        var seen = Set<String>()
        let referencePhones = referenceWords.flatMap(\.phones)
        return (possible + assessment.target + referencePhones).compactMap { phone in
            guard let cue = ArticulationCue(phone: phone), seen.insert(cue.viseme).inserted else { return nil }
            return cue
        }.prefix(5).map { $0 }
    }
}

struct ArticulationCue: Identifiable {
    let phone: String
    let viseme: String
    let tip: String
    var id: String { viseme }

    init?(phone: String) {
        let clean = phone.replacingOccurrences(of: "ˈ", with: "")
            .replacingOccurrences(of: "ˌ", with: "")
        self.phone = phone
        switch clean {
        case "m", "p", "b":
            viseme = "m"; tip = "Bring both lips together, then release for /p/ or /b/."
        case "f", "v":
            viseme = "fv"; tip = "Bring your lower lip gently toward your upper teeth."
        case "θ", "ð":
            viseme = "th"; tip = "Let the tongue tip come forward gently between the teeth."
        case "t", "d", "n":
            viseme = "l"; tip = "Lift the tongue tip behind the upper teeth. Release it for /t/ or /d/."
        case "ɾ":
            viseme = "l"; tip = "Touch the tongue tip briefly behind the upper teeth."
        case "l":
            viseme = "l"; tip = "Lift the tongue tip toward the ridge behind the upper teeth."
        case "ɹ", "r":
            viseme = "r"; tip = "Draw the tongue back slightly without touching the roof of the mouth."
        case "k", "g", "ŋ":
            viseme = "kg"; tip = "Raise the back of the tongue toward the soft palate."
        case "w":
            viseme = "oo"; tip = "Round the lips briefly, then release into the next sound."
        case "j":
            viseme = "ee"; tip = "Spread the lips slightly as the tongue moves toward the next vowel."
        case "s", "z":
            viseme = "sz"; tip = "Keep the mouth narrow and the teeth near each other."
        case "ʃ", "ʒ", "tʃ", "dʒ":
            viseme = "sh"; tip = "Round the lips slightly for this sound."
        case "i", "iː":
            viseme = "ee"; tip = "Spread the lips gently with a small opening."
        case "ɪ":
            viseme = "ih"; tip = "Use a small opening with relaxed lips."
        case "ɛ", "e", "æ", "ə", "ɜ", "ɜː", "ɚ", "ɝ":
            viseme = "eh"; tip = "Open the jaw partway and keep the lips relaxed."
        case "ɑ", "ɑː", "a", "aː", "ʌ":
            viseme = "aa"; tip = "Open the jaw wider and relax the lips."
        case "aɪ":
            viseme = "ay"; tip = "Start open, then glide toward a smaller, wider mouth shape."
        case "eɪ":
            viseme = "ey"; tip = "Start half open, then glide toward a wider smile shape."
        case "aʊ":
            viseme = "aw"; tip = "Start open, then round the lips during the glide."
        case "o", "oʊ", "ɔ", "ɔː":
            viseme = "oh"; tip = "Round the lips with a medium jaw opening."
        case "u", "uː", "ʊ":
            viseme = "oo"; tip = "Round the lips more tightly with a small opening."
        default:
            return nil
        }
    }
}

private struct ArticulationModelView: UIViewRepresentable {
    let visemes: [String]
    let playSequence: Bool
    let replayID: Int
    let sideView: Bool

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let view = WKWebView(frame: .zero)
        view.isOpaque = false
        view.backgroundColor = UIColor(red: 0.933, green: 0.953, blue: 0.929, alpha: 1)
        view.scrollView.isScrollEnabled = false
        view.navigationDelegate = context.coordinator
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "ArticulationStudio") {
            view.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        context.coordinator.visemes = visemes
        context.coordinator.playSequence = playSequence
        context.coordinator.replayID = replayID
        context.coordinator.sideView = sideView
        context.coordinator.apply(to: view)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var visemes = ["neutral"]
        var playSequence = false
        var replayID = 0
        var sideView = false
        private var loaded = false
        private var lastApplied: String?

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            loaded = true
            lastApplied = nil
            apply(to: webView)
        }

        func apply(to webView: WKWebView) {
            guard loaded else { return }
            let direction = sideView ? "side" : "front"
            let data = (try? JSONSerialization.data(withJSONObject: visemes)) ?? Data("[]".utf8)
            let ids = String(data: data, encoding: .utf8) ?? "[]"
            let selection = "\(ids):\(playSequence):\(replayID):\(direction)"
            guard selection != lastApplied else { return }
            lastApplied = selection
            let script = """
                (() => {
                const ids = \(ids);
                const play = () => {
                  window.speechlySetView('\(direction)');
                  if (\(playSequence ? "true" : "false")) window.speechlyPlaySequence(ids);
                  else window.speechlySetViseme(ids[0] || 'neutral');
                };
                if (window.speechlyReady) {
                  play();
                } else {
                  window.addEventListener('speechly-ready', play, { once: true });
                }
                })();
                """
            webView.evaluateJavaScript(script, completionHandler: nil)
        }
    }
}

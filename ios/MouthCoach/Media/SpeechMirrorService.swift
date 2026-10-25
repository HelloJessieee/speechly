import Foundation

enum SpeechMirrorServiceError: LocalizedError {
    case invalidURL, server(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: "Enter a complete Mac service address."
        case .server(let detail): detail
        }
    }
}

/// Uses the Mac's local Speech Mirror pipeline for Whisper, phonemes and Gemma.
final class SpeechMirrorService {
    static let shared = SpeechMirrorService()
    private init() {}
    private let wavCache = RecordingWAVCache()

    static var baseURL: URL {
        get {
            let saved = UserDefaults.standard.string(forKey: "SpeechMirrorServerURL")
            return URL(string: saved ?? "") ?? URL(string: "http://192.168.0.160:8765")!
        }
        set { UserDefaults.standard.set(newValue.absoluteString, forKey: "SpeechMirrorServerURL") }
    }

    private let session: URLSession = {
        let configuration = URLSessionConfiguration.default
        // The first request can load Whisper; the confirmed request can also
        // load the phoneme model and Gemma on the Mac.
        configuration.timeoutIntervalForRequest = 480
        configuration.timeoutIntervalForResource = 900
        return URLSession(configuration: configuration)
    }()

    func reference(for text: String) async throws -> SentenceReference {
        guard var components = URLComponents(url: Self.baseURL, resolvingAgainstBaseURL: false) else { throw SpeechMirrorServiceError.invalidURL }
        components.path = "/api/reference"
        components.queryItems = [URLQueryItem(name: "text", value: text)]
        guard let url = components.url else { throw SpeechMirrorServiceError.invalidURL }
        for attempt in 0..<3 {
            do {
                let request = URLRequest(url: url, timeoutInterval: [12.0, 20.0, 30.0][attempt])
                let (data, response) = try await session.data(for: request)
                guard let http = response as? HTTPURLResponse else {
                    throw SpeechMirrorServiceError.server("The Mac service did not return a response.")
                }
                if http.statusCode != 200 {
                    throw SpeechMirrorServiceError.server("The Mac service could not generate this reference (HTTP \(http.statusCode)). Check the sentence and try again.")
                }
                return try JSONDecoder().decode(SentenceReference.self, from: data)
            } catch let error as URLError where attempt < 2 &&
                (error.code == .timedOut || error.code == .networkConnectionLost || error.code == .notConnectedToInternet) {
                try await Task.sleep(for: .milliseconds(300))
            }
        }
        throw SpeechMirrorServiceError.server("The mouth guide request timed out after retries.")
    }

    func analyze(recordingURL: URL, intendedText: String? = nil,
                 includeGemma: Bool = false, includePhonemes: Bool = false,
                 visualFeatures: SpeechMirrorVisualFeatures? = nil) async throws -> SpeechMirrorResult {
        guard var components = URLComponents(url: Self.baseURL, resolvingAgainstBaseURL: false) else { throw SpeechMirrorServiceError.invalidURL }
        components.path = "/api/analyze"
        components.queryItems = [URLQueryItem(name: "exercise_id", value: "free_speech"),
                                 URLQueryItem(name: "gemma", value: includeGemma ? "true" : "false"),
                                 URLQueryItem(name: "phonemes", value: includePhonemes ? "true" : "false"),
                                 URLQueryItem(name: "skip_phonemes", value: includePhonemes ? "false" : "true"),
                                 URLQueryItem(name: "language", value: "en")]
        if let intendedText, !intendedText.isEmpty {
            components.queryItems?.append(URLQueryItem(name: "intended_text", value: intendedText))
        }
        guard let url = components.url else { throw SpeechMirrorServiceError.invalidURL }
        let wav = try await wavCache.encoded(recordingURL)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = includeGemma ? 480 : (includePhonemes ? 300 : 90)
        request.setValue("audio/wav", forHTTPHeaderField: "Content-Type")
        if let visualFeatures {
            let header = try JSONEncoder().encode(visualFeatures)
            request.setValue(String(decoding: header, as: UTF8.self), forHTTPHeaderField: "X-Speech-Mirror-Visual")
        }
        let (data, response) = try await uploadRecording(request, wav: wav)
        guard let http = response as? HTTPURLResponse else { throw SpeechMirrorServiceError.server("The Mac service did not return a response.") }
        if http.statusCode != 200 {
            throw SpeechMirrorServiceError.server("The Mac service could not analyze this recording (HTTP \(http.statusCode)). Please try again.")
        }
        return try JSONDecoder().decode(SpeechMirrorResult.self, from: data)
    }

    private func uploadRecording(_ request: URLRequest, wav: Data) async throws -> (Data, URLResponse) {
        for attempt in 0..<2 {
            do {
                return try await session.upload(for: request, from: wav)
            } catch let error as URLError where attempt == 0 &&
                (error.code == .networkConnectionLost || error.code == .notConnectedToInternet) {
                try await Task.sleep(for: .milliseconds(600))
            }
        }
        throw SpeechMirrorServiceError.server("The recording upload was interrupted. Please retry the analysis.")
    }

}

/// A confirmed sentence reuses the same recording for measurements, phonemes,
/// and Gemma. Convert its AAC file only once, off the UI thread.
private actor RecordingWAVCache {
    private var recordingURL: URL?
    private var wav: Data?

    func encoded(_ url: URL) async throws -> Data {
        if recordingURL == url, let wav { return wav }
        let data = try await Task.detached(priority: .userInitiated) {
            try WAVEncoder.encode(url)
        }.value
        recordingURL = url
        wav = data
        return data
    }
}

/// Vision can measure visible lip geometry but not MediaPipe pucker or funnel.
struct SpeechMirrorVisualFeatures: Encodable {
    var sampled_frames: Int
    var tracked_frames: Int
    var tracked_fraction: Double
    var median_aperture_ratio: Double?
    var median_width_ratio: Double?

    init?(frames: [CapturedFrame]) {
        guard !frames.isEmpty else { return nil }
        sampled_frames = min(frames.count, 300)
        let tracked = frames.compactMap(\.features)
        tracked_frames = min(tracked.count, sampled_frames)
        tracked_fraction = Double(tracked_frames) / Double(sampled_frames)
        let apertures = tracked.compactMap { frame -> Double? in
            guard frame.width > 0 else { return nil }
            return frame.opening / frame.width
        }.sorted()
        median_aperture_ratio = apertures.isEmpty ? nil : apertures[apertures.count / 2]
        let widths = tracked.map(\.width).sorted()
        median_width_ratio = widths.isEmpty ? nil : widths[widths.count / 2]
    }
}

struct SpeechMirrorResult: Decodable {
    struct Quality: Decodable { var usable: Bool; var warnings: [String] }
    struct ASR: Decodable { var status: String; var text: String?; var reason: String? }
    struct Coach: Decodable { var source: String; var feedback: String; var next_exercise: String; var reason: String? }
    struct Phone: Decodable {
        struct Difference: Decodable { var type: String; var expected: String?; var observed: String? }
        var status: String
        var target: [String]
        var predicted: [String]?
        var possible_substitutions: [Difference]
        var reason: String?
        var model: String?
    }
    struct Measurements: Decodable {
        var duration_s: Double
        var active_duration_s: Double
        var voiced_duration_s: Double
        var median_f0_hz: Double?
        var rms_dbfs: Double
        var f0_stability_cents: Double?
    }
    struct TracePoint: Decodable { var time_s: Double; var f0_hz: Double?; var dbfs: Double? }
    struct VisualData: Decodable {
        var pitch_trace: [TracePoint]
        var volume_trace: [TracePoint]
    }
    struct Performance: Decodable { var asr_ms: Double?; var phoneme_ms: Double?; var gemma_ms: Double? }
    struct Intent: Decodable { var confirmed_text: String?; var comparison: String? }
    var audio_quality: Quality
    var asr: ASR?
    var coach: Coach
    var phoneme_assessment: Phone
    var observations: [String]
    var measurements: Measurements
    var visual_data: VisualData
    var performance: Performance
    var intent: Intent?
}

import AVFoundation

enum WAVEncoder {
    /// Decodes the recorder's AAC file and produces 16 kHz mono PCM for the
    /// existing gemma new analysis endpoint.
    static func encode(_ url: URL) throws -> Data {
        let file = try AVAudioFile(forReading: url)
        let inputFormat = file.processingFormat
        guard let input = AVAudioPCMBuffer(pcmFormat: inputFormat, frameCapacity: AVAudioFrameCount(file.length)) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        try file.read(into: input)
        guard let outputFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 16_000,
                                               channels: 1, interleaved: false),
              let converter = AVAudioConverter(from: inputFormat, to: outputFormat),
              let output = AVAudioPCMBuffer(pcmFormat: outputFormat,
                                            frameCapacity: AVAudioFrameCount(Double(input.frameLength) * 16_000 / inputFormat.sampleRate) + 512)
        else { throw CocoaError(.fileReadCorruptFile) }
        var supplied = false
        var error: NSError?
        converter.convert(to: output, error: &error) { _, status in
            if supplied { status.pointee = .endOfStream; return nil }
            supplied = true
            status.pointee = .haveData
            return input
        }
        if let error { throw error }
        guard let samples = output.floatChannelData?[0], output.frameLength > 0 else {
            throw CocoaError(.fileReadCorruptFile)
        }
        var data = Data()
        func string(_ value: String) { data.append(contentsOf: value.utf8) }
        func u16(_ value: UInt16) { var little = value.littleEndian; withUnsafeBytes(of: &little) { data.append(contentsOf: $0) } }
        func u32(_ value: UInt32) { var little = value.littleEndian; withUnsafeBytes(of: &little) { data.append(contentsOf: $0) } }
        let byteCount = UInt32(output.frameLength) * 2
        string("RIFF"); u32(36 + byteCount); string("WAVE")
        string("fmt "); u32(16); u16(1); u16(1); u32(16_000); u32(32_000); u16(2); u16(16)
        string("data"); u32(byteCount)
        for index in 0..<Int(output.frameLength) {
            let clamped = max(-1, min(1, samples[index]))
            let value = Int16(clamping: Int((clamped * 32767).rounded()))
            u16(UInt16(bitPattern: value))
        }
        return data
    }
}

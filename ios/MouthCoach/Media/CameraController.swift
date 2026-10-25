import AVFoundation
import CoreImage
import Observation
import UIKit
import Vision

/// Normalized, unmirrored Vision points from the current camera frame.
struct LiveLipGeometry: Equatable {
    var outer: [CGPoint]
    var inner: [CGPoint]
    var center: CGPoint
    var width: CGFloat
}

/// Front camera session plus on-device lip tracking with Apple's Vision
/// framework. While capturing, each processed frame stores lip measurements
/// and a small mouth-only JPEG crop. The user may request separate network
/// feedback or audio analysis from a configured service.
@MainActor
@Observable
final class CameraController {
    enum Status: Equatable { case notRequested, requesting, ready, denied, unavailable }

    private(set) var status: Status = .notRequested
    private(set) var faceFound = false
    private(set) var liveLips: LiveLipGeometry?

    let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "mouthcoach.camera.session")
    private let processor = FrameProcessor()
    @ObservationIgnored private var configured = false

    init() {
        processor.onFaceFound = { [weak self] found in
            Task { @MainActor in
                self?.faceFound = found
                if !found { self?.liveLips = nil }
            }
        }
        processor.onLips = { [weak self] lips in
            Task { @MainActor in self?.liveLips = lips }
        }
    }

    func start() async {
        status = .requesting
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: break
        case .notDetermined:
            guard await AVCaptureDevice.requestAccess(for: .video) else { status = .denied; return }
        default:
            status = .denied
            return
        }
        let session = self.session
        let processor = self.processor
        let needsConfiguration = !configured
        let ok: Bool = await withCheckedContinuation { continuation in
            sessionQueue.async {
                if needsConfiguration, !Self.configure(session, processor: processor) {
                    continuation.resume(returning: false)
                    return
                }
                session.startRunning()
                continuation.resume(returning: true)
            }
        }
        configured = configured || ok
        status = ok ? .ready : .unavailable
    }

    func stop() {
        let session = self.session
        sessionQueue.async { if session.isRunning { session.stopRunning() } }
        faceFound = false
        liveLips = nil
        if status == .ready { status = .notRequested }
    }

    func ensureRunning() async {
        if status != .ready {
            await start()
            return
        }
        let session = self.session
        await withCheckedContinuation { continuation in
            sessionQueue.async {
                if !session.isRunning { session.startRunning() }
                continuation.resume()
            }
        }
    }

    func beginCapture() { processor.beginCapture() }

    func endCapture() async -> [CapturedFrame] { await processor.endCapture() }

    nonisolated private static func configure(_ session: AVCaptureSession, processor: FrameProcessor) -> Bool {
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
              let input = try? AVCaptureDeviceInput(device: device)
        else { return false }
        session.beginConfiguration()
        defer { session.commitConfiguration() }
        // The recorder manages the audio session; keep the camera from changing it.
        session.automaticallyConfiguresApplicationAudioSession = false
        session.sessionPreset = .vga640x480
        guard session.canAddInput(input) else { return false }
        session.addInput(input)

        let output = AVCaptureVideoDataOutput()
        output.alwaysDiscardsLateVideoFrames = true
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        output.setSampleBufferDelegate(processor, queue: processor.queue)
        guard session.canAddOutput(output) else { return false }
        session.addOutput(output)
        if let connection = output.connection(with: .video) {
            // Upright, unmirrored frames: Vision and the crops see the true image.
            if connection.isVideoRotationAngleSupported(90) { connection.videoRotationAngle = 90 }
            if connection.isVideoMirroringSupported {
                connection.automaticallyAdjustsVideoMirroring = false
                connection.isVideoMirrored = false
            }
        }
        return true
    }
}

/// Runs on the camera's video queue: Vision landmarks, measurements and crops.
private final class FrameProcessor: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate, @unchecked Sendable {
    let queue = DispatchQueue(label: "mouthcoach.camera.frames")
    /// Called on the video queue.
    var onFaceFound: (@Sendable (Bool) -> Void)?
    var onLips: (@Sendable (LiveLipGeometry?) -> Void)?

    private let ciContext = CIContext()
    private let minInterval: TimeInterval = 1.0 / 15
    private var lastProcessed = Date.distantPast
    private var lastFaceFound = false
    // Accessed only on `queue`.
    private var captureStart: Date?
    private var frames: [CapturedFrame] = []

    func beginCapture() {
        queue.async {
            self.frames = []
            self.captureStart = Date()
        }
    }

    func endCapture() async -> [CapturedFrame] {
        await withCheckedContinuation { continuation in
            queue.async {
                let result = self.frames
                self.frames = []
                self.captureStart = nil
                continuation.resume(returning: result)
            }
        }
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        let now = Date()
        guard now.timeIntervalSince(lastProcessed) >= minInterval,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer)
        else { return }
        lastProcessed = now

        let width = Double(CVPixelBufferGetWidth(pixelBuffer))
        let height = Double(CVPixelBufferGetHeight(pixelBuffer))
        let request = VNDetectFaceLandmarksRequest()
        try? VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up).perform([request])
        let face = request.results?.first

        var features: FrameFeatures?
        var crop: String?
        var liveLips: LiveLipGeometry?
        if let landmarks = face?.landmarks,
           let outer = landmarks.outerLips?.pointsInImage(imageSize: CGSize(width: width, height: height)),
           let inner = landmarks.innerLips?.pointsInImage(imageSize: CGSize(width: width, height: height)),
           let contour = landmarks.faceContour?.pointsInImage(imageSize: CGSize(width: width, height: height)),
           outer.count >= 4 {
            // Vision uses a lower-left origin; the shared measurements expect y down.
            let flip = { (p: CGPoint) in Point(x: Double(p.x), y: height - Double(p.y)) }
            let outerPoints = outer.map(flip)
            let left = outerPoints.min { $0.x < $1.x }!
            let right = outerPoints.max { $0.x < $1.x }!
            let top = outerPoints.map(\.y).min() ?? 0
            let bottom = outerPoints.map(\.y).max() ?? 0
            liveLips = LiveLipGeometry(
                outer: outerPoints.map { CGPoint(x: $0.x / width, y: $0.y / height) },
                inner: inner.map(flip).map { CGPoint(x: $0.x / width, y: $0.y / height) },
                center: CGPoint(x: (left.x + right.x) / (2 * width), y: (top + bottom) / (2 * height)),
                width: (right.x - left.x) / width
            )
            let contourXs = contour.map { Double($0.x) }
            features = describeFrame(LipLandmarks(
                outerLips: outerPoints,
                innerLips: inner.map(flip),
                faceContourWidth: (contourXs.max() ?? 0) - (contourXs.min() ?? 0),
                roll: atan2(right.y - left.y, right.x - left.x)
            ))
            if captureStart != nil, features != nil {
                crop = mouthCrop(pixelBuffer, lips: outer)
            }
        }

        let found = features != nil
        onLips?(liveLips)
        if found != lastFaceFound {
            lastFaceFound = found
            onFaceFound?(found)
        }
        if let start = captureStart {
            frames.append(CapturedFrame(t: now.timeIntervalSince(start), features: features, crop: crop))
        }
    }

    /// 4:3 crop around the mouth (nose base to chin), as a small JPEG data URL.
    private func mouthCrop(_ pixelBuffer: CVPixelBuffer, lips: [CGPoint]) -> String? {
        // Vision image points share Core Image's lower-left origin.
        let xs = lips.map(\.x), ys = lips.map(\.y)
        guard let minX = xs.min(), let maxX = xs.max(), let minY = ys.min(), let maxY = ys.max() else { return nil }
        let center = CGPoint(x: (minX + maxX) / 2, y: (minY + maxY) / 2)
        let cropWidth = (maxX - minX) * 2.1
        let cropHeight = cropWidth * 0.75
        let rect = CGRect(x: center.x - cropWidth / 2, y: center.y - cropHeight / 2, width: cropWidth, height: cropHeight)
        let scale = 240 / cropWidth
        let image = CIImage(cvPixelBuffer: pixelBuffer)
            .cropped(to: rect)
            .transformed(by: CGAffineTransform(translationX: -rect.minX, y: -rect.minY))
            .transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        guard let cgImage = ciContext.createCGImage(image, from: CGRect(x: 0, y: 0, width: 240, height: 180)),
              let jpeg = UIImage(cgImage: cgImage).jpegData(compressionQuality: 0.72)
        else { return nil }
        return "data:image/jpeg;base64," + jpeg.base64EncodedString()
    }
}

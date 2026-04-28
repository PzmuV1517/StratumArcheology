import AVFoundation
import Foundation

@MainActor
final class VoiceRecorder: NSObject, ObservableObject {
    @Published var isRecording = false
    @Published var elapsed: TimeInterval = 0
    @Published var permissionDenied = false

    private var recorder: AVAudioRecorder?
    private var startedAt: Date?
    private var timer: Timer?

    func start() async throws -> URL {
        let granted = await Self.requestPermission()
        if !granted {
            permissionDenied = true
            throw NSError(
                domain: "Stratum",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Microphone access denied"]
            )
        }

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default, options: [.duckOthers])
        try session.setActive(true)

        let url = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("voice-\(UUID().uuidString).m4a")

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
        ]

        let recorder = try AVAudioRecorder(url: url, settings: settings)
        guard recorder.record() else {
            throw NSError(
                domain: "Stratum",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Could not start recording"]
            )
        }
        self.recorder = recorder
        self.startedAt = Date()
        self.isRecording = true
        self.elapsed = 0
        self.startTimer()
        return url
    }

    func stop() -> URL? {
        timer?.invalidate()
        timer = nil
        let url = recorder?.url
        recorder?.stop()
        recorder = nil
        startedAt = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        return url
    }

    func cancel() {
        timer?.invalidate()
        timer = nil
        if let url = recorder?.url {
            recorder?.stop()
            try? FileManager.default.removeItem(at: url)
        }
        recorder = nil
        startedAt = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, let started = self.startedAt else { return }
                self.elapsed = Date().timeIntervalSince(started)
            }
        }
    }

    private static func requestPermission() async -> Bool {
        await withCheckedContinuation { cont in
            AVAudioApplication.requestRecordPermission { granted in
                cont.resume(returning: granted)
            }
        }
    }
}

import SwiftUI

struct VoiceNoteView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    @StateObject private var recorder = VoiceRecorder()

    let project: Project
    var onCreated: (Note) -> Void

    @State private var phase: Phase = .idle
    @State private var errorMessage: String?
    @State private var pendingFile: URL?

    enum Phase {
        case idle
        case recording
        case uploading
    }

    var body: some View {
        VStack(spacing: 12) {
            switch phase {
            case .idle:
                Text("Record voice note")
                    .font(.headline)
                Text("Tap to start. STRATUM will transcribe automatically once it's uploaded.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Button {
                    Task { await beginRecording() }
                } label: {
                    Image(systemName: "mic.circle.fill")
                        .font(.system(size: 60))
                }
                .buttonStyle(.plain)
                .foregroundStyle(.red)

            case .recording:
                Text(format(recorder.elapsed))
                    .font(.system(size: 28, weight: .semibold, design: .monospaced))
                    .foregroundStyle(.red)
                Text("Recording…")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Button {
                    Task { await finishRecording() }
                } label: {
                    Image(systemName: "stop.circle.fill")
                        .font(.system(size: 60))
                }
                .buttonStyle(.plain)
                .foregroundStyle(.red)

            case .uploading:
                ProgressView()
                Text("Uploading…")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, 8)
        .navigationTitle("Voice note")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") {
                    if recorder.isRecording { recorder.cancel() }
                    dismiss()
                }
                .disabled(phase == .uploading)
            }
        }
        .onDisappear {
            if recorder.isRecording { recorder.cancel() }
        }
    }

    private func format(_ seconds: TimeInterval) -> String {
        let total = Int(seconds)
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    private func beginRecording() async {
        errorMessage = nil
        do {
            _ = try await recorder.start()
            phase = .recording
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func finishRecording() async {
        guard let token = auth.token else { return }
        guard let url = recorder.stop() else {
            errorMessage = "No recording to save"
            phase = .idle
            return
        }
        pendingFile = url
        phase = .uploading

        let title = "Voice note " + Self.titleFormatter.string(from: Date())
        do {
            let note = try await APIClient.shared.createNote(
                baseURL: auth.baseURL,
                token: token,
                projectId: project.id,
                title: title,
                content: "",
                isVoice: true
            )
            try await APIClient.shared.uploadAudioAttachment(
                baseURL: auth.baseURL,
                token: token,
                noteId: note.id,
                fileURL: url,
                filename: "voice-note.m4a",
                mimeType: "audio/mp4"
            )
            try? FileManager.default.removeItem(at: url)
            onCreated(note)
            dismiss()
        } catch APIError.unauthorized {
            auth.logout()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            phase = .idle
        }
    }

    private static let titleFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .short
        f.timeStyle = .short
        return f
    }()
}

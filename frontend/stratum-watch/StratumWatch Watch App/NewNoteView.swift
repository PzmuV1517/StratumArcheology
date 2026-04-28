import SwiftUI

struct NewNoteView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss

    let project: Project
    var onCreated: (Note) -> Void

    @State private var title: String = ""
    @State private var content: String = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                fieldLabel("Title")
                TextFieldLink(prompt: Text("Note title")) {
                    HStack {
                        Image(systemName: "mic.fill")
                        Text(title.isEmpty ? "Dictate title" : title)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } onSubmit: { value in
                    title = value
                }
                .buttonStyle(.bordered)

                fieldLabel("Content")
                TextFieldLink(prompt: Text("Note content")) {
                    HStack(alignment: .top) {
                        Image(systemName: "mic.fill")
                        Text(content.isEmpty ? "Dictate note" : content)
                            .lineLimit(4)
                            .multilineTextAlignment(.leading)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } onSubmit: { value in
                    content = value
                }
                .buttonStyle(.bordered)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                Button {
                    Task { await save() }
                } label: {
                    if isSaving {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Save")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSaving || trimmedTitle.isEmpty)
                .padding(.top, 4)
            }
            .padding(.vertical, 4)
        }
        .navigationTitle("New note")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
    }

    private var trimmedTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption2)
            .foregroundStyle(.secondary)
    }

    private func save() async {
        guard let token = auth.token else { return }
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }
        do {
            let note = try await APIClient.shared.createNote(
                baseURL: auth.baseURL,
                token: token,
                projectId: project.id,
                title: trimmedTitle,
                content: content
            )
            onCreated(note)
            dismiss()
        } catch APIError.unauthorized {
            auth.logout()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}

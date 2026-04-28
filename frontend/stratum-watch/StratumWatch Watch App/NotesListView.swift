import SwiftUI

struct NotesListView: View {
    @EnvironmentObject private var auth: AuthStore
    let project: Project

    @State private var notes: [Note] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showNewNote = false
    @State private var showVoiceNote = false

    var body: some View {
        List {
            Section {
                Button {
                    showNewNote = true
                } label: {
                    Label("Dictate note", systemImage: "text.bubble.fill")
                }
                .tint(.accentColor)

                Button {
                    showVoiceNote = true
                } label: {
                    Label("Record voice", systemImage: "mic.fill")
                }
                .tint(.red)
            }

            if isLoading && notes.isEmpty {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            if !isLoading && notes.isEmpty && errorMessage == nil {
                Text("No notes yet. Tap New note to dictate one.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            ForEach(notes) { note in
                VStack(alignment: .leading, spacing: 2) {
                    Text(note.title)
                        .font(.headline)
                        .lineLimit(2)
                    if let body = note.content, !body.isEmpty {
                        Text(body)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(3)
                    }
                }
            }
        }
        .navigationTitle(project.name)
        .task { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $showNewNote) {
            NavigationStack {
                NewNoteView(project: project) { created in
                    notes.insert(created, at: 0)
                }
            }
        }
        .sheet(isPresented: $showVoiceNote) {
            NavigationStack {
                VoiceNoteView(project: project) { created in
                    notes.insert(created, at: 0)
                }
            }
        }
    }

    private func load() async {
        guard let token = auth.token else { return }
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }
        do {
            notes = try await APIClient.shared.fetchNotes(
                baseURL: auth.baseURL,
                token: token,
                projectId: project.id
            )
        } catch APIError.unauthorized {
            auth.logout()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}

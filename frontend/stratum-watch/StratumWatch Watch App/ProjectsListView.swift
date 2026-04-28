import SwiftUI

struct ProjectsListView: View {
    @EnvironmentObject private var auth: AuthStore

    @State private var projects: [Project] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            if isLoading && projects.isEmpty {
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

            if !isLoading && projects.isEmpty && errorMessage == nil {
                Text("No projects yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            ForEach(projects) { project in
                NavigationLink(value: project) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(project.name)
                            .font(.headline)
                            .lineLimit(2)
                        if let desc = project.description, !desc.isEmpty {
                            Text(desc)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                    }
                }
            }

            Section {
                Button(role: .destructive) {
                    auth.logout()
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
        }
        .navigationTitle("Projects")
        .navigationDestination(for: Project.self) { project in
            NotesListView(project: project)
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        guard let token = auth.token else { return }
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }
        do {
            projects = try await APIClient.shared.fetchProjects(
                baseURL: auth.baseURL,
                token: token
            )
        } catch APIError.unauthorized {
            auth.logout()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}

import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var auth: AuthStore

    @State private var code: String = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text("STRATUM")
                    .font(.headline)
                    .frame(maxWidth: .infinity, alignment: .center)

                Text("Generate a pairing code in the STRATUM app on your phone, then enter the 6-digit code here.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                fieldLabel("Server")
                TextField("https://host/api", text: $auth.baseURL)
                    .textContentType(.URL)

                fieldLabel("Pairing code")
                TextFieldLink(prompt: Text("6-digit code")) {
                    HStack {
                        Image(systemName: "number")
                        Text(code.isEmpty ? "Enter code" : code)
                            .monospaced()
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } onSubmit: { value in
                    let digits = value.filter(\.isNumber)
                    code = String(digits.prefix(6))
                    if code.count == 6 {
                        Task { await submit() }
                    }
                }
                .buttonStyle(.bordered)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                Button {
                    Task { await submit() }
                } label: {
                    if isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Pair watch")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isLoading || code.count != 6)
                .padding(.top, 4)
            }
            .padding(.vertical, 4)
        }
        .navigationTitle("Pair")
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption2)
            .foregroundStyle(.secondary)
    }

    private func submit() async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }
        do {
            try await auth.redeem(code: code)
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}

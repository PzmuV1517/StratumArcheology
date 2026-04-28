import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case server(String)
    case decoding
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid server URL"
        case .server(let m): return m
        case .decoding: return "Could not parse response"
        case .unauthorized: return "Session expired, please log in again"
        }
    }
}

actor APIClient {
    static let shared = APIClient()

    private func makeRequest(
        path: String,
        method: String,
        baseURL: String,
        token: String?,
        body: Data? = nil
    ) throws -> URLRequest {
        let trimmed = baseURL.trimmingCharacters(in: .whitespaces)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: "\(trimmed)\(path)") else {
            throw APIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token, !token.isEmpty {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body { req.httpBody = body }
        req.timeoutInterval = 30
        return req
    }

    private func send<T: Decodable>(
        _ request: URLRequest,
        as type: T.Type
    ) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.server("No response")
        }
        if http.statusCode == 401 || http.statusCode == 403 {
            throw APIError.unauthorized
        }
        if !(200..<300).contains(http.statusCode) {
            if let err = try? JSONDecoder().decode(APIErrorResponse.self, from: data),
               let detail = err.detail {
                throw APIError.server(detail)
            }
            throw APIError.server("Request failed (\(http.statusCode))")
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decoding
        }
    }

    func redeemWatchCode(baseURL: String, code: String) async throws -> AuthResponse {
        let body = try JSONSerialization.data(withJSONObject: ["code": code])
        let req = try makeRequest(
            path: "/auth/watch-code/redeem",
            method: "POST",
            baseURL: baseURL,
            token: nil,
            body: body
        )
        return try await send(req, as: AuthResponse.self)
    }

    func fetchProjects(baseURL: String, token: String) async throws -> [Project] {
        let req = try makeRequest(
            path: "/projects/",
            method: "GET",
            baseURL: baseURL,
            token: token
        )
        return try await send(req, as: [Project].self)
    }

    func fetchNotes(baseURL: String, token: String, projectId: String) async throws -> [Note] {
        let req = try makeRequest(
            path: "/notes/project/\(projectId)",
            method: "GET",
            baseURL: baseURL,
            token: token
        )
        return try await send(req, as: [Note].self)
    }

    func createNote(
        baseURL: String,
        token: String,
        projectId: String,
        title: String,
        content: String,
        isVoice: Bool = false
    ) async throws -> Note {
        let body = try JSONSerialization.data(withJSONObject: [
            "project_id": projectId,
            "title": title,
            "content": content,
            "is_voice": isVoice,
        ])
        let req = try makeRequest(
            path: "/notes/",
            method: "POST",
            baseURL: baseURL,
            token: token,
            body: body
        )
        return try await send(req, as: Note.self)
    }

    func uploadAudioAttachment(
        baseURL: String,
        token: String,
        noteId: String,
        fileURL: URL,
        filename: String,
        mimeType: String
    ) async throws {
        let trimmed = baseURL.trimmingCharacters(in: .whitespaces)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: "\(trimmed)/notes/\(noteId)/attachments") else {
            throw APIError.invalidURL
        }
        let boundary = "----StratumWatchBoundary-\(UUID().uuidString)"
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue(
            "multipart/form-data; boundary=\(boundary)",
            forHTTPHeaderField: "Content-Type"
        )
        req.timeoutInterval = 120

        let fileData = try Data(contentsOf: fileURL)
        var body = Data()
        let crlf = "\r\n"
        body.append("--\(boundary)\(crlf)".data(using: .utf8)!)
        body.append(
            "Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\(crlf)"
                .data(using: .utf8)!
        )
        body.append("Content-Type: \(mimeType)\(crlf)\(crlf)".data(using: .utf8)!)
        body.append(fileData)
        body.append("\(crlf)--\(boundary)--\(crlf)".data(using: .utf8)!)

        let (data, response) = try await URLSession.shared.upload(
            for: req,
            from: body
        )
        guard let http = response as? HTTPURLResponse else {
            throw APIError.server("No response")
        }
        if http.statusCode == 401 || http.statusCode == 403 {
            throw APIError.unauthorized
        }
        if !(200..<300).contains(http.statusCode) {
            if let err = try? JSONDecoder().decode(APIErrorResponse.self, from: data),
               let detail = err.detail {
                throw APIError.server(detail)
            }
            throw APIError.server("Upload failed (\(http.statusCode))")
        }
    }
}

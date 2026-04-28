import Foundation

struct AuthUser: Decodable, Identifiable, Hashable {
    let id: String
    let email: String
    let displayName: String?

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case displayName = "display_name"
    }
}

struct AuthResponse: Decodable {
    let accessToken: String?
    let user: AuthUser

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case user
    }
}

struct Project: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let description: String?
}

struct Note: Decodable, Identifiable, Hashable {
    let id: String
    let title: String
    let content: String?
    let projectId: String
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case content
        case projectId = "project_id"
        case updatedAt = "updated_at"
    }
}

struct APIErrorResponse: Decodable {
    let detail: String?
}

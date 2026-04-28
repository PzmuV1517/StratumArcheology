import Foundation
import SwiftUI

@MainActor
final class AuthStore: ObservableObject {
    @AppStorage("stratum.baseURL") var baseURL: String = "https://stratum.pzmuv.com/api"
    @AppStorage("stratum.token") private var storedToken: String = ""
    @AppStorage("stratum.userEmail") private var storedEmail: String = ""
    @AppStorage("stratum.userName") private var storedName: String = ""

    @Published var token: String? = nil
    @Published var displayName: String = ""

    init() {
        if !storedToken.isEmpty {
            token = storedToken
            displayName = storedName.isEmpty ? storedEmail : storedName
        }
    }

    var isLoggedIn: Bool { token != nil }

    func redeem(code: String) async throws {
        let resp = try await APIClient.shared.redeemWatchCode(
            baseURL: baseURL,
            code: code
        )
        guard let access = resp.accessToken else {
            throw APIError.server("Pairing failed")
        }
        storedToken = access
        storedEmail = resp.user.email
        storedName = resp.user.displayName ?? resp.user.email
        token = access
        displayName = storedName
    }

    func logout() {
        storedToken = ""
        storedEmail = ""
        storedName = ""
        token = nil
        displayName = ""
    }
}

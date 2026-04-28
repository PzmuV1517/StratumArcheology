import SwiftUI

@main
struct StratumWatchApp: App {
    @StateObject private var auth = AuthStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore

    var body: some View {
        if auth.isLoggedIn {
            NavigationStack {
                ProjectsListView()
            }
        } else {
            NavigationStack {
                LoginView()
            }
        }
    }
}

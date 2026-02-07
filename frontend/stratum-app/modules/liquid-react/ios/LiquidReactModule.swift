import ExpoModulesCore
import UIKit

public class LiquidReactModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiquidReact")

    Function("setSidebarAdaptable") { (forceSidebar: Bool) in
      if #available(iOS 18.0, *) {
        DispatchQueue.main.async {
          guard let tabBarController = LiquidReactModule.findTabBarController() else {
            return
          }

          let idiom = tabBarController.traitCollection.userInterfaceIdiom
          if forceSidebar && (idiom == .pad || idiom == .mac) {
            tabBarController.mode = .sidebar
          } else {
            tabBarController.mode = .sidebarAdaptable
          }
        }
      }
    }
  }

  private static func findTabBarController() -> UITabBarController? {
    return findTabBarController(from: rootViewController())
  }

  private static func rootViewController() -> UIViewController? {
    if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
      return scene.windows.first(where: { $0.isKeyWindow })?.rootViewController
    }

    return UIApplication.shared.windows.first(where: { $0.isKeyWindow })?.rootViewController
  }

  private static func findTabBarController(from viewController: UIViewController?) -> UITabBarController? {
    guard let viewController else {
      return nil
    }

    if let tabBarController = viewController as? UITabBarController {
      return tabBarController
    }

    if let navigationController = viewController as? UINavigationController {
      return findTabBarController(from: navigationController.visibleViewController)
    }

    if let splitViewController = viewController as? UISplitViewController {
      for child in splitViewController.viewControllers {
        if let found = findTabBarController(from: child) {
          return found
        }
      }
    }

    if let presented = viewController.presentedViewController {
      if let found = findTabBarController(from: presented) {
        return found
      }
    }

    for child in viewController.children {
      if let found = findTabBarController(from: child) {
        return found
      }
    }

    return nil
  }
}

import ExpoModulesCore
import UIKit

public class LiquidReactButtonModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiquidReactButton")

    View(LiquidReactButtonView.self) {

      Prop("title") { (view: LiquidReactButtonView, title: String?) in
        view.button.setTitle(title, for: .normal)
      }

      Prop("titleColor") { (view: LiquidReactButtonView, color: UIColor?) in
        view.button.setTitleColor(color, for: .normal)
      }

      Prop("backgroundColor") { (view: LiquidReactButtonView, color: UIColor?) in
        view.button.backgroundColor = color
      }

      Prop("systemImageName") { (view: LiquidReactButtonView, name: String?) in
        guard let name else {
          view.button.setImage(nil, for: .normal)
          return
        }
        view.button.setImage(UIImage(systemName: name), for: .normal)
      }

      Prop("tintColor") { (view: LiquidReactButtonView, color: UIColor?) in
        view.button.tintColor = color
      }

      Prop("enabled") { (view: LiquidReactButtonView, enabled: Bool?) in
        view.button.isEnabled = enabled ?? true
      }

      Prop("highlighted") { (view: LiquidReactButtonView, highlighted: Bool?) in
        view.button.isHighlighted = highlighted ?? false
      }

      Prop("selected") { (view: LiquidReactButtonView, selected: Bool?) in
        view.button.isSelected = selected ?? false
      }

      Prop("adjustsImageWhenHighlighted") { (view: LiquidReactButtonView, value: Bool?) in
        view.button.adjustsImageWhenHighlighted = value ?? true
      }

      Prop("adjustsImageWhenDisabled") { (view: LiquidReactButtonView, value: Bool?) in
        view.button.adjustsImageWhenDisabled = value ?? true
      }

      Prop("showsTouchWhenHighlighted") { (view: LiquidReactButtonView, value: Bool?) in
        view.button.showsTouchWhenHighlighted = value ?? false
      }

      Prop("contentHorizontalAlignment") { (view: LiquidReactButtonView, alignment: String?) in
        view.applyHorizontalAlignment(alignment)
      }

      Prop("contentVerticalAlignment") { (view: LiquidReactButtonView, alignment: String?) in
        view.applyVerticalAlignment(alignment)
      }

      Prop("cornerRadius") { (view: LiquidReactButtonView, radius: Double?) in
        view.button.layer.cornerRadius = CGFloat(radius ?? 0)
        view.button.clipsToBounds = (radius ?? 0) > 0
      }

      Prop("fontSize") { (view: LiquidReactButtonView, size: Double?) in
        view.applyFont(size: size, weight: nil)
      }

      Prop("fontWeight") { (view: LiquidReactButtonView, weight: String?) in
        view.applyFont(size: nil, weight: weight)
      }

      Prop("numberOfLines") { (view: LiquidReactButtonView, lines: Int?) in
        view.button.titleLabel?.numberOfLines = lines ?? 1
      }

      Prop("lineBreakMode") { (view: LiquidReactButtonView, mode: String?) in
        view.applyLineBreakMode(mode)
      }

      Prop("contentEdgeInsets") { (view: LiquidReactButtonView, insets: ButtonInsets?) in
        view.applyInsets(insets, to: "content")
      }

      Prop("titleEdgeInsets") { (view: LiquidReactButtonView, insets: ButtonInsets?) in
        view.applyInsets(insets, to: "title")
      }

      Prop("imageEdgeInsets") { (view: LiquidReactButtonView, insets: ButtonInsets?) in
        view.applyInsets(insets, to: "image")
      }

      Prop("accessibilityLabel") { (view: LiquidReactButtonView, value: String?) in
        view.button.accessibilityLabel = value
      }

      Prop("accessibilityHint") { (view: LiquidReactButtonView, value: String?) in
        view.button.accessibilityHint = value
      }

      Prop("accessibilityIdentifier") { (view: LiquidReactButtonView, value: String?) in
        view.button.accessibilityIdentifier = value
      }
    }
  }
}

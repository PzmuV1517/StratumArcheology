import ExpoModulesCore
import UIKit

struct ButtonInsets: Record {
  @Field var top: Double = 0
  @Field var left: Double = 0
  @Field var bottom: Double = 0
  @Field var right: Double = 0
}

class LiquidReactButtonView: ExpoView {
  let button = UIButton(type: .system)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
    button.isUserInteractionEnabled = false
    addSubview(button)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
  }

  // Let touches pass to JS Pressable
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    return nil
  }

  func applyInsets(_ insets: ButtonInsets?, to type: String) {
    let inset = insets ?? ButtonInsets()
    let edgeInsets = UIEdgeInsets(
      top: inset.top,
      left: inset.left,
      bottom: inset.bottom,
      right: inset.right
    )

    switch type {
    case "content":
      button.contentEdgeInsets = edgeInsets
    case "title":
      button.titleEdgeInsets = edgeInsets
    case "image":
      button.imageEdgeInsets = edgeInsets
    default:
      break
    }
  }

  func applyFont(size: Double?, weight: String?) {
    guard let label = button.titleLabel else { return }
    let fontSize = size ?? Double(label.font.pointSize)
    label.font = UIFont.systemFont(ofSize: CGFloat(fontSize), weight: mapFontWeight(weight))
  }

  func applyHorizontalAlignment(_ alignment: String?) {
    switch alignment?.lowercased() {
    case "left":
      button.contentHorizontalAlignment = .left
    case "right":
      button.contentHorizontalAlignment = .right
    case "fill":
      button.contentHorizontalAlignment = .fill
    case "leading":
      button.contentHorizontalAlignment = .leading
    case "trailing":
      button.contentHorizontalAlignment = .trailing
    default:
      button.contentHorizontalAlignment = .center
    }
  }

  func applyVerticalAlignment(_ alignment: String?) {
    switch alignment?.lowercased() {
    case "top":
      button.contentVerticalAlignment = .top
    case "bottom":
      button.contentVerticalAlignment = .bottom
    case "fill":
      button.contentVerticalAlignment = .fill
    default:
      button.contentVerticalAlignment = .center
    }
  }

  func applyLineBreakMode(_ mode: String?) {
    guard let label = button.titleLabel else { return }
    switch mode?.lowercased() {
    case "wordwrap":
      label.lineBreakMode = .byWordWrapping
    case "charwrap":
      label.lineBreakMode = .byCharWrapping
    case "clip":
      label.lineBreakMode = .byClipping
    case "headtruncation":
      label.lineBreakMode = .byTruncatingHead
    case "middletruncation":
      label.lineBreakMode = .byTruncatingMiddle
    case "tailtruncation":
      label.lineBreakMode = .byTruncatingTail
    default:
      label.lineBreakMode = .byTruncatingTail
    }
  }

  private func mapFontWeight(_ weight: String?) -> UIFont.Weight {
    switch weight?.lowercased() {
    case "ultralight":
      return .ultraLight
    case "thin":
      return .thin
    case "light":
      return .light
    case "regular":
      return .regular
    case "medium":
      return .medium
    case "semibold":
      return .semibold
    case "bold":
      return .bold
    case "heavy":
      return .heavy
    case "black":
      return .black
    default:
      return .regular
    }
  }
}

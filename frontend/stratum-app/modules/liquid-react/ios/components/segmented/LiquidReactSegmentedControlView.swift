import ExpoModulesCore
import UIKit

final class LiquidReactSegmentedControlView: ExpoView {
  let segmentedControl = UISegmentedControl(items: [])
  let onChange = EventDispatcher()
  private var topConstraint: NSLayoutConstraint?
  private var trailingConstraint: NSLayoutConstraint?
  private var usesAnchors: Bool = false
  private var topAnchorValue: Double?
  private var trailingAnchorValue: Double?

  override init(frame: CGRect) {
    super.init(frame: frame)
    addSubview(segmentedControl)
    segmentedControl.addTarget(self, action: #selector(handleChange), for: .valueChanged)
  }

  @objc private func handleChange() {
    onChange(["selectedIndex": segmentedControl.selectedSegmentIndex])
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if !usesAnchors {
      segmentedControl.frame = bounds
    }
  }

  func setTopAnchor(_ top: Double?) {
    topAnchorValue = top
    updateAnchors()
  }

  func setTrailingAnchor(_ trailing: Double?) {
    trailingAnchorValue = trailing
    updateAnchors()
  }

  private func updateAnchors() {
    if topAnchorValue == nil && trailingAnchorValue == nil {
      clearAnchors()
      return
    }

    usesAnchors = true
    segmentedControl.translatesAutoresizingMaskIntoConstraints = false
    if let existing = topConstraint {
      existing.isActive = false
    }
    if let existing = trailingConstraint {
      existing.isActive = false
    }

    if let top = topAnchorValue {
      topConstraint = segmentedControl.topAnchor.constraint(
        equalTo: safeAreaLayoutGuide.topAnchor,
        constant: CGFloat(top)
      )
      topConstraint?.isActive = true
    }

    if let trailing = trailingAnchorValue {
      trailingConstraint = segmentedControl.trailingAnchor.constraint(
        equalTo: trailingAnchor,
        constant: CGFloat(trailing)
      )
      trailingConstraint?.isActive = true
    }
  }

  private func clearAnchors() {
    usesAnchors = false
    segmentedControl.translatesAutoresizingMaskIntoConstraints = true
    topConstraint?.isActive = false
    trailingConstraint?.isActive = false
    topConstraint = nil
    trailingConstraint = nil
  }

  func setSegments(_ segments: [String]) {
    segmentedControl.removeAllSegments()
    for (index, title) in segments.enumerated() {
      segmentedControl.insertSegment(withTitle: title, at: index, animated: false)
    }
  }
}

import ExpoModulesCore
import UIKit

public class LiquidReactSegmentedControlModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiquidReactSegmentedControl")

    View(LiquidReactSegmentedControlView.self) {
      Events("onChange")

      Prop("segments") { (view: LiquidReactSegmentedControlView, segments: [String]?) in
        view.setSegments(segments ?? [])
      }

      Prop("selectedIndex") { (view: LiquidReactSegmentedControlView, index: Int?) in
        view.segmentedControl.selectedSegmentIndex = index ?? UISegmentedControl.noSegment
      }

      Prop("enabled") { (view: LiquidReactSegmentedControlView, enabled: Bool?) in
        view.segmentedControl.isEnabled = enabled ?? true
      }

      Prop("momentary") { (view: LiquidReactSegmentedControlView, momentary: Bool?) in
        view.segmentedControl.isMomentary = momentary ?? false
      }

      Prop("selectedSegmentTintColor") { (view: LiquidReactSegmentedControlView, color: UIColor?) in
        view.segmentedControl.selectedSegmentTintColor = color
      }

      Prop("tintColor") { (view: LiquidReactSegmentedControlView, color: UIColor?) in
        view.segmentedControl.tintColor = color
      }

      Prop("topAnchor") { (view: LiquidReactSegmentedControlView, top: Double?) in
        view.setTopAnchor(top)
      }

      Prop("trailingAnchor") { (view: LiquidReactSegmentedControlView, trailing: Double?) in
        view.setTrailingAnchor(trailing)
      }
    }
  }
}

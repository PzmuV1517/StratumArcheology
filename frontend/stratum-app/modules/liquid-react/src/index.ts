export { default as LiquidReact } from "./native/LiquidReactModule";
export { LiquidButton } from "./components/button";
export type { LiquidButtonProps } from "./components/button";
export { LiquidSegmentedControl } from "./components/segmented";
export type { LiquidSegmentedControlProps } from "./components/segmented";

// Re-export native UIKit components from the node_modules liquid-react package.
// The node_modules version is shadowed by this local Expo module, so we
// bridge its JS components here. The native Swift/ObjC files have been
// copied into this module's ios/ directory so they compile into the binary.
export {
  NativeMaterialView,
  NativeButton,
  NativeSwitch,
  NativeSegmentedControl,
  NativeSearchBar,
  NativeNavigationBar,
  NativeToolbar,
  NativeToolbarButton,
  NativeToolbarMenu,
  NativeTabBar,
  NativeGroupedContainer,
  NativeCardContainer,
  NativeStackView,
} from "../../../node_modules/liquid-react/src/components";

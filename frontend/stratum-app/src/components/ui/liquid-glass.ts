/**
 * Liquid Glass UI Components
 *
 * iOS 26+ Liquid Glass styled components with fallbacks for older iOS and Android.
 * Components use NATIVE UIKit where possible (nav bars, sheets, search bars,
 * action sheets, segmented controls) so they automatically get Apple's Liquid
 * Glass on iOS 26+. callstack's LiquidGlassView is only used for truly custom
 * glass surfaces (toolbar groups, cards, buttons) where no native equivalent exists.
 *
 * Import from here for convenience:
 *
 * import { LiquidGlassButton, LiquidGlassSwitch, ... } from "@/src/components/ui/liquid-glass";
 */

// --- Controls ---
export { LiquidGlassButton } from "./LiquidGlassButton";
export { LiquidGlassSwitch } from "./LiquidGlassSwitch";
export { LiquidGlassSlider } from "./LiquidGlassSlider";
export { LiquidGlassStepper } from "./LiquidGlassStepper";
export type { LiquidGlassStepperProps } from "./LiquidGlassStepper";
export { LiquidGlassSegmentedControl } from "./LiquidGlassSegmentedControl";
export type { SegmentItem } from "./LiquidGlassSegmentedControl";

// --- Text Input ---
export { LiquidGlassTextField } from "./LiquidGlassTextField";
export type { LiquidGlassTextFieldProps } from "./LiquidGlassTextField";
export { LiquidGlassSearchBar, getLiquidGlassSearchBarOptions } from "./LiquidGlassSearchBar";
export type { SearchBarOptionsConfig } from "./LiquidGlassSearchBar";

// --- Navigation ---
export { LiquidGlassNavBar, getLiquidGlassNavBarOptions } from "./LiquidGlassNavBar";
export { LiquidPillTabBar } from "./LiquidPillTabBar";
export { LiquidGlassToolbar } from "./LiquidGlassToolbar";
export type { ToolbarItem } from "./LiquidGlassToolbar";

// --- Presentation ---
export { LiquidGlassSheet, getLiquidGlassSheetOptions } from "./LiquidGlassSheet";
export type { SheetDetent, SheetSnapPoint } from "./LiquidGlassSheet";
export { LiquidGlassActionSheet } from "./LiquidGlassActionSheet";
export type { ActionSheetAction } from "./LiquidGlassActionSheet";
export { LiquidGlassCard } from "./LiquidGlassCard";
export type { LiquidGlassCardProps } from "./LiquidGlassCard";

// --- Core ---
export {
  LiquidGlassView,
  LiquidGlassContainerView,
  isLiquidGlassSupported,
} from "@/src/utils/liquidGlass";

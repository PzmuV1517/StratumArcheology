/**
 * Liquid Glass UI Components
 *
 * iOS 26+ Liquid Glass styled components with fallbacks for older iOS and Android.
 * Import from here for convenience:
 *
 * import { LiquidGlassButton, LiquidGlassSwitch, LiquidGlassSlider } from "@/src/components/ui/liquid-glass";
 */

export { LiquidGlassButton } from "./LiquidGlassButton";
export { LiquidGlassSwitch } from "./LiquidGlassSwitch";
export { LiquidGlassSlider } from "./LiquidGlassSlider";

// Re-export the core LiquidGlassView for custom usage
export { LiquidGlassView, isLiquidGlassSupported } from "@/src/utils/liquidGlass";

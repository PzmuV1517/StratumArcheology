/**
 * Liquid Glass compatibility shim
 *
 * Maps the old LiquidGlassView / isLiquidGlassSupported API to the
 * updated liquid-react package which exports NativeMaterialView.
 *
 * LiquidGlassView  → NativeMaterialView (with material="systemMaterial")
 * isLiquidGlassSupported → true on iOS (liquid-react handles the native rendering)
 */
import React from "react";
import { Platform, View, type ViewProps } from "react-native";

// liquid-react is iOS-only; guard imports with a try/catch for web/Android
let NativeMaterialViewComponent: React.ComponentType<any> | null = null;

if (Platform.OS === "ios") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lr = require("liquid-react");
    NativeMaterialViewComponent = lr.NativeMaterialView;
  } catch {
    NativeMaterialViewComponent = null;
  }
}

/**
 * Whether the native Liquid Glass rendering is available.
 * true on iOS where liquid-react resolves successfully, false elsewhere.
 */
export const isLiquidGlassSupported: boolean =
  Platform.OS === "ios" && NativeMaterialViewComponent != null;

// ---------- LiquidGlassView ----------

export interface LiquidGlassViewProps extends ViewProps {
  /** Ignored — kept for backwards compat. The native material is always "systemMaterial". */
  effect?: string;
  children?: React.ReactNode;
}

/**
 * Drop-in replacement for the old LiquidGlassView.
 *
 * On iOS it renders a NativeMaterialView (UIVisualEffectView) with the
 * system material blur. On Android / web it renders a plain View.
 */
export const LiquidGlassView: React.FC<LiquidGlassViewProps> = ({
  effect: _effect,
  children,
  ...rest
}) => {
  if (isLiquidGlassSupported && NativeMaterialViewComponent) {
    return React.createElement(
      NativeMaterialViewComponent,
      { material: "systemMaterial", ...rest },
      children,
    );
  }
  return React.createElement(View, rest, children);
};

// ---------- LiquidGlassContainerView ----------

/**
 * Alias kept for backwards compat — same as LiquidGlassView.
 */
export const LiquidGlassContainerView = LiquidGlassView;

/**
 * Safe wrapper for @callstack/liquid-glass.
 *
 * The native module crashes in Expo Go because it isn't bundled there.
 * This wrapper catches the error at import-time and provides fallbacks:
 *  - LiquidGlassView  → falls back to a plain <View>
 *  - isLiquidGlassSupported → false
 */
import React from "react";
import { View, type ViewProps } from "react-native";

let _LiquidGlassView: React.ComponentType<any> = View;
let _isLiquidGlassSupported = false;

try {
  const mod = require("@callstack/liquid-glass");
  if (mod?.LiquidGlassView) {
    _LiquidGlassView = mod.LiquidGlassView;
  }
  if (mod?.isLiquidGlassSupported) {
    _isLiquidGlassSupported = true;
  }
} catch {
  // Native module not available (Expo Go / unsupported platform) — keep fallbacks
}

export const LiquidGlassView = _LiquidGlassView;
export const isLiquidGlassSupported = _isLiquidGlassSupported;

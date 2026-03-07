/**
 * @file
 * Liquid Glass design system utilities.
 *
 * Provides shared styles and helpers for the Liquid Glass
 * visual design language.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
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
export {
  LiquidGlassSearchBar,
  getLiquidGlassSearchBarOptions,
} from "./LiquidGlassSearchBar";
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

// --- Core (from liquid-react native module) ---
export { NativeMaterialView } from "liquid-react";
export type { NativeMaterialViewProps } from "liquid-react";

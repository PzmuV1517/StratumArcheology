/**
 * @file
 * Module for global.d functionality.
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
declare module "remark-math";
declare module "rehype-katex";
declare module "rehype-raw";
declare module "d3";
declare module "@/components/map/MonumentPinPicker" {
  import * as React from "react";

  type Coordinates = { latitude: number; longitude: number };

  type MonumentPinPickerProps = {
    value: unknown;
    editable: boolean;
    monumentCoordinate?: Coordinates | null;
    onChange: (nextValue: string) => void;
  };

  const MonumentPinPicker: React.ComponentType<MonumentPinPickerProps>;
  export default MonumentPinPicker;
}

declare module "liquid-react" {
  export const LiquidReact: {
    setSidebarAdaptable: (forceSidebar: boolean) => void;
  };
  import * as React from "react";
  import type { StyleProp, ViewStyle } from "react-native";

  type ButtonInsets = {
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
  };

  export type LiquidButtonProps = {
    title?: string;
    titleColor?: string;
    backgroundColor?: string;
    systemImageName?: string;
    tintColor?: string;
    enabled?: boolean;
    highlighted?: boolean;
    selected?: boolean;
    adjustsImageWhenHighlighted?: boolean;
    adjustsImageWhenDisabled?: boolean;
    showsTouchWhenHighlighted?: boolean;
    contentHorizontalAlignment?:
      | "center"
      | "left"
      | "right"
      | "fill"
      | "leading"
      | "trailing";
    contentVerticalAlignment?: "center" | "top" | "bottom" | "fill";
    cornerRadius?: number;
    fontSize?: number;
    fontWeight?: string;
    numberOfLines?: number;
    lineBreakMode?:
      | "wordWrap"
      | "charWrap"
      | "clip"
      | "headTruncation"
      | "tailTruncation"
      | "middleTruncation";
    contentEdgeInsets?: ButtonInsets;
    titleEdgeInsets?: ButtonInsets;
    imageEdgeInsets?: ButtonInsets;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    accessibilityIdentifier?: string;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
  };

  export const LiquidButton: React.ComponentType<LiquidButtonProps>;

  export type LiquidSegmentedControlProps = {
    segments: string[];
    selectedIndex?: number;
    enabled?: boolean;
    momentary?: boolean;
    selectedSegmentTintColor?: string;
    tintColor?: string;
    topAnchor?: number;
    trailingAnchor?: number;
    onChange?: (event: { selectedIndex: number }) => void;
    style?: StyleProp<ViewStyle>;
  };

  export const LiquidSegmentedControl: React.ComponentType<LiquidSegmentedControlProps>;
}

import * as React from "react";
import { Platform, StyleProp, ViewStyle, View } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";

type LiquidSegmentedControlProps = {
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

const NativeLiquidSegmentedControl =
  Platform.OS === "web"
    ? null
    : requireNativeViewManager("LiquidReactSegmentedControl");

export default function LiquidSegmentedControl(props: LiquidSegmentedControlProps) {
  if (!NativeLiquidSegmentedControl) {
    return <View style={props.style} />;
  }
  return <NativeLiquidSegmentedControl {...props} />;
}

export type { LiquidSegmentedControlProps };

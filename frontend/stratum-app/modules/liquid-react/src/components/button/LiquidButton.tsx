import * as React from "react";
import { Platform, StyleProp, ViewStyle, View } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";

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
  contentHorizontalAlignment?: "center" | "left" | "right" | "fill" | "leading" | "trailing";
  contentVerticalAlignment?: "center" | "top" | "bottom" | "fill";
  cornerRadius?: number;
  fontSize?: number;
  fontWeight?: string;
  numberOfLines?: number;
  lineBreakMode?: "wordWrap" | "charWrap" | "clip" | "headTruncation" | "tailTruncation" | "middleTruncation";
  contentEdgeInsets?: ButtonInsets;
  titleEdgeInsets?: ButtonInsets;
  imageEdgeInsets?: ButtonInsets;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityIdentifier?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const NativeLiquidButton =
  Platform.OS === "web" ? null : requireNativeViewManager("LiquidReactButton");

export default function LiquidButton(props: LiquidButtonProps) {
  if (!NativeLiquidButton) {
    return <View style={props.style} />;
  }
  return <NativeLiquidButton {...props} />;
}

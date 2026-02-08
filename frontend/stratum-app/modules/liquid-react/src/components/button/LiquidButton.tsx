import * as React from "react";
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
  View,
  Text,
} from "react-native";
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

let NativeLiquidButton: any = null;
if (Platform.OS !== "web") {
  try {
    NativeLiquidButton = requireNativeViewManager(
      "LiquidReactButton_LiquidReactButtonView",
    );
  } catch {
    NativeLiquidButton = null;
  }
}

export default function LiquidButton(props: LiquidButtonProps) {
  const { onPress, style, ...nativeProps } = props;
  if (!NativeLiquidButton) {
    // Fallback: render a simple pressable with icon placeholder + title
    return (
      <Pressable onPress={onPress} style={[{ flexDirection: "row", alignItems: "center" }, style]}>
        {props.title ? (
          <Text style={{ color: props.tintColor || props.titleColor || "#fff", fontSize: props.fontSize || 17 }}>
            {props.title}
          </Text>
        ) : null}
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} style={style}>
      <NativeLiquidButton
        {...nativeProps}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </Pressable>
  );
}

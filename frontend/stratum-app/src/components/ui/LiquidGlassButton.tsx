/**
 * @file
 * Liquid Glass button component.
 *
 * A button styled with the Liquid Glass design language.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
  TextStyle,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

const isIOS = Platform.OS === "ios";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "glass"
  | "glassProminent";
type ButtonSize = "sm" | "md" | "lg";

interface LiquidGlassButtonProps {
  title?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  haptic?: boolean;
}

/**
 * Button styled with the Liquid Glass design language.
 * @param props - Component props
 * @returns The rendered component
 */
export function LiquidGlassButton({
  title = "",
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  icon,
  iconPosition = "left",
  style,
  textStyle,
  haptic = true,
}: LiquidGlassButtonProps) {
  const handlePress = () => {
    if (haptic && isIOS) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const sizeStyles = SIZE_STYLES[size];
  const variantConfig = VARIANT_STYLES[variant];
  const showText = title.trim().length > 0;

  const content = (
    <>
      {icon && iconPosition === "left" && (
        <View style={showText ? styles.iconLeft : undefined}>{icon}</View>
      )}
      {showText && (
        <Text
          style={[
            styles.text,
            sizeStyles.text,
            variantConfig.text,
            disabled && styles.textDisabled,
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
      {icon && iconPosition === "right" && (
        <View style={showText ? styles.iconRight : undefined}>{icon}</View>
      )}
    </>
  );

  // iOS: BlurView gives native glass-like backdrop (maps to UIVisualEffectView)
  // Destructive always uses solid background regardless of platform
  if (isIOS && variant !== "destructive") {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.7}
        style={[
          styles.touchable,
          sizeStyles.container,
          disabled && styles.disabled,
          style,
        ]}
      >
        <BlurView
          intensity={variantConfig.blurIntensity}
          tint={variantConfig.blurTint}
          style={[
            styles.blurContainer,
            sizeStyles.container,
            variantConfig.blurStyle,
            style,
          ]}
        >
          {content}
        </BlurView>
      </TouchableOpacity>
    );
  }

  // Android / destructive
  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.solidContainer,
        sizeStyles.container,
        variantConfig.solidContainer,
        disabled && styles.disabled,
        style,
      ]}
    >
      {content}
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------------ */

const SIZE_STYLES: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
    text: { fontSize: 13 },
  },
  md: {
    container: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 14 },
    text: { fontSize: 15 },
  },
  lg: {
    container: { paddingVertical: 16, paddingHorizontal: 28, borderRadius: 18 },
    text: { fontSize: 17 },
  },
};

const VARIANT_STYLES: Record<
  ButtonVariant,
  {
    blurIntensity: number;
    blurTint: "dark" | "light" | "default";
    blurStyle?: ViewStyle;
    solidContainer: ViewStyle;
    text: TextStyle;
  }
> = {
  primary: {
    blurIntensity: 50,
    blurTint: "dark",
    blurStyle: { backgroundColor: "rgba(255, 42, 42, 0.3)" },
    solidContainer: { backgroundColor: "#FF2A2A" },
    text: { color: "#FFFFFF" },
  },
  secondary: {
    blurIntensity: 40,
    blurTint: "dark",
    blurStyle: { backgroundColor: "rgba(255, 255, 255, 0.15)" },
    solidContainer: { backgroundColor: "rgba(255, 255, 255, 0.12)" },
    text: { color: "#F5F5F5" },
  },
  ghost: {
    blurIntensity: 0,
    blurTint: "dark",
    blurStyle: { backgroundColor: "transparent" },
    solidContainer: { backgroundColor: "transparent" },
    text: { color: "#FF2A2A" },
  },
  destructive: {
    blurIntensity: 0,
    blurTint: "dark",
    solidContainer: { backgroundColor: "#FF4444" },
    text: { color: "#FFFFFF" },
  },
  glass: {
    blurIntensity: 30,
    blurTint: "light",
    blurStyle: { backgroundColor: "rgba(255, 255, 255, 0.08)" },
    solidContainer: { backgroundColor: "rgba(255, 255, 255, 0.1)" },
    text: { color: "#F5F5F5" },
  },
  glassProminent: {
    blurIntensity: 50,
    blurTint: "light",
    blurStyle: {
      backgroundColor: "rgba(255, 255, 255, 0.15)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255, 255, 255, 0.25)",
    },
    solidContainer: { backgroundColor: "rgba(255, 255, 255, 0.15)" },
    text: { color: "#FFFFFF" },
  },
};

const styles = StyleSheet.create({
  touchable: { overflow: "hidden" },
  blurContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  solidContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontWeight: "600", letterSpacing: 0.3 },
  textDisabled: { opacity: 0.5 },
  disabled: { opacity: 0.5 },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
});

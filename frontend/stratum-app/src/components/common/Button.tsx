/**
 * @file
 * Reusable button component.
 *
 * A themed button with loading state, icon support, and
 * multiple visual variants.
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
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

const sizeStyles: Record<string, ViewStyle> = {
  small: { paddingHorizontal: 12, paddingVertical: 6 },
  medium: { paddingHorizontal: 16, paddingVertical: 10 },
  large: { paddingHorizontal: 24, paddingVertical: 14 },
};

const textSizeStyles: Record<string, TextStyle> = {
  small: { fontSize: 13 },
  medium: { fontSize: 15 },
  large: { fontSize: 17 },
};

/**
 * Reusable themed button with loading state, icon support, and multiple visual variants.
 * @param props - Component props
 * @returns The rendered component
 */
export default function Button({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";

  const variantStyles: Record<string, ViewStyle> = {
    primary: { backgroundColor: "#007AFF" },
    secondary: {
      backgroundColor: isDarkMode ? "#2C2C2E" : "#EFEFF1",
      borderWidth: 1,
      borderColor: isDarkMode ? "#3C3C3E" : "#D0D0D4",
    },
    danger: { backgroundColor: "#FF3B30" },
    ghost: { backgroundColor: "transparent" },
  };

  const textVariantStyles: Record<string, TextStyle> = {
    primary: { color: "#FFFFFF" },
    secondary: { color: isDarkMode ? "#FFFFFF" : "#1A1A1A" },
    danger: { color: "#FFFFFF" },
    ghost: { color: "#007AFF" },
  };

  const buttonStyles: StyleProp<ViewStyle> = [
    styles.base,
    variantStyles[variant],
    sizeStyles[size],
    disabled && styles.disabled,
    style,
  ];

  const textStyles: StyleProp<TextStyle> = [
    styles.text,
    textVariantStyles[variant],
    textSizeStyles[size],
    disabled && styles.textDisabled,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === "ghost"
              ? "#007AFF"
              : ((textVariantStyles[variant]?.color as string) ?? "#FFFFFF")
          }
        />
      ) : (
        <>
          {icon}
          <Text style={textStyles}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    gap: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: "600",
  },
  textDisabled: {
    opacity: 0.7,
  },
});

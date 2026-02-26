/**
 * @file
 * Reusable button component.
 *
 * A themed button with loading state, icon support, and
 * multiple visual variants.
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

const variantStyles: Record<string, ViewStyle> = {
  primary: { backgroundColor: "#007AFF" },
  secondary: { backgroundColor: "#2C2C2E", borderWidth: 1, borderColor: "#3C3C3E" },
  danger: { backgroundColor: "#FF3B30" },
  ghost: { backgroundColor: "transparent" },
};

const sizeStyles: Record<string, ViewStyle> = {
  small: { paddingHorizontal: 12, paddingVertical: 6 },
  medium: { paddingHorizontal: 16, paddingVertical: 10 },
  large: { paddingHorizontal: 24, paddingVertical: 14 },
};

const textVariantStyles: Record<string, TextStyle> = {
  primary: { color: "#FFFFFF" },
  secondary: { color: "#FFFFFF" },
  danger: { color: "#FFFFFF" },
  ghost: { color: "#007AFF" },
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
          color={variant === "ghost" ? "#007AFF" : "#FFFFFF"}
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

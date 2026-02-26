/**
 * @file
 * Liquid Glass text field component.
 *
 * A text input styled with the Liquid Glass design language.
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
import React, { useState, useRef, useCallback } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
  TextStyle,
  TextInputProps,
  Animated,
} from "react-native";
import * as Haptics from "expo-haptics";

/** Props for the LiquidGlassTextField component. */
export interface LiquidGlassTextFieldProps extends Omit<TextInputProps, "style"> {
  label?: string;
  helperText?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  haptic?: boolean;
}

/**
 * Text input styled with the Liquid Glass design language.
 * @param props - Component props
 * @returns The rendered component
 */
export function LiquidGlassTextField({
  label,
  helperText,
  error,
  leadingIcon,
  trailingIcon,
  style,
  inputStyle,
  haptic = true,
  onFocus,
  onBlur,
  ...textInputProps
}: LiquidGlassTextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = useCallback(
    (e: any) => {
      setIsFocused(true);
      if (haptic && Platform.OS === "ios")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.spring(borderAnim, {
        toValue: 1,
        useNativeDriver: false,
        tension: 300,
        friction: 25,
      }).start();
      onFocus?.(e);
    },
    [haptic, borderAnim, onFocus],
  );

  const handleBlur = useCallback(
    (e: any) => {
      setIsFocused(false);
      Animated.spring(borderAnim, {
        toValue: 0,
        useNativeDriver: false,
        tension: 300,
        friction: 25,
      }).start();
      onBlur?.(e);
    },
    [borderAnim, onBlur],
  );

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? "rgba(255,68,68,0.5)" : "rgba(255,255,255,0.1)",
      error ? "#FF4444" : "#FF2A2A",
    ],
  });

  return (
    <View style={[styles.wrapper, style]}>
      {label && (
        <Text style={[styles.label, error && styles.labelError]}>{label}</Text>
      )}

      <Animated.View
        style={[
          styles.inputContainer,
          {
            borderColor,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderRadius: 14,
          },
        ]}
      >
        <View style={styles.inputRow}>
          {leadingIcon && <View style={styles.leadingIcon}>{leadingIcon}</View>}
          <TextInput
            placeholderTextColor="rgba(255,255,255,0.35)"
            selectionColor="#FF2A2A"
            {...textInputProps}
            style={[styles.input, inputStyle]}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          {trailingIcon && <View style={styles.trailingIcon}>{trailingIcon}</View>}
        </View>
      </Animated.View>

      {(error || helperText) && (
        <Text style={[styles.helper, error && styles.helperError]}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: "100%" },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  labelError: { color: "#FF4444" },
  inputContainer: {
    overflow: "hidden",
    minHeight: 48,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    minHeight: 48,
  },
  leadingIcon: { marginRight: 10 },
  trailingIcon: { marginLeft: 10 },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#F5F5F5",
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  helper: { fontSize: 12, color: "#9A9A9A", marginTop: 6, marginLeft: 4 },
  helperError: { color: "#FF4444" },
});

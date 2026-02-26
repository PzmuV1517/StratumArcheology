/**
 * @file
 * Liquid Glass stepper component.
 *
 * An increment/decrement stepper styled with Liquid Glass.
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
import React, { useCallback } from "react";
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

/** Props for the LiquidGlassStepper component. */
export interface LiquidGlassStepperProps {
  value: number;
  onValueChange: (newValue: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Optional label shown between buttons */
  label?: string | ((value: number) => string);
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  disabled?: boolean;
}

/**
 * Increment/decrement stepper styled with Liquid Glass design.
 * @param props - Component props
 * @returns The rendered component
 */
export function LiquidGlassStepper({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  style,
  haptic = true,
  disabled = false,
}: LiquidGlassStepperProps) {
  const canDecrement = value - step >= min;
  const canIncrement = value + step <= max;

  const handleDecrement = useCallback(() => {
    if (!canDecrement || disabled) return;
    if (haptic && Platform.OS === "ios")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(Math.max(min, value - step));
  }, [value, step, min, canDecrement, haptic, disabled, onValueChange]);

  const handleIncrement = useCallback(() => {
    if (!canIncrement || disabled) return;
    if (haptic && Platform.OS === "ios")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(Math.min(max, value + step));
  }, [value, step, max, canIncrement, haptic, disabled, onValueChange]);

  const displayLabel =
    typeof label === "function" ? label(value) : (label ?? String(value));

  return (
    <View style={[styles.container, disabled && styles.disabled, style]}>
      {/* Minus */}
      <Pressable
        onPress={handleDecrement}
        disabled={!canDecrement || disabled}
        style={({ pressed }) => [
          styles.button,
          styles.leftButton,
          pressed && styles.buttonPressed,
          (!canDecrement || disabled) && styles.buttonDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Decrement"
      >
        <Text
          style={[
            styles.buttonText,
            (!canDecrement || disabled) && styles.textDisabled,
          ]}
        >
          −
        </Text>
      </Pressable>

      {/* Value / label */}
      <View style={styles.labelContainer}>
        <Text style={[styles.labelText, disabled && styles.textDisabled]}>
          {displayLabel}
        </Text>
      </View>

      {/* Plus */}
      <Pressable
        onPress={handleIncrement}
        disabled={!canIncrement || disabled}
        style={({ pressed }) => [
          styles.button,
          styles.rightButton,
          pressed && styles.buttonPressed,
          (!canIncrement || disabled) && styles.buttonDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Increment"
      >
        <Text
          style={[
            styles.buttonText,
            (!canIncrement || disabled) && styles.textDisabled,
          ]}
        >
          +
        </Text>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    alignSelf: "flex-start",
  },
  disabled: {
    opacity: 0.4,
  },
  button: {
    width: 44,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  leftButton: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(255,255,255,0.1)",
  },
  rightButton: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(255,255,255,0.1)",
  },
  buttonPressed: {
    backgroundColor: "rgba(255,42,42,0.15)",
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "500",
    color: "#FF2A2A",
  },
  textDisabled: {
    color: "#666",
  },
  labelContainer: {
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
  },
  labelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F5F5F5",
  },
});

/**
 * @file
 * Liquid Glass toggle switch component.
 *
 * A toggle switch styled with the Liquid Glass design language.
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
  Switch,
  View,
  Text,
  StyleSheet,
  Platform,
  ViewStyle,
  ColorValue,
} from "react-native";
import * as Haptics from "expo-haptics";

interface LiquidGlassSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: ViewStyle;
  haptic?: boolean;
}

// Track colors - iOS will get native Liquid Glass styling on iOS 26+
const TRACK_COLOR_ON: ColorValue = "#FF2A2A";
const TRACK_COLOR_OFF_IOS: ColorValue = "rgba(120, 120, 128, 0.32)";
const TRACK_COLOR_OFF_ANDROID: ColorValue = "rgba(255, 255, 255, 0.15)";

const trackColorOff =
  Platform.OS === "ios" ? TRACK_COLOR_OFF_IOS : TRACK_COLOR_OFF_ANDROID;
const thumbColor = Platform.OS === "android" ? "#F5F5F5" : undefined;

/**
 * Toggle switch styled with the Liquid Glass design language.
 * @param props - Component props
 * @returns The rendered component
 */
export function LiquidGlassSwitch({
  value,
  onValueChange,
  label,
  disabled = false,
  style,
  haptic = true,
}: LiquidGlassSwitchProps) {
  const handleValueChange = (newValue: boolean) => {
    if (haptic && Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onValueChange(newValue);
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
      )}
      <Switch
        value={value}
        onValueChange={handleValueChange}
        disabled={disabled}
        trackColor={{ false: trackColorOff, true: TRACK_COLOR_ON }}
        thumbColor={thumbColor}
        ios_backgroundColor={trackColorOff}
        style={disabled ? styles.switchDisabled : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 16,
    color: "#F5F5F5",
    flex: 1,
    marginRight: 12,
  },
  labelDisabled: {
    opacity: 0.5,
  },
  switchDisabled: {
    opacity: 0.5,
  },
});

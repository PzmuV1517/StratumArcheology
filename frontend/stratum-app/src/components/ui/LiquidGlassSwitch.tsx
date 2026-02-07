/**
 * LiquidGlassSwitch
 *
 * A switch/toggle component with iOS 26 Liquid Glass styling on supported devices.
 * Uses native Switch on iOS (which automatically gets Liquid Glass on iOS 26+).
 * Falls back to styled switch on Android.
 */
import React from "react";
import {
  Switch,
  View,
  Text,
  StyleSheet,
  Platform,
  ViewStyle,
  DynamicColorIOS,
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

// iOS dynamic colors for proper light/dark mode support
const trackColorOn = Platform.select({
  ios: DynamicColorIOS({
    light: "#FF2A2A",
    dark: "#FF2A2A",
  }),
  default: "#FF2A2A",
}) as string;

const trackColorOff = Platform.select({
  ios: DynamicColorIOS({
    light: "rgba(120, 120, 128, 0.32)",
    dark: "rgba(120, 120, 128, 0.32)",
  }),
  default: "rgba(255, 255, 255, 0.15)",
}) as string;

const thumbColor = Platform.select({
  ios: undefined, // Let iOS use its native thumb
  android: "#F5F5F5",
});

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
        <Text style={[styles.label, disabled && styles.labelDisabled]}>
          {label}
        </Text>
      )}
      <Switch
        value={value}
        onValueChange={handleValueChange}
        disabled={disabled}
        trackColor={{ false: trackColorOff, true: trackColorOn }}
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

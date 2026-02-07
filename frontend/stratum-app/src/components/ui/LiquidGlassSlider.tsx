/**
 * LiquidGlassSlider
 *
 * A slider component with iOS 26 Liquid Glass styling on supported devices.
 * Uses @react-native-community/slider for native performance.
 * Falls back to a styled slider on unsupported platforms.
 */
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ViewStyle,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  LayoutChangeEvent,
} from "react-native";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { LiquidGlassView, isLiquidGlassSupported } from "@/src/utils/liquidGlass";

interface LiquidGlassSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  haptic?: boolean;
}

export function LiquidGlassSlider({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  label,
  showValue = true,
  disabled = false,
  style,
  haptic = true,
}: LiquidGlassSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const range = maximumValue - minimumValue;
  const normalizedValue = (value - minimumValue) / range;
  const fillWidth = normalizedValue * trackWidth;

  const calculateValue = useCallback(
    (gestureX: number) => {
      const clampedX = Math.max(0, Math.min(gestureX, trackWidth));
      const rawValue = (clampedX / trackWidth) * range + minimumValue;
      const steppedValue = Math.round(rawValue / step) * step;
      return Math.max(minimumValue, Math.min(maximumValue, steppedValue));
    },
    [trackWidth, range, minimumValue, maximumValue, step],
  );

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: (evt: GestureResponderEvent) => {
      setIsDragging(true);
      if (haptic && Platform.OS === "ios") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const newValue = calculateValue(evt.nativeEvent.locationX);
      if (newValue !== value) {
        onValueChange(newValue);
      }
    },
    onPanResponderMove: (
      _: GestureResponderEvent,
      gestureState: PanResponderGestureState,
    ) => {
      const newX =
        gestureState.moveX - gestureState.x0 + normalizedValue * trackWidth;
      const newValue = calculateValue(newX);
      if (newValue !== value) {
        onValueChange(newValue);
      }
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      if (haptic && Platform.OS === "ios") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    },
  });

  const onLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const useNativeLiquidGlass = Platform.OS === "ios" && isLiquidGlassSupported;
  const useBlurFallback = Platform.OS === "ios" && !isLiquidGlassSupported;

  const ThumbComponent = useNativeLiquidGlass
    ? LiquidGlassView
    : useBlurFallback
      ? BlurView
      : View;

  const thumbProps = useNativeLiquidGlass
    ? { effect: "regular" }
    : useBlurFallback
      ? { intensity: 60, tint: "light" as const }
      : {};

  return (
    <View style={[styles.container, style]}>
      {(label || showValue) && (
        <View style={styles.labelRow}>
          {label && (
            <Text style={[styles.label, disabled && styles.disabled]}>{label}</Text>
          )}
          {showValue && (
            <Text style={[styles.value, disabled && styles.disabled]}>
              {Math.round(value)}
            </Text>
          )}
        </View>
      )}

      <View
        style={[styles.trackContainer, disabled && styles.disabled]}
        onLayout={onLayout}
        {...panResponder.panHandlers}
      >
        {/* Background track */}
        <View style={styles.trackBackground} />

        {/* Filled track */}
        <View style={[styles.trackFill, { width: fillWidth }]} />

        {/* Thumb */}
        <ThumbComponent
          style={[
            styles.thumb,
            useBlurFallback && styles.thumbBlur,
            !useNativeLiquidGlass && !useBlurFallback && styles.thumbSolid,
            { left: fillWidth - 14 },
            isDragging && styles.thumbActive,
          ]}
          {...thumbProps}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    color: "#F5F5F5",
  },
  value: {
    fontSize: 16,
    color: "#9A9A9A",
    fontVariant: ["tabular-nums"],
  },
  trackContainer: {
    height: 44,
    justifyContent: "center",
  },
  trackBackground: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 3,
  },
  trackFill: {
    position: "absolute",
    height: 6,
    backgroundColor: "#FF2A2A",
    borderRadius: 3,
  },
  thumb: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  thumbBlur: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  thumbSolid: {
    backgroundColor: "#F5F5F5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  thumbActive: {
    transform: [{ scale: 1.15 }],
  },
  disabled: {
    opacity: 0.5,
  },
});

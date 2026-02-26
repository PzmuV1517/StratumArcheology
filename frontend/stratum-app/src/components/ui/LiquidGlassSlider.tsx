/**
 * @file
 * Liquid Glass slider component.
 *
 * A range slider styled with the Liquid Glass design language.
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

const isIOS = Platform.OS === "ios";

/* ---------- Try native slider (UISlider on iOS) ---------- */
let NativeSlider: React.ComponentType<any> | null = null;
try {
  NativeSlider = require("@react-native-community/slider").default;
} catch {
  NativeSlider = null;
}

/* --------------------------------------------------------- */

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

/**
 * Range slider styled with the Liquid Glass design language.
 * @param props - Component props
 * @returns The rendered component
 */
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
  /* ---------- Native slider path (UISlider auto Liquid Glass) ---------- */
  if (NativeSlider) {
    return (
      <View style={[styles.container, style]}>
        {(label || showValue) && (
          <View style={styles.labelRow}>
            {label && (
              <Text style={[styles.label, disabled && styles.disabled]}>
                {label}
              </Text>
            )}
            {showValue && (
              <Text style={[styles.value, disabled && styles.disabled]}>
                {Math.round(value)}
              </Text>
            )}
          </View>
        )}
        <NativeSlider
          value={value}
          onValueChange={(v: number) => {
            const snapped = Math.round(v / step) * step;
            onValueChange(Math.max(minimumValue, Math.min(maximumValue, snapped)));
          }}
          minimumValue={minimumValue}
          maximumValue={maximumValue}
          step={step}
          disabled={disabled}
          minimumTrackTintColor="#FF2A2A"
          maximumTrackTintColor="rgba(255, 255, 255, 0.12)"
          thumbTintColor={isIOS ? undefined : "#F5F5F5"}
          style={[styles.nativeSlider, disabled && styles.disabled]}
        />
      </View>
    );
  }

  /* ---------- Custom fallback (PanResponder + BlurView thumb) ---------- */
  return (
    <FallbackSlider
      {...{
        value,
        onValueChange,
        minimumValue,
        maximumValue,
        step,
        label,
        showValue,
        disabled,
        style,
        haptic,
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Fallback slider used when @react-native-community/slider is absent */
/* ------------------------------------------------------------------ */

function FallbackSlider({
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
      if (haptic && isIOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newValue = calculateValue(evt.nativeEvent.locationX);
      if (newValue !== value) onValueChange(newValue);
    },
    onPanResponderMove: (
      _: GestureResponderEvent,
      gestureState: PanResponderGestureState,
    ) => {
      const newX =
        gestureState.moveX - gestureState.x0 + normalizedValue * trackWidth;
      const newValue = calculateValue(newX);
      if (newValue !== value) onValueChange(newValue);
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      if (haptic && isIOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
  });

  const onLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  // iOS: BlurView thumb. Android: solid thumb.
  const ThumbComponent = isIOS ? BlurView : View;
  const thumbProps = isIOS ? { intensity: 60, tint: "light" as const } : {};

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
        <View style={styles.trackBackground} />
        <View style={[styles.trackFill, { width: fillWidth }]} />
        <ThumbComponent
          style={[
            styles.thumb,
            isIOS && styles.thumbBlur,
            !isIOS && styles.thumbSolid,
            { left: fillWidth - 14 },
            isDragging && styles.thumbActive,
          ]}
          {...thumbProps}
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { width: "100%" },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: { fontSize: 16, color: "#F5F5F5" },
  value: { fontSize: 16, color: "#9A9A9A", fontVariant: ["tabular-nums"] },
  nativeSlider: { width: "100%", height: 44 },
  trackContainer: { height: 44, justifyContent: "center" },
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
  thumb: { position: "absolute", width: 28, height: 28, borderRadius: 14 },
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
  thumbActive: { transform: [{ scale: 1.15 }] },
  disabled: { opacity: 0.5 },
});

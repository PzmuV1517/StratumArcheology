/**
 * @file
 * Liquid Glass segmented control component.
 *
 * A segmented control styled with the Liquid Glass design language.
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
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

// Try to import native SegmentedControl — it auto-renders with Liquid Glass on iOS 26+
let NativeSegmentedControl: React.ComponentType<any> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@react-native-segmented-control/segmented-control");
  NativeSegmentedControl = mod.default || mod;
} catch {
  // Package not installed — use custom implementation
}

/** A single segment item definition. */
export interface SegmentItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

/** Props for the LiquidGlassSegmentedControl component. */
export interface LiquidGlassSegmentedControlProps {
  segments: SegmentItem[];
  selectedKey: string;
  onSelect: (key: string) => void;
  activeColor?: string;
  inactiveColor?: string;
  accentColor?: string;
  height?: number;
  borderRadius?: number;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
}

/**
 * Segmented control using native UISegmentedControl on iOS or custom fallback.
 * @param props - Component props
 * @returns The rendered component
 */
export function LiquidGlassSegmentedControl({
  segments,
  selectedKey,
  onSelect,
  activeColor = "#FFFFFF",
  inactiveColor = "#9A9A9A",
  accentColor = "#FF2A2A",
  height = 40,
  borderRadius = 12,
  haptic = true,
  style,
  labelStyle,
  disabled = false,
}: LiquidGlassSegmentedControlProps) {
  const selectedIndex = segments.findIndex((s) => s.key === selectedKey);

  // iOS with native SegmentedControl — auto Liquid Glass on iOS 26+
  if (
    Platform.OS === "ios" &&
    NativeSegmentedControl &&
    !segments.some((s) => s.icon)
  ) {
    return (
      <View style={style}>
        <NativeSegmentedControl
          values={segments.map((s) => s.label)}
          selectedIndex={Math.max(0, selectedIndex)}
          onChange={(event: any) => {
            const idx = event.nativeEvent.selectedSegmentIndex;
            if (segments[idx] && segments[idx].key !== selectedKey) {
              if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(segments[idx].key);
            }
          }}
          enabled={!disabled}
          tintColor={accentColor}
          fontStyle={{ color: inactiveColor, fontWeight: "600", fontSize: 13 }}
          activeFontStyle={{ color: activeColor, fontWeight: "700", fontSize: 13 }}
          style={{ height }}
          appearance="dark"
        />
      </View>
    );
  }

  // Custom fallback (Android, or iOS without native package, or segments with icons)
  return (
    <CustomSegmented
      segments={segments}
      selectedKey={selectedKey}
      onSelect={onSelect}
      activeColor={activeColor}
      inactiveColor={inactiveColor}
      height={height}
      borderRadius={borderRadius}
      haptic={haptic}
      style={style}
      labelStyle={labelStyle}
      disabled={disabled}
    />
  );
}

// ── Custom implementation ───────────────────────────────────────────────────

function CustomSegmented({
  segments,
  selectedKey,
  onSelect,
  activeColor,
  inactiveColor,
  height,
  borderRadius,
  haptic,
  style,
  labelStyle,
  disabled,
}: Omit<LiquidGlassSegmentedControlProps, "accentColor">) {
  const [containerWidth, setContainerWidth] = useState(0);
  const segmentWidth = containerWidth / segments.length;
  const selectedIndex = segments.findIndex((s) => s.key === selectedKey);
  const clampedIndex = Math.max(0, selectedIndex);
  const indicatorAnim = useRef(new Animated.Value(clampedIndex)).current;

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: clampedIndex,
      useNativeDriver: true,
      tension: 300,
      friction: 30,
    }).start();
  }, [clampedIndex, indicatorAnim]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width),
    [],
  );

  const translateX = indicatorAnim.interpolate({
    inputRange: segments.map((_, i) => i),
    outputRange: segments.map((_, i) => i * segmentWidth + 3),
    extrapolate: "clamp",
  });

  return (
    <View
      style={[styles.container, { height, borderRadius }, style]}
      onLayout={onLayout}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(255,255,255,0.08)", borderRadius },
        ]}
      />
      {containerWidth > 0 && (
        <Animated.View
          style={[
            styles.indicator,
            {
              width: segmentWidth - 6,
              height: (height ?? 40) - 6,
              borderRadius: (borderRadius ?? 12) - 3,
              transform: [{ translateX }],
            },
          ]}
        />
      )}
      {segments.map((segment) => {
        const isActive = segment.key === selectedKey;
        const color = isActive ? activeColor : inactiveColor;
        return (
          <TouchableOpacity
            key={segment.key}
            style={styles.segment}
            activeOpacity={0.7}
            disabled={disabled}
            onPress={() => {
              if (segment.key !== selectedKey) {
                if (haptic && Platform.OS === "ios")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(segment.key);
              }
            }}
          >
            {segment.icon && <View style={styles.segmentIcon}>{segment.icon}</View>}
            <Text
              style={[
                styles.segmentLabel,
                { color },
                isActive && styles.segmentLabelActive,
                labelStyle,
              ]}
              numberOfLines={1}
            >
              {segment.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", overflow: "hidden" },
  indicator: {
    position: "absolute",
    top: 3,
    left: 0,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    zIndex: 1,
  },
  segmentIcon: { marginRight: 6 },
  segmentLabel: { fontSize: 13, fontWeight: "600", letterSpacing: 0.2 },
  segmentLabelActive: { fontWeight: "700" },
});

/**
 * @file
 * Liquid Glass toolbar component.
 *
 * A toolbar with frosted glass visual effect.
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
  View,
  Pressable,
  Text,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

const isIOS = Platform.OS === "ios";

/* ------------------------------------------------------------------ */

/** Configuration for a single toolbar item. */
export interface ToolbarItem {
  key: string;
  icon?: React.ReactNode;
  label?: string;
  onPress?: () => void;
  disabled?: boolean;
}

/** Props for the LiquidGlassToolbar component. */
export interface LiquidGlassToolbarProps {
  items: ToolbarItem[];
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  /** Show labels below icons */
  showLabels?: boolean;
}

/**
 * Toolbar with frosted glass visual effect.
 * @param props - Component props
 * @returns The rendered component
 */
export function LiquidGlassToolbar({
  items,
  style,
  haptic = true,
  showLabels = false,
}: LiquidGlassToolbarProps) {
  const inner = (
    <View style={styles.row}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => {
            if (haptic && isIOS)
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            item.onPress?.();
          }}
          disabled={item.disabled}
          style={({ pressed }) => [
            styles.item,
            pressed && styles.itemPressed,
            item.disabled && styles.itemDisabled,
          ]}
        >
          {item.icon}
          {showLabels && item.label && (
            <Text
              style={[styles.label, item.disabled && styles.labelDisabled]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );

  if (isIOS) {
    return (
      <BlurView
        intensity={30}
        tint="dark"
        style={[styles.container, styles.blurContainer, style]}
      >
        {inner}
      </BlurView>
    );
  }

  return (
    <View style={[styles.container, styles.fallbackContainer, style]}>{inner}</View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
    overflow: "hidden",
    minHeight: 48,
  },
  blurContainer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  fallbackContainer: {
    backgroundColor: "rgba(30,30,30,0.85)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  itemPressed: {
    opacity: 0.6,
  },
  itemDisabled: {
    opacity: 0.35,
  },
  label: {
    fontSize: 10,
    color: "#F5F5F5",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  labelDisabled: {
    color: "#666",
  },
});

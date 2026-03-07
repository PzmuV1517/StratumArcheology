/**
 * @file
 * Liquid Glass card component.
 *
 * A card with frosted glass visual effect following Apple's
 * Liquid Glass design language.
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
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

const isIOS = Platform.OS === "ios";

/* ------------------------------------------------------------------ */

/** Props for the LiquidGlassCard component. */
export interface LiquidGlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** If provided, card becomes pressable */
  onPress?: () => void;
  haptic?: boolean;
  /** Padding preset */
  padding?: "none" | "sm" | "md" | "lg";
  /** Corner radius */
  radius?: number;
}

const PADDING_MAP = { none: 0, sm: 10, md: 16, lg: 24 } as const;

/**
 * Card with frosted glass visual effect following Apple's Liquid Glass design.
 * @param props - Component props
 * @returns The rendered component
 */
export function LiquidGlassCard({
  children,
  style,
  onPress,
  haptic = true,
  padding = "md",
  radius = 20,
}: LiquidGlassCardProps) {
  const padValue = PADDING_MAP[padding];

  const innerContent = <View style={{ padding: padValue }}>{children}</View>;

  const containerStyle: ViewStyle[] = [styles.container, { borderRadius: radius }];

  const renderCard = (content: React.ReactNode) => {
    if (isIOS) {
      return (
        <BlurView
          intensity={20}
          tint="dark"
          style={[...containerStyle, styles.blurCard, style]}
        >
          {content}
        </BlurView>
      );
    }
    return (
      <View style={[...containerStyle, styles.fallback, style]}>{content}</View>
    );
  };

  if (onPress) {
    return renderCard(
      <Pressable
        onPress={() => {
          if (haptic && isIOS)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {innerContent}
      </Pressable>,
    );
  }

  return renderCard(innerContent);
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  blurCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  fallback: {
    backgroundColor: "rgba(30,30,30,0.65)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  pressed: {
    opacity: 0.7,
  },
});

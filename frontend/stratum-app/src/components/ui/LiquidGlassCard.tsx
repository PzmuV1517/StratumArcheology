/**
 * LiquidGlassCard
 *
 * Maps to the refreshed Lists / Forms / Sidebar cell appearance on iOS 26+.
 * UITableView and UICollectionView sections automatically adopt glass
 * containers. Since React Native doesn't expose these as card components,
 * we use BlurView (UIVisualEffectView) to approximate the native glass
 * section appearance.
 *
 * No @callstack/liquid-glass dependency — uses native UIKit rendering.
 *
 * Apple reference: Lists, Forms, Sidebar cells — automatic glass sections.
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

export function LiquidGlassCard({
  children,
  style,
  onPress,
  haptic = true,
  padding = "md",
  radius = 20,
}: LiquidGlassCardProps) {
  const padValue = PADDING_MAP[padding];

  const innerContent = (
    <View style={{ padding: padValue }}>{children}</View>
  );

  const containerStyle: ViewStyle[] = [styles.container, { borderRadius: radius }];

  const renderCard = (content: React.ReactNode) => {
    if (isIOS) {
      return (
        <BlurView intensity={20} tint="dark" style={[...containerStyle, styles.blurCard, style]}>
          {content}
        </BlurView>
      );
    }
    return <View style={[...containerStyle, styles.fallback, style]}>{content}</View>;
  };

  if (onPress) {
    return renderCard(
      <Pressable
        onPress={() => {
          if (haptic && isIOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

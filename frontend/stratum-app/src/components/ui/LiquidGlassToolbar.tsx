/**
 * LiquidGlassToolbar
 *
 * Maps to UIToolbar on iOS — toolbar items automatically adopt Liquid Glass
 * grouping on iOS 26+. Since React Native doesn't expose UIToolbar directly,
 * we use BlurView (UIVisualEffectView) to approximate the native glass
 * bar appearance.
 *
 * No @callstack/liquid-glass dependency — uses native UIKit rendering.
 *
 * Apple reference: UIToolbar — automatic glass grouping on iOS 26+.
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

export interface ToolbarItem {
  key: string;
  icon?: React.ReactNode;
  label?: string;
  onPress?: () => void;
  disabled?: boolean;
}

export interface LiquidGlassToolbarProps {
  items: ToolbarItem[];
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  /** Show labels below icons */
  showLabels?: boolean;
}

export function LiquidGlassToolbar({ items, style, haptic = true, showLabels = false }: LiquidGlassToolbarProps) {
  const inner = (
    <View style={styles.row}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => {
            if (haptic && isIOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            item.onPress?.();
          }}
          disabled={item.disabled}
          style={({ pressed }) => [styles.item, pressed && styles.itemPressed, item.disabled && styles.itemDisabled]}
        >
          {item.icon}
          {showLabels && item.label && (
            <Text style={[styles.label, item.disabled && styles.labelDisabled]} numberOfLines={1}>
              {item.label}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );

  if (isIOS) {
    return (
      <BlurView intensity={30} tint="dark" style={[styles.container, styles.blurContainer, style]}>
        {inner}
      </BlurView>
    );
  }

  return <View style={[styles.container, styles.fallbackContainer, style]}>{inner}</View>;
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

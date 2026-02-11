/**
 * LiquidGlassNavBar
 *
 * iOS: A thin helper that configures a native Stack.Screen header with
 * `headerTransparent` + `headerBlurEffect: "systemChromeMaterial"` — the
 * exact pattern used throughout the app (join-project, artefact, edit-note…).
 * On iOS 26+ the native header automatically renders with Liquid Glass.
 * On older iOS it renders with a system chrome blur.
 *
 * Android: Renders a simple opaque header bar.
 *
 * Usage — wrap your screen options:
 *   const navBarOptions = getLiquidGlassNavBarOptions({ title: "Details" });
 *   <Stack.Screen options={{ ...navBarOptions, headerRight: () => <MyButton /> }} />
 *
 * Or use the component directly for non-Stack screens:
 *   <LiquidGlassNavBar title="Details" onBack={router.back} headerRight={<MyButton />} />
 *
 * Apple reference: UINavigationBar — gets Liquid Glass automatically on iOS 26+.
 */
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ── Stack.Screen options helper (preferred approach) ────────────────────────

export interface LiquidGlassNavBarOptionsConfig {
  title?: string;
  headerLargeTitle?: boolean;
}

/**
 * Returns Stack.Screen `options` that produce a native Liquid Glass nav bar
 * on iOS 26+ and a system chrome blur on older iOS.
 * Merge with your own options:
 *   <Stack.Screen options={{ ...getLiquidGlassNavBarOptions({ title }), headerRight: () => <Btn /> }} />
 */
export function getLiquidGlassNavBarOptions(config?: LiquidGlassNavBarOptionsConfig) {
  const isIOS = Platform.OS === "ios";
  return {
    headerShown: true,
    title: config?.title ?? "",
    headerTransparent: isIOS,
    headerBlurEffect: isIOS ? ("systemChromeMaterial" as const) : undefined,
    headerLargeTitle: config?.headerLargeTitle ?? false,
    headerStyle: isIOS
      ? undefined
      : { backgroundColor: "#1A1A1A" },
    headerTintColor: "#FF2A2A",
    headerTitleStyle: {
      color: "#F5F5F5",
      fontWeight: "600" as const,
    },
  };
}

// ── Standalone component (for non-Stack screens) ────────────────────────────

export interface LiquidGlassNavBarProps {
  title?: string;
  largeTitle?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  backLabel?: string;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  haptic?: boolean;
}

const NAV_BAR_HEIGHT = 44;

export function LiquidGlassNavBar({
  title,
  largeTitle = false,
  showBack = false,
  onBack,
  backLabel,
  headerLeft,
  headerRight,
  style,
  titleStyle,
  haptic = true,
}: LiquidGlassNavBarProps) {
  const insets = useSafeAreaInsets();
  const totalHeight = NAV_BAR_HEIGHT + insets.top;

  return (
    <View
      style={[
        styles.container,
        { height: totalHeight, backgroundColor: "#1A1A1A" },
        style,
      ]}
    >
      <View style={[styles.content, { paddingTop: insets.top }]}>
        <View style={styles.left}>
          {headerLeft || (showBack && (
            <TouchableOpacity
              onPress={() => {
                if (haptic && Platform.OS === "ios") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                onBack?.();
              }}
              style={styles.backButton}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={24} color="#FF2A2A" />
              {backLabel && <Text style={styles.backLabel}>{backLabel}</Text>}
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.center}>
          {title && !largeTitle && (
            <Text style={[styles.title, titleStyle]} numberOfLines={1}>{title}</Text>
          )}
        </View>
        <View style={styles.right}>{headerRight}</View>
      </View>

      {largeTitle && title && (
        <View style={styles.largeTitleRow}>
          <Text style={[styles.largeTitle, titleStyle]} numberOfLines={1}>{title}</Text>
        </View>
      )}

      <View style={styles.separator} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  content: {
    height: NAV_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  left: { flexDirection: "row", alignItems: "center", minWidth: 60 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  right: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", minWidth: 60 },
  title: { fontSize: 17, fontWeight: "600", color: "#F5F5F5", letterSpacing: 0.2 },
  backButton: { flexDirection: "row", alignItems: "center" },
  backLabel: { fontSize: 17, color: "#FF2A2A", marginLeft: 2 },
  largeTitleRow: { paddingHorizontal: 20, paddingVertical: 8 },
  largeTitle: { fontSize: 34, fontWeight: "700", color: "#F5F5F5", letterSpacing: 0.3 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.05)" },
});

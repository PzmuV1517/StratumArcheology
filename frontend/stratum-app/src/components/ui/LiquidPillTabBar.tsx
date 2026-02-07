/**
 * LiquidPillTabBar – Pill-shaped floating tab bar with Liquid Glass / Blur / Solid background.
 *
 * Drop-in replacement for the default React-Navigation bottom tab bar.
 * Supports swipe gestures on the pill to navigate between visible tabs and
 * an animated indicator that tracks the active tab.
 *
 * Usage:
 *   <Tabs tabBar={(props) => <LiquidPillTabBar {...props} />} … />
 *
 * Props (all optional besides BottomTabBarProps):
 *   hiddenRouteNames – route names to hide from the bar (default: [])
 *   activeColor      – tint for the active tab (default: "#FF2A2A")
 *   inactiveColor    – tint for inactive tabs  (default: "#9A9A9A")
 *   pillHeight       – bar height              (default: 64)
 *   pillMarginH      – horizontal margin       (default: 20)
 *   pillRadius       – border-radius           (default: 32)
 *   bottomOffset     – min distance from bottom(default: 24)
 */
import React, { useEffect, useRef, useCallback } from "react";
import {
  Platform,
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Animated,
  Dimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, { runOnJS } from "react-native-reanimated";
import { LiquidGlassView, isLiquidGlassSupported } from "@/src/utils/liquidGlass";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LiquidPillTabBarProps extends BottomTabBarProps {
  /** Route names that should be hidden from the tab bar */
  hiddenRouteNames?: string[];
  /** Active tab tint colour */
  activeColor?: string;
  /** Inactive tab tint colour */
  inactiveColor?: string;
  /** Height of the pill */
  pillHeight?: number;
  /** Horizontal margin around the pill */
  pillMarginH?: number;
  /** Border radius of the pill */
  pillRadius?: number;
  /** Minimum distance from the bottom of the screen */
  bottomOffset?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LiquidPillTabBar({
  state,
  descriptors,
  navigation,
  hiddenRouteNames = [],
  activeColor = "#FF2A2A",
  inactiveColor = "#9A9A9A",
  pillHeight = 64,
  pillMarginH = 20,
  pillRadius = 32,
  bottomOffset = 24,
}: LiquidPillTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, bottomOffset);
  const screenWidth = Dimensions.get("window").width;
  const pillWidth = screenWidth - pillMarginH * 2;

  // Filter out hidden tabs (href: null or explicitly hidden routes)
  const visibleRoutes = state.routes.filter((route) => {
    if (hiddenRouteNames.includes(route.name)) return false;
    const options = descriptors[route.key]?.options;
    if ((options as any)?.href === null) return false;
    return true;
  });

  const visibleCount = visibleRoutes.length;
  const tabWidth = pillWidth / visibleCount;

  // ---- Swipe gesture on the pill bar ----
  const navigateBySwipe = useCallback(
    (direction: "left" | "right") => {
      const currentIdx = visibleRoutes.findIndex(
        (r) => r.key === state.routes[state.index]?.key,
      );
      const newIdx =
        direction === "left"
          ? Math.min(currentIdx + 1, visibleCount - 1)
          : Math.max(currentIdx - 1, 0);
      if (newIdx !== currentIdx && newIdx >= 0 && newIdx < visibleCount) {
        if (Platform.OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        const targetRoute = visibleRoutes[newIdx];
        navigation.navigate(targetRoute.name, targetRoute.params);
      }
    },
    [visibleRoutes, state, navigation, visibleCount],
  );

  const pillSwipeGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onEnd((event) => {
      "worklet";
      if (event.translationX < -40) {
        runOnJS(navigateBySwipe)("left");
      } else if (event.translationX > 40) {
        runOnJS(navigateBySwipe)("right");
      }
    });

  // ---- Animated indicator position ----
  const visibleIndex = visibleRoutes.findIndex(
    (r) => r.key === state.routes[state.index]?.key,
  );
  const indicatorAnim = useRef(new Animated.Value(visibleIndex)).current;

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: visibleIndex,
      useNativeDriver: true,
      tension: 300,
      friction: 30,
    }).start();
  }, [indicatorAnim, visibleIndex]);

  const indicatorTranslateX = indicatorAnim.interpolate({
    inputRange: visibleRoutes.map((_, i) => i),
    outputRange: visibleRoutes.map((_, i) => i * tabWidth),
  });

  // ---- Background renderer ----
  const renderBackground = () => {
    if (Platform.OS === "ios" && isLiquidGlassSupported) {
      return (
        <LiquidGlassView
          style={[StyleSheet.absoluteFill, { borderRadius: pillRadius }]}
          effect="regular"
        />
      );
    }
    if (Platform.OS === "ios") {
      return (
        <BlurView
          intensity={60}
          tint="systemChromeMaterialDark"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: pillRadius, overflow: "hidden" },
          ]}
        />
      );
    }
    // Android / web
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "rgba(26, 26, 26, 0.95)",
            borderRadius: pillRadius,
          },
        ]}
      />
    );
  };

  // ---- Render ----
  return (
    <View
      style={[styles.wrapper, { paddingBottom: bottomPadding }]}
      pointerEvents="box-none"
    >
      <GestureDetector gesture={pillSwipeGesture}>
        <Reanimated.View
          style={[
            styles.pill,
            {
              height: pillHeight,
              marginHorizontal: pillMarginH,
              borderRadius: pillRadius,
            },
          ]}
        >
          {renderBackground()}

          {/* Animated indicator */}
          <Animated.View
            style={[
              styles.indicator,
              {
                width: tabWidth - 16,
                backgroundColor: activeColor,
                transform: [{ translateX: Animated.add(indicatorTranslateX, 8) }],
              },
            ]}
          />

          {/* Tab buttons */}
          {visibleRoutes.map((route) => {
            const options = descriptors[route.key]?.options;
            const routeIndex = state.routes.indexOf(route);
            const isFocused = state.index === routeIndex;
            const color = isFocused ? activeColor : inactiveColor;

            const onPress = () => {
              if (Platform.OS === "ios") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              });
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options?.tabBarAccessibilityLabel}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tab}
                activeOpacity={0.7}
              >
                {options?.tabBarIcon?.({
                  focused: isFocused,
                  color,
                  size: 24,
                })}
                <Text
                  style={[styles.label, { color }, isFocused && styles.labelActive]}
                  numberOfLines={1}
                >
                  {options?.title ?? route.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "box-none",
  },
  pill: {
    flexDirection: "row",
    overflow: "hidden",
    alignSelf: "stretch",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.1)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },
  indicator: {
    position: "absolute",
    bottom: 6,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  labelActive: {
    fontWeight: "700",
  },
});

export default LiquidPillTabBar;

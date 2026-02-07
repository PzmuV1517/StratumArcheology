/**
 * SplitPillTabBar – iOS 26 style split toolbar with two glass groups.
 *
 * Main tabs sit in a wide elongated glass pill on the left, while the
 * "more" button is separated in its own circular glass pill on the right –
 * matching the UIToolbar `fixedSpace()` pattern from iOS 26.
 *
 * Drop-in replacement for LiquidPillTabBar in the project detail screen.
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
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SplitPillTabBarProps extends BottomTabBarProps {
  /** Route names that should be hidden from the bar */
  hiddenRouteNames?: string[];
  /** Map certain active route names to a visible route name */
  activeRouteNameMap?: Record<string, string>;
  /** Active tab tint colour */
  activeColor?: string;
  /** Inactive tab tint colour */
  inactiveColor?: string;
  /** Height of the pills */
  pillHeight?: number;
  /** Horizontal margin around the bar */
  pillMarginH?: number;
  /** Border radius of the main pill */
  pillRadius?: number;
  /** Minimum distance from the bottom of the screen */
  bottomOffset?: number;
  /** Gap between the main pill and the more pill */
  splitGap?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SplitPillTabBar({
  state,
  descriptors,
  navigation,
  hiddenRouteNames = [],
  activeRouteNameMap = {},
  activeColor = "#FF2A2A",
  inactiveColor = "#9A9A9A",
  pillHeight = 56,
  pillMarginH = 16,
  pillRadius = 28,
  bottomOffset = 24,
  splitGap = 10,
}: SplitPillTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, bottomOffset);
  const screenWidth = Dimensions.get("window").width;
  const moreButtonSize = pillHeight; // circular, same height as pill
  const totalBarWidth = screenWidth - pillMarginH * 2;
  const mainPillWidth = totalBarWidth - moreButtonSize - splitGap;

  // Separate "more" route from visible main routes
  const mainRoutes = state.routes.filter((route) => {
    if (route.name === "more") return false;
    if (hiddenRouteNames.includes(route.name)) return false;
    const options = descriptors[route.key]?.options;
    if ((options as any)?.href === null) return false;
    return true;
  });

  const moreRoute = state.routes.find((r) => r.name === "more");
  const mainCount = mainRoutes.length;
  const tabWidth = mainPillWidth / mainCount;

  const activeRouteName = state.routes[state.index]?.name;
  const effectiveActiveRouteName =
    (activeRouteName && activeRouteNameMap[activeRouteName]) || activeRouteName;

  // Is a "more"-category route currently active?
  const isMoreActive =
    effectiveActiveRouteName === "more" ||
    hiddenRouteNames.includes(activeRouteName ?? "");

  // ---- Swipe gesture on the main pill ----
  const navigateBySwipe = useCallback(
    (direction: "left" | "right") => {
      const currentIdx = mainRoutes.findIndex(
        (r) => r.name === effectiveActiveRouteName,
      );
      if (currentIdx < 0) return;
      const newIdx =
        direction === "left"
          ? Math.min(currentIdx + 1, mainCount - 1)
          : Math.max(currentIdx - 1, 0);
      if (newIdx !== currentIdx && newIdx >= 0 && newIdx < mainCount) {
        if (Platform.OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        const targetRoute = mainRoutes[newIdx];
        navigation.navigate(targetRoute.name, targetRoute.params);
      }
    },
    [mainRoutes, navigation, mainCount, effectiveActiveRouteName],
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
  const visibleIndex = mainRoutes.findIndex(
    (r) => r.name === effectiveActiveRouteName,
  );
  const clampedVisibleIndex = Math.max(0, visibleIndex);
  const indicatorAnim = useRef(new Animated.Value(clampedVisibleIndex)).current;

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: clampedVisibleIndex,
      useNativeDriver: true,
      tension: 300,
      friction: 30,
    }).start();
  }, [indicatorAnim, clampedVisibleIndex]);

  const indicatorTranslateX = indicatorAnim.interpolate({
    inputRange: mainRoutes.map((_, i) => i),
    outputRange: mainRoutes.map((_, i) => i * tabWidth),
  });

  // No renderGlassBackground — BlurView IS the container on iOS.
  // On iOS 26+, UIVisualEffectView automatically renders with Liquid Glass.
  const isIOS = Platform.OS === "ios";

  // ---- "More" button press ----
  const onMorePress = () => {
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (moreRoute) {
      const event = navigation.emit({
        type: "tabPress",
        target: moreRoute.key,
        canPreventDefault: true,
      });
      if (!event.defaultPrevented) {
        navigation.navigate(moreRoute.name, moreRoute.params);
      }
    }
  };

  // ---- Render ----
  return (
    <View
      style={[styles.wrapper, { paddingBottom: bottomPadding }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.barRow,
          { marginHorizontal: pillMarginH },
        ]}
      >
        {/* ======== Main pill (Overview, Notes, Artefacts, Matrix) ======== */}
        {/* BlurView IS the container on iOS — UIVisualEffectView gets native
            Liquid Glass on iOS 26+. On Android/web a plain View is used. */}
        <GestureDetector gesture={pillSwipeGesture}>
          {isIOS ? (
            <Reanimated.View style={{ flex: 1 }}>
              <BlurView
                intensity={80}
                tint="systemChromeMaterialDark"
                style={[
                  styles.mainPill,
                  {
                    height: pillHeight,
                    borderRadius: pillRadius,
                  },
                ]}
              >
                {/* Animated indicator */}
                {visibleIndex >= 0 && (
                  <Animated.View
                    style={[
                      styles.indicator,
                      {
                        width: tabWidth - 16,
                        backgroundColor: activeColor,
                        transform: [
                          { translateX: Animated.add(indicatorTranslateX, 8) },
                        ],
                      },
                    ]}
                  />
                )}

                {/* Tab buttons */}
                {mainRoutes.map((route) => {
                  const options = descriptors[route.key]?.options;
                  const isFocused = route.name === effectiveActiveRouteName;
                  const color = isFocused ? activeColor : inactiveColor;

                  const onPress = () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                        size: 22,
                      })}
                      <Text
                        style={[
                          styles.label,
                          { color },
                          isFocused && styles.labelActive,
                        ]}
                        numberOfLines={1}
                      >
                        {options?.title ?? route.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </BlurView>
            </Reanimated.View>
          ) : (
            <Reanimated.View
              style={[
                styles.mainPill,
                styles.mainPillAndroid,
                {
                  height: pillHeight,
                  borderRadius: pillRadius,
                  flex: 1,
                },
              ]}
            >
              {/* Animated indicator */}
              {visibleIndex >= 0 && (
                <Animated.View
                  style={[
                    styles.indicator,
                    {
                      width: tabWidth - 16,
                      backgroundColor: activeColor,
                      transform: [
                        { translateX: Animated.add(indicatorTranslateX, 8) },
                      ],
                    },
                  ]}
                />
              )}

              {/* Tab buttons */}
              {mainRoutes.map((route) => {
                const options = descriptors[route.key]?.options;
                const isFocused = route.name === effectiveActiveRouteName;
                const color = isFocused ? activeColor : inactiveColor;

                const onPress = () => {
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
                      size: 22,
                    })}
                    <Text
                      style={[
                        styles.label,
                        { color },
                        isFocused && styles.labelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {options?.title ?? route.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </Reanimated.View>
          )}
        </GestureDetector>

        {/* ======== Split gap ======== */}
        <View style={{ width: splitGap }} />

        {/* ======== More pill (separated circular button) ======== */}
        {/* On iOS the BlurView (UIVisualEffectView) IS the container */}
        {isIOS ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onMorePress}
            style={{ width: moreButtonSize, height: moreButtonSize }}
          >
            <BlurView
              intensity={80}
              tint="systemChromeMaterialDark"
              style={[
                styles.morePill,
                {
                  width: moreButtonSize,
                  height: moreButtonSize,
                  borderRadius: moreButtonSize / 2,
                },
              ]}
            >
              <IconSymbol
                name="ellipsis.circle.fill"
                size={24}
                color={isMoreActive ? activeColor : inactiveColor}
              />
            </BlurView>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onMorePress}
            style={[
              styles.morePill,
              styles.morePillAndroid,
              {
                width: moreButtonSize,
                height: moreButtonSize,
                borderRadius: moreButtonSize / 2,
              },
            ]}
          >
            <IconSymbol
              name="ellipsis.circle.fill"
              size={24}
              color={isMoreActive ? activeColor : inactiveColor}
            />
          </TouchableOpacity>
        )}
      </View>
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
  barRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  mainPill: {
    flexDirection: "row",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      default: {},
    }),
  },
  mainPillAndroid: {
    backgroundColor: "rgba(26, 26, 26, 0.95)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.1)",
    elevation: 8,
  },
  morePill: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      default: {},
    }),
  },
  morePillAndroid: {
    backgroundColor: "rgba(26, 26, 26, 0.95)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.1)",
    elevation: 8,
  },
  indicator: {
    position: "absolute",
    bottom: 5,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 2,
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

export default SplitPillTabBar;

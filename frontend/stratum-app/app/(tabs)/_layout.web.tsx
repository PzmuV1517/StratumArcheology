import { Tabs } from "expo-router";
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
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Reanimated, { runOnJS } from "react-native-reanimated";
import { LiquidGlassView, isLiquidGlassSupported } from "@/src/utils/liquidGlass";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

import { IconSymbol } from "@/components/ui/icon-symbol";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ACTIVE_COLOR = "#FF2A2A";
const INACTIVE_COLOR = "#9A9A9A";
const PILL_MARGIN_H = 20;
const PILL_HEIGHT = 64;
const PILL_RADIUS = 32;
const BOTTOM_OFFSET = 24;

/**
 * Pill-shaped custom tab bar with Liquid Glass / Blur / Solid background
 * Supports swipe gestures on the bar to navigate between tabs
 */
function PillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, BOTTOM_OFFSET);
  const screenWidth = Dimensions.get("window").width;
  const pillWidth = screenWidth - PILL_MARGIN_H * 2;

  // Filter out hidden tabs (href: null or explicitly hidden routes)
  const hiddenRouteNames = ["gps", "explore"]; // Routes to hide from tab bar
  const visibleRoutes = state.routes.filter((route) => {
    if (hiddenRouteNames.includes(route.name)) return false;
    const options = descriptors[route.key]?.options;
    // Also respect href: null if set
    if ((options as any)?.href === null) return false;
    return true;
  });

  const visibleCount = visibleRoutes.length;
  const tabWidth = pillWidth / visibleCount;

  // Swipe gesture on the pill bar
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

  // Animated indicator position
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
  }, [visibleIndex]);

  const indicatorTranslateX = indicatorAnim.interpolate({
    inputRange: visibleRoutes.map((_, i) => i),
    outputRange: visibleRoutes.map((_, i) => i * tabWidth),
  });

  const renderBackground = () => {
    if (Platform.OS === "ios" && isLiquidGlassSupported) {
      return (
        <LiquidGlassView
          style={[StyleSheet.absoluteFill, { borderRadius: PILL_RADIUS }]}
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
            { borderRadius: PILL_RADIUS, overflow: "hidden" },
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
            borderRadius: PILL_RADIUS,
          },
        ]}
      />
    );
  };

  return (
    <View
      style={[pillStyles.wrapper, { paddingBottom: bottomPadding }]}
      pointerEvents="box-none"
    >
      <GestureDetector gesture={pillSwipeGesture}>
        <Reanimated.View style={pillStyles.pill}>
          {renderBackground()}

          {/* Animated indicator */}
          <Animated.View
            style={[
              pillStyles.indicator,
              {
                width: tabWidth - 16,
                transform: [{ translateX: Animated.add(indicatorTranslateX, 8) }],
              },
            ]}
          />

          {/* Tab buttons */}
          {visibleRoutes.map((route) => {
            const options = descriptors[route.key]?.options;
            const routeIndex = state.routes.indexOf(route);
            const isFocused = state.index === routeIndex;
            const color = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;

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
                style={pillStyles.tab}
                activeOpacity={0.7}
              >
                {options?.tabBarIcon?.({
                  focused: isFocused,
                  color,
                  size: 24,
                })}
                <Text
                  style={[
                    pillStyles.label,
                    { color },
                    isFocused && pillStyles.labelActive,
                  ]}
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

const pillStyles = StyleSheet.create({
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
    height: PILL_HEIGHT,
    marginHorizontal: PILL_MARGIN_H,
    borderRadius: PILL_RADIUS,
    overflow: "hidden",
    alignSelf: "stretch",
    // Subtle border
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.1)",
    // Shadow on iOS
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
    backgroundColor: ACTIVE_COLOR,
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

/**
 * TabLayout - Main navigation tabs
 * Tab order: Overview (landing), Projects, Profile, Settings
 * Auth is handled by AuthRedirector at the root level
 *
 * Uses iOS 26+ Liquid Glass effect (Callstack) when available, falls back to blur
 * Android/web uses standard full-width tab bar
 */

export default function TabLayout() {
  // iOS: pill-shaped floating bar, Android/web: standard tab bar
  const useCustomTabBar = Platform.OS === "ios";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Tabs
          tabBar={useCustomTabBar ? (props) => <PillTabBar {...props} /> : undefined}
          screenOptions={{
            tabBarActiveTintColor: ACTIVE_COLOR,
            tabBarInactiveTintColor: INACTIVE_COLOR,
            headerShown: false,
            // Android/web-only styles (ignored when using custom tabBar)
            ...(Platform.OS !== "ios" && {
              tabBarStyle: {
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: "#1A1A1A",
                borderTopColor: "rgba(255, 255, 255, 0.1)",
                borderTopWidth: StyleSheet.hairlineWidth,
                height: 84,
                paddingBottom: 24,
                paddingTop: 8,
                elevation: 8,
              },
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: "600",
                letterSpacing: 0.3,
              },
            }),
          }}
          initialRouteName="overview"
        >
          {/* Overview - Landing tab */}
          <Tabs.Screen
            name="overview"
            options={{
              title: "Overview",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={26} name="house.fill" color={color} />
              ),
            }}
          />

          {/* Projects - All projects list */}
          <Tabs.Screen
            name="index"
            options={{
              title: "Projects",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={26} name="folder.fill" color={color} />
              ),
            }}
          />

          {/* Profile - User profile */}
          <Tabs.Screen
            name="profile"
            options={{
              title: "Profile",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={26} name="person.fill" color={color} />
              ),
            }}
          />

          {/* Settings - App settings */}
          <Tabs.Screen
            name="settings"
            options={{
              title: "Settings",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={26} name="gearshape.fill" color={color} />
              ),
            }}
          />

          {/* Hide GPS and Explore tabs from navigation */}
          <Tabs.Screen
            name="gps"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="explore"
            options={{
              href: null,
            }}
          />
        </Tabs>
      </View>
    </GestureHandlerRootView>
  );
}

import { Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";
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
  LiquidGlassView,
  isLiquidGlassSupported,
} from "@/src/utils/liquidGlass";
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
const BOTTOM_OFFSET = 16;

/**
 * Pill-shaped custom tab bar with Liquid Glass / Blur / Solid background
 */
function PillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, BOTTOM_OFFSET);

  // Filter out hidden tabs (href: null)
  const visibleRoutes = state.routes.filter((route) => {
    const options = descriptors[route.key]?.options;
    return (options as any)?.href !== null;
  });

  const visibleCount = visibleRoutes.length;
  const screenWidth = Dimensions.get("window").width;
  const pillWidth = screenWidth - PILL_MARGIN_H * 2;
  const tabWidth = pillWidth / visibleCount;

  // Animated indicator position
  const visibleIndex = visibleRoutes.findIndex(
    (r) => r.key === state.routes[state.index]?.key
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
          style={[StyleSheet.absoluteFill, { borderRadius: PILL_RADIUS, overflow: "hidden" }]}
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
      style={[
        pillStyles.wrapper,
        { paddingBottom: bottomPadding },
      ]}
      pointerEvents="box-none"
    >
      <View style={pillStyles.pill}>
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
      </View>
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
 */
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        headerShown: false,
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
  );
}

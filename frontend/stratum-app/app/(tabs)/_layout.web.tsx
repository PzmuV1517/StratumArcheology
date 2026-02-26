/**
 * Main tab layout for the app, using Expo Router's Tabs component.
 * Implements a custom pill-shaped tab bar on iOS and a standard tab bar on Android/web.
 * Hides certain routes (GPS, Explore) from the tab bar but keeps them accessible via navigation.
 */
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { LiquidPillTabBar } from "@/src/components/ui/LiquidPillTabBar";

const ACTIVE_COLOR = "#FF2A2A";
const INACTIVE_COLOR = "#9A9A9A";

/** Routes hidden from the pill tab bar */
const HIDDEN_ROUTES = ["gps", "explore"];

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
          tabBar={
            useCustomTabBar
              ? (props) => (
                  <LiquidPillTabBar {...props} hiddenRouteNames={HIDDEN_ROUTES} />
                )
              : undefined
          }
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

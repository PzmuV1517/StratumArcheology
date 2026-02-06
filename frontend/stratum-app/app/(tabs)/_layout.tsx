import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from "@/src/utils/liquidGlass";
import { BlurView } from "expo-blur";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";

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
      screenOptions={{
        tabBarActiveTintColor: "#FF2A2A",
        tabBarInactiveTintColor: "#9A9A9A",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: () =>
          Platform.OS === "ios" && isLiquidGlassSupported ? (
            <LiquidGlassView
              style={StyleSheet.absoluteFill}
              effect="regular"
            />
          ) : Platform.OS === "ios" ? (
            <BlurView
              intensity={50}
              tint="systemChromeMaterialDark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: "#1A1A1A" },
              ]}
            />
          ),
        tabBarStyle: Platform.select({
          ios: {
            position: "absolute",
            backgroundColor: "transparent",
            borderTopColor: "rgba(255, 255, 255, 0.08)",
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          default: {
            backgroundColor: "#1A1A1A",
            borderTopColor: "rgba(255, 255, 255, 0.08)",
            borderTopWidth: StyleSheet.hairlineWidth,
          },
        }),
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.3,
          marginTop: 2,
        },
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

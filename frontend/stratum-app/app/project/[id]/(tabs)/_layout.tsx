/**
 * @file
 * Project detail tabs layout.
 *
 * Configures the tab navigation within individual
 * project detail views.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useState } from "react";
import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useProjectDetail } from "@/contexts/ProjectDetailContext";
import MoreToolsSheet from "@/components/project/MoreToolsSheet";
import { useColorScheme } from "@/hooks/use-color-scheme";

const ACTIVE_COLOR = "#FF2A2A";

export default function ProjectTabsLayout() {
  const { navigateToTab } = useProjectDetail();
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const inactiveColor = isDarkMode ? "#9A9A9A" : "#666666";
  const tabSurfaceColor = isDarkMode ? "#1A1A1A" : "#FFFFFF";
  const tabBorderColor = isDarkMode
    ? "rgba(255, 255, 255, 0.1)"
    : "rgba(0, 0, 0, 0.1)";
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: ACTIVE_COLOR,
          tabBarInactiveTintColor: inactiveColor,
          headerShown: false,
          tabBarStyle: {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: tabSurfaceColor,
            borderTopColor: tabBorderColor,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: Platform.OS === "android" ? 84 : 60,
            paddingBottom: Platform.OS === "android" ? 24 : 8,
            paddingTop: 8,
            ...(Platform.OS === "android" ? { elevation: 8 } : {}),
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 0.3,
          },
        }}
        initialRouteName="index"
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Overview",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="house.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="notes"
          options={{
            title: "Notes",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="note.text" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="artefacts"
          options={{
            title: "Artefacts",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="cube.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="matrix"
          options={{
            title: "Matrix",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="chart.bar.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: "Chat",
            tabBarIcon: ({ color }) => (
              <IconSymbol
                size={26}
                name="bubble.left.and.bubble.right.fill"
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="gallery"
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setShowMore(true);
            },
          }}
          options={{
            title: "More",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="ellipsis.circle" color={color} />
            ),
          }}
        />
        <Tabs.Screen name="gps" options={{ title: "Map", href: null }} />
        <Tabs.Screen
          name="history"
          options={{ title: "Time Machine", href: null }}
        />
        <Tabs.Screen name="tools" options={{ title: "Tools", href: null }} />
        <Tabs.Screen name="wheeler" options={{ title: "Wheeler", href: null }} />
      </Tabs>

      <MoreToolsSheet
        visible={showMore}
        onClose={() => setShowMore(false)}
        onNavigate={(tab) => navigateToTab(tab)}
      />
    </>
  );
}

/**
 * @file
 * Project detail tabs layout.
 *
 * Configures the tab navigation within individual
 * project detail views.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import React, { useState } from "react";
import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useProjectDetail } from "@/src/contexts/ProjectDetailContext";
import MoreToolsSheet from "@/src/components/project/MoreToolsSheet";

const ACTIVE_COLOR = "#FF2A2A";
const INACTIVE_COLOR = "#9A9A9A";

export default function ProjectTabsLayout() {
  const { navigateToTab } = useProjectDetail();
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: ACTIVE_COLOR,
          tabBarInactiveTintColor: INACTIVE_COLOR,
          headerShown: false,
          tabBarStyle: {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#1A1A1A",
            borderTopColor: "rgba(255, 255, 255, 0.1)",
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

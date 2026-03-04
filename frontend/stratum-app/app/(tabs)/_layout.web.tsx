/**
 * @file
 * Web-specific tab bar layout.
 *
 * Configures tab navigation optimized for web browsers.
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
import { Tabs } from "expo-router";
import React, { useState, useCallback } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { LiquidPillTabBar } from "@/src/components/ui/LiquidPillTabBar";
import { useAuth } from "@/src/contexts/AuthContext";
import UsernamePromptModal from "@/src/components/UsernamePromptModal";

const ACTIVE_COLOR = "#FF2A2A";
const INACTIVE_COLOR = "#9A9A9A";

/** Routes hidden from the pill tab bar */
const HIDDEN_ROUTES = ["gps"];

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

  const { user } = useAuth();
  const [usernameSet, setUsernameSet] = useState(false);
  const needsUsername = !!user && !user.username && !usernameSet;
  const handleUsernameComplete = useCallback(() => setUsernameSet(true), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <UsernamePromptModal visible={needsUsername} onComplete={handleUsernameComplete} />
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
          initialRouteName="index"
        >
          {/* Overview - Landing tab */}
          <Tabs.Screen
            name="index"
            options={{
              title: "Overview",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={26} name="house.fill" color={color} />
              ),
            }}
          />

          {/* Projects - All projects list */}
          <Tabs.Screen
            name="projects"
            options={{
              title: "Projects",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={26} name="folder.fill" color={color} />
              ),
            }}
          />

          {/* Messages - DM Inbox */}
          <Tabs.Screen
            name="messages"
            options={{
              title: "Messages",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={26} name="message.fill" color={color} />
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

          {/* Unearthed - Public projects & user search */}
          <Tabs.Screen
            name="explore"
            options={{
              title: "Unearthed",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={26} name="globe.americas.fill" color={color} />
              ),
            }}
          />

          {/* Hide GPS tab from navigation */}
          <Tabs.Screen
            name="gps"
            options={{
              href: null,
            }}
          />
        </Tabs>
      </View>
    </GestureHandlerRootView>
  );
}

/**
 * @file
 * iOS-specific tab bar layout.
 *
 * Configures tab navigation with iOS-native styling.
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
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import React, { useState, useCallback } from "react";
import { DynamicColorIOS, Platform } from "react-native";
import { useAuth } from "@/src/contexts/AuthContext";
import UsernamePromptModal from "@/src/components/UsernamePromptModal";

// Active color for tab items
const ACTIVE_COLOR = "#FF2A2A";
const isLiquidGlass = parseInt(String(Platform.Version), 10) >= 26;

export default function TabLayout() {
  const { user } = useAuth();
  const [usernameSet, setUsernameSet] = useState(false);
  const needsUsername = !!user && !user.username && !usernameSet;
  const handleUsernameComplete = useCallback(() => setUsernameSet(true), []);

  return (
    <>
    <UsernamePromptModal visible={needsUsername} onComplete={handleUsernameComplete} />
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={DynamicColorIOS({ dark: ACTIVE_COLOR, light: ACTIVE_COLOR })}
      labelStyle={{
        color: DynamicColorIOS({ dark: "#9A9A9A", light: "#666666" }),
      }}
      // On iOS 26+ with Liquid Glass, let the system handle the bar appearance
      // (no explicit background → native glass effect, no white flash on swipe).
      // Older iOS gets a semi-transparent dark background.
      {...(!isLiquidGlass && {
        barStyle: {
          backgroundColor: DynamicColorIOS({
            dark: "rgba(17, 17, 17, 0.85)",
            light: "rgba(255, 255, 255, 0.85)",
          }),
        },
      })}
    >
      {/* Overview - Landing tab (default) */}
      <NativeTabs.Trigger name="index">
        <Label>Overview</Label>
        <Icon sf={{ default: "house", selected: "house.fill" }} />
      </NativeTabs.Trigger>

      {/* Projects - All projects list */}
      <NativeTabs.Trigger name="projects">
        <Label>Projects</Label>
        <Icon sf={{ default: "folder", selected: "folder.fill" }} />
      </NativeTabs.Trigger>

      {/* Profile - User profile */}
      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon sf={{ default: "person", selected: "person.fill" }} />
      </NativeTabs.Trigger>

      {/* Messages - DM Inbox */}
      <NativeTabs.Trigger name="messages">
        <Label>Messages</Label>
        <Icon sf={{ default: "message", selected: "message.fill" }} />
      </NativeTabs.Trigger>

      {/* Settings - App settings */}
      <NativeTabs.Trigger name="settings">
        <Label>Settings</Label>
        <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
      </NativeTabs.Trigger>

      {/* Unearthed - Public projects & user search */}
      <NativeTabs.Trigger name="explore">
        <Label>Unearthed</Label>
        <Icon sf={{ default: "globe.americas", selected: "globe.americas.fill" }} />
      </NativeTabs.Trigger>

      {/* Hidden tabs - not shown in tab bar */}
      <NativeTabs.Trigger name="gps" hidden>
        <Label>GPS</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
    </>
  );
}

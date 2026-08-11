/**
 * @file
 * iOS-specific tab bar layout.
 *
 * Configures tab navigation with iOS-native styling.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React from "react";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { DynamicColorIOS } from "react-native";

const ACTIVE_COLOR = "#FF2A2A";

export default function ProjectTabsLayout() {
  return (
    <NativeTabs
      tintColor={DynamicColorIOS({ dark: ACTIVE_COLOR, light: ACTIVE_COLOR })}
      labelStyle={{
        color: DynamicColorIOS({ dark: "#9A9A9A", light: "#666666" }),
      }}
    >
      <NativeTabs.Trigger name="index">
        <Label>Overview</Label>
        <Icon sf={{ default: "house", selected: "house.fill" }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="notes">
        <Label>Notes</Label>
        <Icon sf={{ default: "note.text", selected: "note.text" }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="artefacts">
        <Label>Artefacts</Label>
        <Icon sf={{ default: "cube", selected: "cube.fill" }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="matrix">
        <Label>Matrix</Label>
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="chat">
        <Label>Chat</Label>
        <Icon
          sf={{
            default: "bubble.left.and.bubble.right",
            selected: "bubble.left.and.bubble.right.fill",
          }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="gallery" hidden>
        <Label>Gallery</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="gps" hidden>
        <Label>Map</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history" hidden>
        <Label>Time Machine</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tools" hidden>
        <Label>Tools</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

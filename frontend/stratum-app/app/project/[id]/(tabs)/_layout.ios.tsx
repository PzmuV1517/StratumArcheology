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

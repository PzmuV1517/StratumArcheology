import React from "react";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { DynamicColorIOS } from "react-native";

const ACTIVE_COLOR = "#FF2A2A";

export default function ProjectTabsLayout() {
  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
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

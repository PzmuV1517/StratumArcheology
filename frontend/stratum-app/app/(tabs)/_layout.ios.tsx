/**
 * Native Tab Layout for iOS
 * Uses NativeTabs from expo-router for real native tab bars:
 * - iOS 26+: Real Liquid Glass UITabBarController
 * - iOS <26: Standard UITabBarController
 */
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { DynamicColorIOS } from "react-native";

// Active color for tab items
const ACTIVE_COLOR = "#FF2A2A";

export default function TabLayout() {
  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={DynamicColorIOS({ dark: ACTIVE_COLOR, light: ACTIVE_COLOR })}
      labelStyle={{
        color: DynamicColorIOS({ dark: "#9A9A9A", light: "#666666" }),
      }}
      barStyle={{
        backgroundColor: DynamicColorIOS({
          dark: "rgba(17, 17, 17, 0.85)",
          light: "rgba(255, 255, 255, 0.85)",
        }),
      }}
    >
        {/* Overview - Landing tab (default) */}
        <NativeTabs.Trigger name="overview">
          <Label>Overview</Label>
          <Icon sf={{ default: "house", selected: "house.fill" }} />
        </NativeTabs.Trigger>

        {/* Projects - All projects list */}
        <NativeTabs.Trigger name="index">
          <Label>Projects</Label>
          <Icon sf={{ default: "folder", selected: "folder.fill" }} />
        </NativeTabs.Trigger>

        {/* Profile - User profile */}
        <NativeTabs.Trigger name="profile">
          <Label>Profile</Label>
          <Icon sf={{ default: "person", selected: "person.fill" }} />
        </NativeTabs.Trigger>

        {/* Settings - App settings */}
        <NativeTabs.Trigger name="settings">
          <Label>Settings</Label>
          <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        </NativeTabs.Trigger>

        {/* Hidden tabs - not shown in tab bar */}
        <NativeTabs.Trigger name="gps" hidden>
          <Label>GPS</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="explore" hidden>
          <Label>Explore</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
  );
}

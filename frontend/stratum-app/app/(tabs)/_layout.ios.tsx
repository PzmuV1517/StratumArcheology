/**
 * Native Tab Layout for iOS and Android
 * Uses NativeTabs from expo-router for real native tab bars:
 * - iOS 26+: Real Liquid Glass UITabBarController
 * - iOS <26: Standard UITabBarController
 * - Android: Material Bottom Navigation
 */
import {
  NativeTabs,
  Icon,
  Label,
  VectorIcon,
} from "expo-router/unstable-native-tabs";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { DynamicColorIOS, Platform } from "react-native";
import { ThemeProvider, DarkTheme } from "@react-navigation/native";

// Active color for tab items
const ACTIVE_COLOR = "#FF2A2A";

export default function TabLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <NativeTabs
        minimizeBehavior="onScrollDown"
        tintColor={
          Platform.OS === "ios"
            ? DynamicColorIOS({ dark: ACTIVE_COLOR, light: ACTIVE_COLOR })
            : ACTIVE_COLOR
        }
        labelStyle={{
          color:
            Platform.OS === "ios"
              ? DynamicColorIOS({ dark: "#9A9A9A", light: "#666666" })
              : "#9A9A9A",
        }}
      >
        {/* Overview - Landing tab */}
        <NativeTabs.Trigger name="overview">
          <Label>Overview</Label>
          <Icon
            sf={{ default: "house", selected: "house.fill" }}
            androidSrc={<VectorIcon family={MaterialIcons} name="home" />}
          />
        </NativeTabs.Trigger>

        {/* Projects - All projects list */}
        <NativeTabs.Trigger name="index">
          <Label>Projects</Label>
          <Icon
            sf={{ default: "folder", selected: "folder.fill" }}
            androidSrc={<VectorIcon family={MaterialIcons} name="folder" />}
          />
        </NativeTabs.Trigger>

        {/* Profile - User profile */}
        <NativeTabs.Trigger name="profile">
          <Label>Profile</Label>
          <Icon
            sf={{ default: "person", selected: "person.fill" }}
            androidSrc={<VectorIcon family={MaterialIcons} name="person" />}
          />
        </NativeTabs.Trigger>

        {/* Settings - App settings */}
        <NativeTabs.Trigger name="settings">
          <Label>Settings</Label>
          <Icon
            sf={{ default: "gearshape", selected: "gearshape.fill" }}
            androidSrc={<VectorIcon family={MaterialIcons} name="settings" />}
          />
        </NativeTabs.Trigger>

        {/* Hidden tabs - not shown in tab bar */}
        <NativeTabs.Trigger name="gps" hidden>
          <Label>GPS</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="explore" hidden>
          <Label>Explore</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}

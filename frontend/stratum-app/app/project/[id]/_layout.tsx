import React from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { Stack, router } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import styles from "@/src/components/project/ProjectDetailStyles";
import ProjectOverlays from "@/src/components/project/ProjectOverlays";
import {
  ProjectDetailProvider,
  useProjectDetail,
} from "@/src/contexts/ProjectDetailContext";

// liquid-react native toolbar components (iOS only)
let NativeToolbar: React.ComponentType<any> | null = null;
let NativeToolbarButton: React.ComponentType<any> | null = null;
let NativeToolbarMenu: React.ComponentType<any> | null = null;

if (Platform.OS === "ios") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lr = require("liquid-react");
    NativeToolbar = lr.NativeToolbar;
    NativeToolbarButton = lr.NativeToolbarButton;
    NativeToolbarMenu = lr.NativeToolbarMenu;
  } catch {
    // fallback to non-native
  }
}

const useNativeToolbar =
  Platform.OS === "ios" &&
  NativeToolbar != null &&
  NativeToolbarButton != null &&
  NativeToolbarMenu != null;

function ProjectStack() {
  const { loading, project, setShowFilesOverlay, setShowMenu, navigateToTab } =
    useProjectDetail();
  const showHeaderActions = !!project && !loading;

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: Platform.OS === "ios",
        headerBlurEffect: undefined,
        headerStyle:
          Platform.OS === "ios"
            ? { backgroundColor: "transparent" }
            : { backgroundColor: "#111111" },
        headerShadowVisible: Platform.OS !== "ios",
        headerTintColor: "#FF2A2A",
      }}
    >
      <Stack.Screen
        name="(tabs)"
        options={{
          headerTitle: loading ? "Loading..." : project ? " " : "Project Not Found",
          headerTitleStyle: {
            color: project ? "transparent" : "#F5F5F5",
            fontSize: 18,
            fontWeight: "600",
          },
          headerBackTitle: "Projects",
          headerBackVisible: true,
          presentation: "card",
          headerLeft: () => {
            if (useNativeToolbar && NativeToolbar && NativeToolbarButton) {
              return (
                <NativeToolbar
                  translucent
                  style={{ height: 44, backgroundColor: "transparent" }}
                >
                  <NativeToolbarButton
                    icon="chevron.backward"
                    title="Projects"
                    onPress={() => router.back()}
                  />
                </NativeToolbar>
              );
            }
            if (Platform.OS === "ios") {
              return (
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    height: 44,
                    marginLeft: -8,
                    paddingRight: 20,
                  }}
                  activeOpacity={0.6}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <IconSymbol
                    name="chevron.backward"
                    size={22}
                    color="#FF2A2A"
                    style={{ marginLeft: 20, marginTop: -9 }}
                  />
                  <Text
                    style={{
                      color: "#FF2A2A",
                      fontSize: 17,
                      marginLeft: 0,
                      lineHeight: 22,
                      marginTop: -9,
                    }}
                  >
                    Projects
                  </Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  height: 44,
                  justifyContent: "center",
                  paddingRight: 16,
                }}
                activeOpacity={0.6}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <IconSymbol name="chevron.backward" size={22} color="#FF2A2A" />
              </TouchableOpacity>
            );
          },
          headerRight: () => {
            if (!showHeaderActions) return null;
            if (
              useNativeToolbar &&
              NativeToolbar &&
              NativeToolbarButton &&
              NativeToolbarMenu
            ) {
              return (
                <NativeToolbar
                  translucent
                  style={{ height: 44, backgroundColor: "transparent" }}
                >
                  <NativeToolbarButton
                    icon="folder.fill"
                    onPress={() => setShowFilesOverlay(true)}
                  />
                  <NativeToolbarMenu
                    icon="ellipsis.circle"
                    menuItems={[
                      {
                        id: "gallery",
                        title: "Gallery",
                        icon: "photo.on.rectangle",
                      },
                      { id: "gps", title: "GPS Map", icon: "map" },
                      {
                        id: "history",
                        title: "Time Machine",
                        icon: "clock.arrow.circlepath",
                      },
                      {
                        id: "tools",
                        title: "Tools",
                        icon: "wrench.and.screwdriver",
                      },
                    ]}
                    onMenuAction={(e: any) => {
                      const itemId = e.nativeEvent.id;
                      if (itemId === "gallery") navigateToTab("gallery");
                      else if (itemId === "gps") navigateToTab("gps");
                      else if (itemId === "history") navigateToTab("history");
                      else if (itemId === "tools") navigateToTab("tools");
                    }}
                  />
                  <NativeToolbarMenu
                    icon="line.3.horizontal"
                    menuItems={[
                      { id: "members", title: "Members", icon: "person.2" },
                      { id: "settings", title: "Settings", icon: "gearshape" },
                      {
                        id: "exit",
                        title: "Exit Project",
                        icon: "arrow.right.square",
                        destructive: true,
                      },
                    ]}
                    onMenuAction={(e: any) => {
                      const itemId = e.nativeEvent.id;
                      if (
                        itemId === "exit" ||
                        itemId === "members" ||
                        itemId === "settings"
                      ) {
                        setShowMenu(true);
                      }
                    }}
                  />
                </NativeToolbar>
              );
            }
            return (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity
                  onPress={() => setShowFilesOverlay(true)}
                  style={styles.iconButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <IconSymbol name="folder.fill" size={20} color="#FF2A2A" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowMenu(true)}
                  style={styles.iconButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <IconSymbol name="line.3.horizontal" size={20} color="#FF2A2A" />
                </TouchableOpacity>
              </View>
            );
          },
        }}
      />
    </Stack>
  );
}

export default function ProjectLayout() {
  return (
    <ProjectDetailProvider>
      <View style={styles.safeArea}>
        <View style={styles.container}>
          <ProjectStack />
          <ProjectOverlays />
        </View>
      </View>
    </ProjectDetailProvider>
  );
}

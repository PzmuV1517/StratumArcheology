import React from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { Stack, router } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import styles from "@/src/components/project/ProjectDetailStyles";
import ProjectOverlays from "@/src/components/project/ProjectOverlays";
import { ProjectDetailProvider, useProjectDetail } from "@/src/contexts/ProjectDetailContext";

function ProjectStack() {
  const { loading, project, setShowFilesOverlay, setShowMenu } = useProjectDetail();
  const showHeaderActions = !!project && !loading;

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: Platform.OS === "ios",
        headerBlurEffect: undefined,
        headerStyle:
          Platform.OS === "ios" ? { backgroundColor: "transparent" } : { backgroundColor: "#111111" },
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
                  <IconSymbol name="chevron.backward" size={22} color="#FF2A2A" style={{ marginLeft: 20 , marginTop: -9}} />
                  <Text style={{ color: "#FF2A2A", fontSize: 17, marginLeft: 0, lineHeight: 22,marginTop: -9}}>
                    Projects
                  </Text>
                </TouchableOpacity>
              );
            }
            return undefined;
          },
          headerRight: () => {
            if (!showHeaderActions) return null;
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

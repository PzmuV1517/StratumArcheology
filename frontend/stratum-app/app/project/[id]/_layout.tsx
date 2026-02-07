import React from "react";
import { Platform, TouchableOpacity, View } from "react-native";
import { Stack } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { LiquidGlassButton } from "@/src/components/ui/LiquidGlassButton";
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
          headerRight: () => {
            if (!showHeaderActions) return null;
            if (Platform.OS === "ios") {
              return (
                <>
                  <LiquidGlassButton
                    title=""
                    onPress={() => setShowFilesOverlay(true)}
                    variant="ghost"
                    size="sm"
                    icon={<IconSymbol name="folder.fill" size={20} color="#FF2A2A" />}
                    style={styles.headerGlassBubbleButtonSpaced}
                    textStyle={{ fontSize: 0 }}
                  />
                  <LiquidGlassButton
                    title=""
                    onPress={() => setShowMenu(true)}
                    variant="ghost"
                    size="sm"
                    icon={<IconSymbol name="line.3.horizontal" size={20} color="#FF2A2A" />}
                    style={styles.headerGlassBubbleButton}
                    textStyle={{ fontSize: 0 }}
                  />
                </>
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

import React, { useState, useCallback } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  ProjectGalleryScreen,
  ProjectMoreScreen,
  ProjectMapScreen,
  ProjectHistoryScreen,
  ProjectToolsScreen,
} from "@/src/components/project/ProjectTabsScreens";

type MoreSubScreen = "hub" | "gallery" | "gps" | "history" | "tools";

export default function ProjectGalleryRoute() {
  const [subScreen, setSubScreen] = useState<MoreSubScreen>("hub");

  // Reset to hub whenever we leave this tab
  useFocusEffect(
    useCallback(() => {
      return () => setSubScreen("hub");
    }, []),
  );

  if (Platform.OS !== "ios") {
    return <ProjectGalleryScreen />;
  }

  switch (subScreen) {
    case "gallery":
      return <ProjectGalleryScreen onBack={() => setSubScreen("hub")} />;
    case "gps":
      return <ProjectMapScreen onBack={() => setSubScreen("hub")} />;
    case "history":
      return <ProjectHistoryScreen onBack={() => setSubScreen("hub")} />;
    case "tools":
      return <ProjectToolsScreen onBack={() => setSubScreen("hub")} />;
    default:
      return <ProjectMoreScreen onNavigate={setSubScreen} />;
  }
}

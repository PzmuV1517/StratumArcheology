/**
 * @file
 * Module for gallery functionality.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useState, useCallback } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  ProjectGalleryScreen,
  ProjectMoreScreen,
  ProjectMapScreen,
  ProjectHistoryScreen,
  ProjectToolsScreen,
} from "@/components/project/ProjectTabsScreens";

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

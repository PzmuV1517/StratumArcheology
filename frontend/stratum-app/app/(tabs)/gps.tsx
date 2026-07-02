/**
 * @file
 * GPS tab screen.
 *
 * Displays the GPS mapping interface for marking
 * archaeological site coordinates.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useMemo } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { Stack } from "expo-router";

import MapEditor from "@/components/map/MapEditor";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function GPSScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const pageBackground = isDarkMode ? "#111111" : "#F7F7F7";
  const headerTextColor = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

  return (
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      <Stack.Screen
        options={{
          title: "GPS",
          headerTransparent: Platform.OS === "ios",
          headerBlurEffect:
            Platform.OS === "ios" ? "systemChromeMaterial" : undefined,
          headerStyle:
            Platform.OS === "ios" ? {} : { backgroundColor: pageBackground },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: { color: headerTextColor },
        }}
      />
      <MapEditor projectId={""} />
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
  });

/**
 * @file
 * File move operation banner component.
 *
 * Displays a banner during file move operations to indicate
 * the target destination.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function MoveBanner({
  visible,
  itemName,
  onMoveHere,
  onCancel,
}: {
  visible: boolean;
  itemName: string;
  onMoveHere: () => void;
  onCancel: () => void;
}) {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

  if (!visible) return null;

  // Truncate long names
  const displayName =
    itemName.length > 20 ? itemName.substring(0, 20) + "..." : itemName;

  return (
    <View style={styles.moveBanner}>
      <View style={styles.contentRow}>
        <Text style={styles.label} numberOfLines={2}>
          Select destination for "{displayName}" then tap Move Here
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.moveButton} onPress={onMoveHere}>
            <Text style={styles.moveButtonText}>Move Here</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    moveBanner: {
      position: "absolute",
      bottom: Platform.OS === "ios" ? 34 : 0, // Account for safe area
      left: 0,
      right: 0,
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? "#333" : "#D9D9D9",
      padding: 16,
      paddingBottom: Platform.OS === "ios" ? 20 : 16,
    },
    contentRow: {
      flexDirection: "column",
      gap: 12,
    },
    label: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 14,
      lineHeight: 20,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 8,
    },
    moveButton: {
      backgroundColor: "#FF2A2A",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      flex: 1,
      alignItems: "center",
    },
    moveButtonText: {
      color: "#FFFFFF",
      fontWeight: "600",
      fontSize: 14,
    },
    cancelButton: {
      backgroundColor: isDarkMode ? "#2A2A2A" : "#EFEFEF",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      flex: 1,
      alignItems: "center",
    },
    cancelButtonText: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontWeight: "600",
      fontSize: 14,
    },
  });

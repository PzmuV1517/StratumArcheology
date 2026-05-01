/**
 * @file
 * Loading indicator component.
 *
 * Displays a centered activity indicator with optional
 * loading message text.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React from "react";
import { View, ActivityIndicator, Text, StyleSheet, ViewStyle } from "react-native";

interface LoadingProps {
  message?: string;
  size?: "small" | "large";
  color?: string;
  style?: ViewStyle;
  fullScreen?: boolean;
}

/**
 * Centered activity indicator with optional loading message.
 * @param props - Component props
 * @returns The rendered component
 */
export default function Loading({
  message,
  size = "large",
  color = "#007AFF",
  style,
  fullScreen = false,
}: LoadingProps) {
  const content = (
    <View style={[styles.container, fullScreen && styles.fullScreen, style]}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );

  if (fullScreen) {
    return <View style={styles.overlay}>{content}</View>;
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  fullScreen: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
  },
});

/**
 * @file
 * Photo viewer panel component.
 *
 * Displays image files with zoom, pan, and metadata
 * inspection capabilities.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React from "react";
import { View, Image, StyleSheet } from "react-native";

export default function PhotoPanel({ uri }: { uri: string }) {
  return (
    <View style={styles.imageWrapper}>
      <Image source={{ uri }} style={styles.image} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  imageWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
  },
  image: { width: "100%", height: "100%" },
});

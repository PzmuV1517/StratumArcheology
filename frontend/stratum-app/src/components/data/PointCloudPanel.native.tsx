import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function PointCloudPanel({ name }: { name?: string }) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.center}>
        <Text style={styles.title}>Point Cloud</Text>
        <Text style={styles.info}>
          Preview is not supported on this platform yet.
        </Text>
        {!!name && <Text style={[styles.info, { opacity: 0.8 }]}>File: {name}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    backgroundColor: "#0E0E0E",
    overflow: "hidden",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  title: { color: "#F5F5F5", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  info: { color: "#9A9A9A", fontSize: 13, textAlign: "center", marginTop: 4 },
});

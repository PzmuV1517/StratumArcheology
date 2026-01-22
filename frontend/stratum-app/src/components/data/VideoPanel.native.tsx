import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function VideoPanel({ src }: { src: string | null }) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.info}>
        Video preview is not supported on this platform yet.
      </Text>
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
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  info: { color: "#9A9A9A" },
});

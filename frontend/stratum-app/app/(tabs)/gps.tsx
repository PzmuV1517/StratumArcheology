import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Stack } from "expo-router";

import MapEditor from "@/components/map/MapEditor";

export default function GPSScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "GPS",
          headerStyle: { backgroundColor: "#111111" },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: { color: "#F5F5F5" },
        }}
      />
      <MapEditor projectId={""} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111111" },
});

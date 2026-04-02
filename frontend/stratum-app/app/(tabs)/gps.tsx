/**
 * @file
 * GPS tab screen.
 *
 * Displays the GPS mapping interface for marking
 * archaeological site coordinates.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
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

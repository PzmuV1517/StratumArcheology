/**
 * @file
 * Draft status indicator component.
 *
 * Shows auto-save status (saving, saved, error) for
 * content being edited.
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
import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, Animated } from "react-native";
import { SaveStatus, getDraftStatusDisplay } from "../../hooks/useAutoSave";

interface DraftStatusIndicatorProps {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Last save timestamp */
  lastSavedAt: Date | null;
  /** Whether a draft was restored */
  wasRestored: boolean;
  /** Custom style */
  style?: any;
}

/**
 * Shows auto-save status text (saving, saved, error) for content being edited.
 * @param props - Component props
 * @returns The rendered component
 */
export function DraftStatusIndicator({
  saveStatus,
  lastSavedAt,
  wasRestored,
  style,
}: DraftStatusIndicatorProps) {
  const { text, color, visible } = getDraftStatusDisplay(
    saveStatus,
    lastSavedAt,
    wasRestored,
  );

  if (!visible) return null;

  return (
    <View style={[styles.container, style]}>
      {saveStatus === "saving" && (
        <ActivityIndicator size="small" color={color} style={styles.spinner} />
      )}
      <Text style={[styles.text, { color }]}>{text}</Text>
    </View>
  );
}

/**
 * Compact draft indicator (just a dot)
 */
export function DraftDot({
  saveStatus,
  style,
}: {
  saveStatus: SaveStatus;
  style?: any;
}) {
  const getColor = () => {
    switch (saveStatus) {
      case "saving":
        return "#60a5fa";
      case "saved":
        return "#34d399";
      case "error":
        return "#f87171";
      default:
        return "transparent";
    }
  };

  if (saveStatus === "idle") return null;

  return <View style={[styles.dot, { backgroundColor: getColor() }, style]} />;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  spinner: {
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: "500",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default DraftStatusIndicator;

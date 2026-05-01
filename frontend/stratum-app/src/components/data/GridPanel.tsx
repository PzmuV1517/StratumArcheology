/**
 * @file
 * Data grid panel component.
 *
 * Displays tabular data in a scrollable grid with
 * column headers and row indices.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useMemo } from "react";
import { Platform, View, Text, TextInput, StyleSheet } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface Props {
  table: string[][];
  setTable: (updater: (prev: string[][]) => string[][]) => void;
  editing: boolean;
  onDirty: () => void;
}

export default function GridPanel({ table, setTable, editing, onDirty }: Props) {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

  // Simple fallback grid for all platforms; you can extend with react-window/auto-sizer for web later
  return (
    <View style={[styles.tableWrapper, { padding: 8 }]}>
      <View>
        {table.slice(0, 200).map((row, rIdx) => (
          <View key={rIdx} style={styles.tableRow}>
            {row.map((cell, cIdx) => {
              const cellWidthOverride =
                Platform.OS === "web" ? ({ width: "15ch" } as any) : { width: 120 };
              const webPreWrap =
                Platform.OS === "web"
                  ? ({ whiteSpace: "pre-wrap" } as any)
                  : undefined;
              return (
                <View key={cIdx} style={[styles.tableCell, cellWidthOverride]}>
                  {editing ? (
                    <TextInput
                      style={[
                        styles.cellInput,
                        Platform.OS === "web"
                          ? ({ fontFamily: "monospace" } as any)
                          : undefined,
                      ]}
                      multiline
                      value={String(cell ?? "")}
                      onChangeText={(txt) => {
                        setTable((prev) => {
                          const next = prev.map((r) => r.slice());
                          next[rIdx][cIdx] = txt;
                          return next;
                        });
                        onDirty();
                      }}
                    />
                  ) : (
                    <Text style={[styles.cellText, webPreWrap]}>
                      {String(cell ?? "")}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
        {table.length > 200 && (
          <Text style={styles.moreText}>Showing first 200 rows…</Text>
        )}
      </View>
    </View>
  );
}

const createStyles = (isDarkMode: boolean) => {
  const palette = {
    surface: isDarkMode ? "#0E0E0E" : "#FFFFFF",
    border: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    inputBorder: isDarkMode ? "#333333" : "#CFCFCF",
    inputBackground: isDarkMode ? "#151515" : "#F5F5F5",
    textPrimary: isDarkMode ? "#EAEAEA" : "#1A1A1A",
    textSecondary: isDarkMode ? "#9A9A9A" : "#666666",
  };

  return StyleSheet.create({
    tableWrapper: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    tableRow: { flexDirection: "row" },
    tableCell: {
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderRightWidth: 1,
      borderRightColor: palette.border,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
      width: 160,
    },
    cellText: {
      color: palette.textPrimary,
      fontFamily: Platform.select({ web: "monospace", default: undefined }),
      fontSize: 12,
      lineHeight: 14,
    },
    cellInput: {
      color: palette.textPrimary,
      paddingVertical: 2,
      paddingHorizontal: 4,
      borderWidth: 1,
      borderColor: palette.inputBorder,
      borderRadius: 4,
      minHeight: 24,
      backgroundColor: palette.inputBackground,
      fontSize: 12,
    },
    moreText: { color: palette.textSecondary, padding: 8 },
  });
};

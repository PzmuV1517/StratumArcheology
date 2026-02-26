/**
 * @file
 * Data grid panel component.
 *
 * Displays tabular data in a scrollable grid with
 * column headers and row indices.
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
import { Platform, View, Text, TextInput, StyleSheet } from "react-native";

interface Props {
  table: string[][];
  setTable: (updater: (prev: string[][]) => string[][]) => void;
  editing: boolean;
  onDirty: () => void;
}

export default function GridPanel({ table, setTable, editing, onDirty }: Props) {
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

const styles = StyleSheet.create({
  tableWrapper: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    backgroundColor: "#0E0E0E",
  },
  tableRow: { flexDirection: "row" },
  tableCell: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: "#2A2A2A",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
    width: 160,
  },
  cellText: {
    color: "#EAEAEA",
    fontFamily: Platform.select({ web: "monospace", default: undefined }),
    fontSize: 12,
    lineHeight: 14,
  },
  cellInput: {
    color: "#EAEAEA",
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 4,
    minHeight: 24,
    backgroundColor: "#151515",
    fontSize: 12,
  },
  moreText: { color: "#9A9A9A", padding: 8 },
});

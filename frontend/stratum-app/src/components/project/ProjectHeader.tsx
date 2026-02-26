/**
 * @file
 * Project detail header component.
 *
 * Displays project name, description, member count,
 * and action buttons.
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
import { View, Text, StyleSheet } from "react-native";

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectHeader({ project }: { project: Project }) {
  return (
    <View style={styles.projectHeader}>
      <Text style={styles.projectName}>{project.name}</Text>
      {!!project.description && (
        <Text style={styles.projectDescription}>{project.description}</Text>
      )}
      <View style={styles.projectMeta}>
        <Text style={styles.projectMetaText}>
          Created:{" "}
          {new Date(project.created_at).toLocaleDateString(undefined, {
            timeZone: "UTC",
          })}
        </Text>
        <Text style={styles.projectMetaText}>
          Updated:{" "}
          {new Date(project.updated_at).toLocaleDateString(undefined, {
            timeZone: "UTC",
          })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  projectHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#2A2A2A" },
  projectName: { fontSize: 22, color: "#F5F5F5", fontWeight: "700" },
  projectDescription: { color: "#CFCFCF", marginTop: 6 },
  projectMeta: { flexDirection: "row", gap: 16, marginTop: 8 },
  projectMetaText: { color: "#9A9A9A", fontSize: 12 },
});

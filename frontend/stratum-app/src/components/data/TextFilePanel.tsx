/**
 * @file
 * Text file viewer panel component.
 *
 * Displays plain text and markdown file contents with
 * syntax-aware formatting.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useMemo } from "react";
import {
  Platform,
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
} from "react-native";
import MarkdownView from "../../components/common/MarkdownView";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface Props {
  editing: boolean;
  isNoteFile: boolean;
  editableTitle: string;
  setEditableTitle: (t: string) => void;
  textContent: string;
  setTextContent: (t: string) => void;
  filename: string;
  onDirty: () => void;
}

export default function TextFilePanel({
  editing,
  isNoteFile,
  editableTitle,
  setEditableTitle,
  textContent,
  setTextContent,
  filename,
  onDirty,
}: Props) {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const placeholderTextColor = isDarkMode ? "#666666" : "#7A7A7A";
  const ext = (filename || "").toLowerCase();
  const isEmpty = !textContent || textContent.length === 0;

  return (
    <View style={styles.textWrapper}>
      {editing && isNoteFile && (
        <View style={styles.titleEditor}>
          <Text style={styles.titleLabel}>Note Title:</Text>
          <TextInput
            style={[
              styles.titleInput,
              Platform.OS === "web" ? ({ outline: "none" } as any) : undefined,
            ]}
            value={editableTitle}
            onChangeText={(text) => {
              setEditableTitle(text);
              onDirty();
            }}
            placeholder="Enter note title..."
            placeholderTextColor={placeholderTextColor}
          />
        </View>
      )}

      {editing ? (
        <TextInput
          style={[
            styles.textEditor,
            Platform.OS === "web"
              ? ({ fontFamily: "monospace", outline: "none" } as any)
              : undefined,
          ]}
          multiline
          value={textContent || ""}
          onChangeText={(text) => {
            setTextContent(text);
            onDirty();
          }}
          placeholder="Start typing..."
          placeholderTextColor={placeholderTextColor}
        />
      ) : (
        <ScrollView
          style={styles.viewWrapper}
          contentContainerStyle={styles.viewContent}
        >
          {isEmpty ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>This file is empty</Text>
              <Text style={styles.emptyStateHint}>Click `Edit` to add content</Text>
            </View>
          ) : ext.endsWith(".md") && Platform.OS === "web" ? (
            <MarkdownView content={textContent || ""} />
          ) : (
            <Text style={styles.preText}>{textContent}</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (isDarkMode: boolean) => {
  const palette = {
    surface: isDarkMode ? "#0E0E0E" : "#FFFFFF",
    border: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    inputBorder: isDarkMode ? "#333333" : "#CFCFCF",
    inputBackground: isDarkMode ? "#1A1A1A" : "#F5F5F5",
    textPrimary: isDarkMode ? "#EAEAEA" : "#1A1A1A",
    textStrong: isDarkMode ? "#F5F5F5" : "#1A1A1A",
    textSecondary: isDarkMode ? "#9A9A9A" : "#666666",
    textTertiary: isDarkMode ? "#666666" : "#7A7A7A",
  };

  return StyleSheet.create({
    textWrapper: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      padding: 12,
    },
    viewWrapper: { flex: 1 },
    viewContent: { flexGrow: 1 },
    preText: {
      color: palette.textPrimary,
      fontFamily: Platform.select({ web: "monospace", default: undefined }),
      lineHeight: 20,
    },
    textEditor: {
      color: palette.textPrimary,
      fontFamily: Platform.select({ web: "monospace", default: undefined }),
      fontSize: 14,
      lineHeight: 20,
      flex: 1,
      textAlignVertical: "top",
      backgroundColor: "transparent",
      borderWidth: 0,
      padding: 0,
    },
    titleEditor: {
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    titleLabel: {
      color: palette.textStrong,
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 8,
    },
    titleInput: {
      color: palette.textPrimary,
      fontSize: 16,
      backgroundColor: palette.inputBackground,
      borderWidth: 1,
      borderColor: palette.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontWeight: "500",
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 40,
    },
    emptyStateText: {
      color: palette.textSecondary,
      fontSize: 16,
      fontWeight: "500",
      marginBottom: 8,
    },
    emptyStateHint: {
      color: palette.textTertiary,
      fontSize: 14,
    },
  });
};

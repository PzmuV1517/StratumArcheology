import React from "react";
import {
  Platform,
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
} from "react-native";
import MarkdownView from "../common/MarkdownView";

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
            placeholderTextColor="#666"
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
          placeholderTextColor="#666"
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

const styles = StyleSheet.create({
  textWrapper: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    backgroundColor: "#0E0E0E",
    padding: 12,
  },
  viewWrapper: { flex: 1 },
  viewContent: { flexGrow: 1 },
  preText: {
    color: "#EAEAEA",
    fontFamily: Platform.select({ web: "monospace", default: undefined }),
    lineHeight: 20,
  },
  textEditor: {
    color: "#EAEAEA",
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
    borderBottomColor: "#2A2A2A",
  },
  titleLabel: {
    color: "#F5F5F5",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  titleInput: {
    color: "#EAEAEA",
    fontSize: 16,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333",
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
    color: "#9A9A9A",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
  },
  emptyStateHint: {
    color: "#666",
    fontSize: 14,
  },
});

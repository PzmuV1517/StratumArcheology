import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { noteService } from "../src/services/noteService";
import { useAutoSave, SaveStatus } from "../src/hooks/useAutoSave";
import { showAlert } from "../src/utils/alert";

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_id: string;
  project_id: string;
}

export default function EditNoteScreen() {
  const { noteId, projectId } = useLocalSearchParams();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [originalDataLoaded, setOriginalDataLoaded] = useState(false);

  // Form data for auto-save
  const formData = useMemo(() => ({ title, content }), [title, content]);
  const initialData = useMemo(() => ({ title: "", content: "" }), []);

  // Auto-save hook
  const {
    saveStatus,
    hasDraft,
    saveDraft,
    restoreDraft,
    clearDraft,
    markSubmitted,
  } = useAutoSave<{
    title: string;
    content: string;
  }>({
    formId: `edit-note-${noteId}`,
    initialData,
    onRestore: (data) => {
      setTitle(data.title);
      setContent(data.content);
    },
    skipRestore: true, // We handle restoration manually via modal
  });

  // Check for draft after original data loads
  useEffect(() => {
    if (originalDataLoaded && hasDraft()) {
      setShowDraftModal(true);
    }
  }, [originalDataLoaded]);

  // Auto-save when form data changes (only after original data loaded)
  useEffect(() => {
    if (originalDataLoaded && (title || content)) {
      saveDraft(formData);
    }
  }, [formData, originalDataLoaded]);

  const handleRestoreDraft = () => {
    restoreDraft();
    setShowDraftModal(false);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setShowDraftModal(false);
  };

  useEffect(() => {
    loadNote();
  }, [noteId]);

  const loadNote = async () => {
    try {
      setLoading(true);
      const noteData: Note = await noteService.getNote(noteId as string);
      setTitle(noteData.title);
      setContent(noteData.content || "");
      setOriginalDataLoaded(true);
    } catch (error: any) {
      console.error("Error loading note:", error);
      const message =
        error?.detail ||
        error?.message ||
        "Failed to load note. It may have been deleted.";
      showAlert("Error", message, [{ text: "OK", onPress: () => router.back() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      showAlert(
        "Missing Fields",
        "Please enter both a title and content for the note.",
      );
      return;
    }

    setSaving(true);
    try {
      await noteService.updateNote(noteId as string, {
        title: title.trim(),
        content: content.trim(),
      });
      markSubmitted(); // Clear draft on successful save
      showAlert("Saved", "Your changes have been saved.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error("Failed to update note:", error);
      const message =
        error?.detail ||
        error?.message ||
        "Failed to save changes. Please try again.";
      showAlert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen
          options={{
            title: "Edit Note",
            headerStyle: { backgroundColor: "#111111" },
            headerTintColor: "#FF2A2A",
            headerTitleStyle: {
              color: "#F5F5F5",
              fontSize: 18,
              fontWeight: "600",
            },
            headerBackTitle: "Note",
            headerShown: true,
          }}
        />
        <ActivityIndicator size="large" color="#FF2A2A" />
        <Text style={styles.loadingText}>Loading note...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Draft Recovery Modal */}
      <Modal
        visible={showDraftModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDraftModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Unsaved Draft Found</Text>
            <Text style={styles.modalText}>
              You have an unsaved draft from a previous editing session. Would you
              like to restore it or discard it?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={handleDiscardDraft}
              >
                <Text style={styles.modalButtonSecondaryText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={handleRestoreDraft}
              >
                <Text style={styles.modalButtonPrimaryText}>Restore</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Stack.Screen
        options={{
          title: "Edit Note",
          headerStyle: { backgroundColor: "#111111" },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: {
            color: "#F5F5F5",
            fontSize: 18,
            fontWeight: "600",
          },
          headerBackTitle: "Note",
          headerShown: true,
        }}
      />

      {/* Save Status Indicator */}
      {saveStatus !== "idle" && (
        <View style={styles.saveStatusBar}>
          <Text style={styles.saveStatusText}>
            {saveStatus === "saving" && "⏳ Saving draft..."}
            {saveStatus === "saved" && "✓ Draft saved"}
            {saveStatus === "error" && "⚠ Failed to save draft"}
          </Text>
        </View>
      )}

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <Text style={styles.pageTitle}>Edit Note</Text>

          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter note title"
            placeholderTextColor="#666"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Content *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your archaeological findings, observations, or thoughts..."
            placeholderTextColor="#666"
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#F5F5F5" />
            ) : (
              <Text style={styles.buttonText}>Save Changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111111",
    padding: 24,
  },
  content: {
    flex: 1,
  },
  loadingText: {
    fontSize: 16,
    color: "#9A9A9A",
    marginTop: 16,
    letterSpacing: 0.5,
  },
  form: {
    padding: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 32,
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: "#1E1E1E",
    color: "#F5F5F5",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#333",
    fontSize: 16,
  },
  textArea: {
    height: 200,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#FF2A2A",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#FF2A2A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#F5F5F5",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  cancelButtonText: {
    color: "#9A9A9A",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  // Auto-save modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    width: "100%",
    borderWidth: 1,
    borderColor: "#333",
  },
  modalTitle: {
    color: "#F5F5F5",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalText: {
    color: "#9A9A9A",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalButtonPrimary: {
    backgroundColor: "#FF2A2A",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalButtonPrimaryText: {
    color: "#F5F5F5",
    fontWeight: "600",
    fontSize: 14,
  },
  modalButtonSecondary: {
    backgroundColor: "#2A2A2A",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
  },
  modalButtonSecondaryText: {
    color: "#9A9A9A",
    fontWeight: "600",
    fontSize: 14,
  },
  // Save status bar - absolutely positioned to avoid layout shift
  saveStatusBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: "rgba(30, 30, 30, 0.95)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  saveStatusText: {
    color: "#9A9A9A",
    fontSize: 12,
    textAlign: "center",
  },
});

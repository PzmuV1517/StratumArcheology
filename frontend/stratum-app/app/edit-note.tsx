/**
 * @file
 * Note editing screen.
 *
 * Allows editing of existing project note content and title.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
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
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { noteService } from "@/services/noteService";
import { useAutoSave } from "@/hooks/useAutoSave";
import { showAlert } from "@/utils/alert";
import { useColorScheme } from "@/hooks/use-color-scheme";

const isIOS = Platform.OS === "ios";

// ---------------------------------------------------------------------------
// Shared UI components (matching create-note / new-project)
// ---------------------------------------------------------------------------
function GlassCard({
  children,
  style,
  styles,
}: {
  children: React.ReactNode;
  style?: object;
  styles: ReturnType<typeof createStyles>;
}) {
  return <View style={[styles.solidCard, style]}>{children}</View>;
}

function GlassButton({
  onPress,
  title,
  variant = "primary",
  icon,
  disabled,
  loading: isLoading,
  styles,
  secondaryIconColor,
}: {
  onPress: () => void;
  title: string;
  variant?: "primary" | "secondary";
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  styles: ReturnType<typeof createStyles>;
  secondaryIconColor: string;
}) {
  const isPrimary = variant === "primary";
  const content = (
    <>
      {icon && (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={isPrimary ? "#FFFFFF" : secondaryIconColor}
          style={{ marginRight: 8 }}
        />
      )}
      {isLoading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={[styles.buttonText, !isPrimary && styles.secondaryButtonText]}>
          {title}
        </Text>
      )}
    </>
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
      style={[
        isPrimary ? styles.primaryButton : styles.secondaryBtn,
        disabled && styles.disabledButton,
      ]}
    >
      {content}
    </TouchableOpacity>
  );
}

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
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const pageBackground = isDarkMode ? "#111111" : "#F7F7F7";
  const textPrimary = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const textSecondary = isDarkMode ? "#9A9A9A" : "#666666";
  const placeholderTextColor = isDarkMode ? "#555" : "#7A7A7A";

  const { noteId, projectId: _projectId } = useLocalSearchParams();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const _iosHeaderPad = isIOS
    ? Math.max(headerHeight || 0, (insets.top || 0) + 44) + 8
    : 0;
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
  const { saveStatus, hasDraft, saveDraft, getDraft, clearDraft, markSubmitted } =
    useAutoSave<{
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
    const checkDraft = async () => {
      if (originalDataLoaded) {
        const exists = await hasDraft();
        if (exists) setShowDraftModal(true);
      }
    };
    checkDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalDataLoaded]);

  // Auto-save when form data changes (only after original data loaded)
  useEffect(() => {
    if (originalDataLoaded && (title || content)) {
      saveDraft(formData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, originalDataLoaded]);

  const handleRestoreDraft = async () => {
    const draft = await getDraft();
    if (draft) {
      setTitle(draft.title);
      setContent(draft.content);
    }
    setShowDraftModal(false);
  };

  const handleDiscardDraft = async () => {
    await clearDraft();
    setShowDraftModal(false);
  };

  useEffect(() => {
    loadNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const stackScreenOpts = {
    headerTransparent: isIOS,
    headerBlurEffect: isIOS ? ("systemChromeMaterial" as const) : undefined,
    headerStyle: isIOS ? {} : { backgroundColor: pageBackground },
    headerTintColor: "#FF2A2A",
    headerTitleStyle: { color: textPrimary, fontWeight: "600" as const },
    headerBackTitle: "Note",
    headerShown: true,
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Edit Note", ...stackScreenOpts }} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF2A2A" />
          <Text style={styles.loadingText}>Loading note...</Text>
        </View>
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
          <GlassCard style={styles.modalContent} styles={styles}>
            <Text style={styles.modalTitle}>Unsaved Draft Found</Text>
            <Text style={styles.modalText}>
              You have an unsaved draft from a previous editing session. Would you
              like to restore it or discard it?
            </Text>
            <View style={styles.modalButtons}>
              <GlassButton
                onPress={handleDiscardDraft}
                title="Discard"
                variant="secondary"
                styles={styles}
                secondaryIconColor={textSecondary}
              />
              <GlassButton
                onPress={handleRestoreDraft}
                title="Restore"
                variant="primary"
                icon="refresh"
                styles={styles}
                secondaryIconColor={textSecondary}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>

      <Stack.Screen options={{ title: "Edit Note", ...stackScreenOpts }} />

      {/* Save Status Indicator */}
      {saveStatus !== "idle" && (
        <View
          style={[
            styles.saveStatusBar,
            isIOS
              ? { top: Math.max(headerHeight || 0, (insets.top || 0) + 44) }
              : null,
          ]}
        >
          <Text style={styles.saveStatusText}>
            {saveStatus === "saving"
              ? "Saving draft..."
              : saveStatus === "saved"
                ? "Draft saved"
                : saveStatus === "error"
                  ? "Save failed"
                  : ""}
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header icon */}
        <View style={styles.headerIcon}>
          <Ionicons name="create" size={48} color="#FF2A2A" />
        </View>
        <Text style={styles.title}>Edit Note</Text>
        <Text style={styles.subtitle}>Update your note details and content</Text>

        {/* Title card */}
        <GlassCard style={styles.card} styles={styles}>
          <Text style={styles.label}>
            <Ionicons name="text" size={14} color={textSecondary} /> Title
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter note title"
            placeholderTextColor={placeholderTextColor}
            value={title}
            onChangeText={setTitle}
          />
        </GlassCard>

        {/* Content card */}
        <GlassCard style={styles.card} styles={styles}>
          <Text style={styles.label}>
            <Ionicons name="document-text" size={14} color={textSecondary} /> Content
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your archaeological findings, observations, or thoughts..."
            placeholderTextColor={placeholderTextColor}
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
          />
        </GlassCard>

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          <GlassButton
            onPress={handleSave}
            title={saving ? "Saving..." : "Save Changes"}
            variant="primary"
            icon="checkmark-circle"
            disabled={saving}
            loading={saving}
            styles={styles}
            secondaryIconColor={textSecondary}
          />
          <GlassButton
            onPress={() => router.back()}
            title="Cancel"
            variant="secondary"
            disabled={saving}
            styles={styles}
            secondaryIconColor={textSecondary}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
      padding: 24,
      gap: 16,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 24,
      paddingTop: 24,
      paddingBottom: 48,
    },
    loadingText: {
      fontSize: 16,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginTop: 16,
    },
    // Header
    headerIcon: { alignItems: "center", marginBottom: 16, marginTop: 16 },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: isDarkMode ? "#FFFFFF" : "#1A1A1A",
      textAlign: "center",
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      textAlign: "center",
      marginBottom: 32,
      lineHeight: 22,
    },
    // Cards
    card: { marginBottom: 16 },
    glassCard: { borderRadius: 20, padding: 20, overflow: "hidden" },
    blurCard: {
      borderRadius: 20,
      padding: 20,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDarkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.12)",
    },
    solidCard: {
      borderRadius: 20,
      padding: 20,
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginBottom: 12,
    },
    input: {
      backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "#FFFFFF",
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: isDarkMode ? "#FFFFFF" : "#1A1A1A",
      borderWidth: 1,
      borderColor: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "#D9D9D9",
    },
    textArea: {
      height: 200,
      textAlignVertical: "top",
    },
    // Buttons
    buttonContainer: { gap: 12, marginTop: 8 },
    buttonTouchable: { borderRadius: 14, overflow: "hidden" },
    primaryButtonGlass: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      paddingHorizontal: 24,
      backgroundColor: "rgba(255, 42, 42, 0.4)",
    },
    primaryButtonBlur: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      paddingHorizontal: 24,
      backgroundColor: "rgba(255, 42, 42, 0.3)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255, 255, 255, 0.2)",
    },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FF2A2A",
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 24,
    },
    secondaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    disabledButton: { opacity: 0.5 },
    buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
    secondaryButtonText: { color: isDarkMode ? "#9A9A9A" : "#666666" },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: isDarkMode ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.24)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalContent: {
      maxWidth: 420,
      width: "100%",
    },
    modalTitle: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 12,
    },
    modalText: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 24,
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
    },
    // Save status bar
    saveStatusBar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      backgroundColor: isDarkMode
        ? "rgba(30, 30, 30, 0.95)"
        : "rgba(255,255,255,0.95)",
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(0, 0, 0, 0.08)",
    },
    saveStatusText: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontSize: 12,
      textAlign: "center",
    },
  });

/**
 * @file
 * Voice note playback screen with transcription support.
 *
 * Plays back recorded voice notes and shows the auto-generated
 * transcription. Users can edit the transcription inline and reset
 * it to the original AI-generated text. All edits are logged for
 * Time Machine history.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { noteService } from "@/services/noteService";
import { Note } from "@/services/noteService.core";
import AudioPanel from "@/components/data/AudioPanel";
import { useColorScheme } from "@/hooks/use-color-scheme";

type TranscriptionStatus = "pending" | "processing" | "completed" | "failed" | null;

export default function VoiceNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

  const pageBackground = isDarkMode ? "#111111" : "#F7F7F7";
  const textPrimary = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const textSecondary = isDarkMode ? "#9A9A9A" : "#666666";
  const cardBackground = isDarkMode ? "#1E1E1E" : "#FFFFFF";
  const borderColor = isDarkMode ? "#2A2A2A" : "#E5E5E5";
  const inputBackground = isDarkMode ? "#2A2A2A" : "#F0F0F0";

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Transcription state
  const [transcription, setTranscription] = useState<string>("");
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionStatus>(null);
  const [transcriptionModified, setTranscriptionModified] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadNote = useCallback(async () => {
    if (!id) return;
    const n = await noteService.getNote(id);
    setNote(n);
    const att = (n.attachments || []).find((a: any) =>
      (a.mime_type || a.file_type)?.startsWith("audio/"),
    );
    setAudioUrl(att?.url || null);
    setTranscription(n.transcription ?? "");
    setTranscriptionStatus(n.transcription_status ?? null);
    setTranscriptionModified(n.transcription_modified ?? false);
  }, [id]);

  // Poll while transcription is pending/processing
  useEffect(() => {
    (async () => {
      try {
        await loadNote();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadNote]);

  useEffect(() => {
    if (transcriptionStatus === "pending" || transcriptionStatus === "processing") {
      pollRef.current = setInterval(async () => {
        if (!id) return;
        try {
          const n = await noteService.getNote(id);
          const status = n.transcription_status as TranscriptionStatus;
          setTranscriptionStatus(status);
          if (status === "completed" || status === "failed") {
            setTranscription(n.transcription ?? "");
            setTranscriptionModified(n.transcription_modified ?? false);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [transcriptionStatus, id]);

  const handleEdit = () => {
    setEditValue(transcription);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const result = await noteService.updateTranscription(id, editValue);
      setTranscription(result.transcription);
      setTranscriptionModified(result.transcription_modified);
      setIsEditing(false);
    } catch {
      Alert.alert("Error", "Could not save transcription. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!id) return;
    setResetting(true);
    setConfirmingReset(false);
    try {
      const result = await noteService.resetTranscription(id);
      setTranscription(result.transcription);
      setTranscriptionModified(result.transcription_modified);
    } catch {
      Alert.alert("Error", "Could not reset transcription. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  const renderTranscriptionSection = () => {
    if (!audioUrl) return null;

    if (transcriptionStatus === "pending" || transcriptionStatus === "processing") {
      return (
        <View style={[styles.transcriptionCard, { backgroundColor: cardBackground, borderColor }]}>
          <Text style={[styles.transcriptionLabel, { color: textSecondary }]}>Transcription</Text>
          <View style={styles.transcriptionLoading}>
            <ActivityIndicator size="small" color="#FF2A2A" />
            <Text style={[styles.transcriptionLoadingText, { color: textSecondary }]}>
              Transcribing audio…
            </Text>
          </View>
        </View>
      );
    }

    if (transcriptionStatus === "failed") {
      return (
        <View style={[styles.transcriptionCard, { backgroundColor: cardBackground, borderColor }]}>
          <Text style={[styles.transcriptionLabel, { color: textSecondary }]}>Transcription</Text>
          <Text style={[styles.transcriptionFailed, { color: "#FF2A2A" }]}>
            Transcription failed. The audio may be too short or the server encountered an error.
          </Text>
        </View>
      );
    }

    if (!transcription && transcriptionStatus !== "completed") return null;

    return (
      <View style={[styles.transcriptionCard, { backgroundColor: cardBackground, borderColor }]}>
        <View style={styles.transcriptionHeader}>
          <Text style={[styles.transcriptionLabel, { color: textSecondary }]}>Transcription</Text>
          {transcriptionModified && (
            <View style={styles.modifiedBadge}>
              <Text style={styles.modifiedBadgeText}>Edited</Text>
            </View>
          )}
        </View>

        <Text style={[styles.disclaimer, { color: textSecondary }]}>
          ⚠ Auto-generated — may contain errors
        </Text>

        {isEditing ? (
          <>
            <TextInput
              style={[
                styles.transcriptionInput,
                { backgroundColor: inputBackground, color: textPrimary, borderColor },
              ]}
              value={editValue}
              onChangeText={setEditValue}
              multiline
              autoFocus
              textAlignVertical="top"
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn, { borderColor }]}
                onPress={handleCancelEdit}
                disabled={saving}
              >
                <Text style={[styles.actionBtnText, { color: textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.saveBtn]}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.actionBtnText, { color: "#fff" }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.transcriptionText, { color: textPrimary }]}>
              {transcription || "No transcription available."}
            </Text>
            {confirmingReset ? (
              <View style={[styles.confirmBox, { borderColor, backgroundColor: isDarkMode ? "#2A1A1A" : "#FFF0F0" }]}>
                <Text style={[styles.confirmText, { color: textPrimary }]}>
                  Restore original AI transcription? Your edits will be lost.
                </Text>
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.cancelBtn, { borderColor }]}
                    onPress={() => setConfirmingReset(false)}
                  >
                    <Text style={[styles.actionBtnText, { color: textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#FF2A2A" }]}
                    onPress={handleConfirmReset}
                    disabled={resetting}
                  >
                    {resetting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.actionBtnText, { color: "#fff" }]}>Restore</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.editActions}>
                {transcriptionModified && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.resetBtn, { borderColor }]}
                    onPress={() => setConfirmingReset(true)}
                  >
                    <Text style={[styles.actionBtnText, { color: "#FF2A2A" }]}>Reset</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.editBtn]}
                  onPress={handleEdit}
                >
                  <Text style={[styles.actionBtnText, { color: "#fff" }]}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Manual top bar */}
      <View style={[styles.topBar, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={[styles.backText, { color: "#FF2A2A" }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: textPrimary }]} numberOfLines={1}>
          {note?.title || "Voice Note"}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FF2A2A" />
          <Text style={[styles.loadingText, { color: textSecondary }]}>Loading…</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: textPrimary }]}>{note?.title}</Text>

          <View style={styles.audioSection}>
            <AudioPanel audioUrl={audioUrl || ""} />
            {!audioUrl && (
              <Text style={{ color: textSecondary, marginTop: 12 }}>
                No audio attachment found.
              </Text>
            )}
          </View>

          {renderTranscriptionSection()}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      width: 72,
    },
    backArrow: {
      color: "#FF2A2A",
      fontSize: 28,
      lineHeight: 28,
      marginRight: 2,
    },
    backText: {
      fontSize: 16,
      fontWeight: "500",
    },
    topBarTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 16,
      fontWeight: "600",
    },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    loadingText: { marginTop: 8 },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 16,
    },
    audioSection: {
      marginBottom: 20,
    },
    transcriptionCard: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 16,
      marginTop: 4,
    },
    transcriptionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    transcriptionLabel: {
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    modifiedBadge: {
      backgroundColor: "#FF2A2A22",
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    modifiedBadgeText: {
      color: "#FF2A2A",
      fontSize: 11,
      fontWeight: "600",
    },
    disclaimer: {
      fontSize: 12,
      marginBottom: 12,
      fontStyle: "italic",
    },
    transcriptionText: {
      fontSize: 15,
      lineHeight: 22,
    },
    transcriptionInput: {
      borderRadius: 8,
      borderWidth: 1,
      padding: 12,
      fontSize: 15,
      lineHeight: 22,
      minHeight: 120,
      marginBottom: 12,
    },
    transcriptionLoading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 8,
    },
    transcriptionLoadingText: {
      fontSize: 14,
    },
    transcriptionFailed: {
      fontSize: 14,
      marginTop: 8,
    },
    editActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
      marginTop: 12,
    },
    actionBtn: {
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      minWidth: 64,
      alignItems: "center",
      justifyContent: "center",
    },
    actionBtnText: {
      fontSize: 14,
      fontWeight: "600",
    },
    cancelBtn: {
      borderWidth: 1,
    },
    saveBtn: {
      backgroundColor: "#FF2A2A",
    },
    editBtn: {
      backgroundColor: "#FF2A2A",
    },
    resetBtn: {
      borderWidth: 1,
    },
    confirmBox: {
      borderRadius: 8,
      borderWidth: 1,
      padding: 12,
      marginTop: 12,
      gap: 10,
    },
    confirmText: {
      fontSize: 13,
    },
  });

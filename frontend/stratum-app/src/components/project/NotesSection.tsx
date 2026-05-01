/**
 * @file
 * Project notes section component.
 *
 * Displays a searchable, sortable list of project notes
 * with create and edit actions.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { config } from "../../config/config";
import { showAlert } from "../../utils/alert";
import { useColorScheme } from "../../hooks/use-color-scheme";

// Get API base URL for streaming endpoint (uses the same logic as api.ts)
const getApiBaseUrl = async (): Promise<string> => {
  try {
    // Check for runtime override first (same key as api.ts uses)
    const override = await AsyncStorage.getItem("apiBaseUrlOverride");
    return override || config.apiBaseUrl;
  } catch {
    return config.apiBaseUrl;
  }
};

interface NoteAttachment {
  id?: string;
  filename?: string;
  mime_type?: string;
  file_type?: string;
  url?: string;
}

interface Note {
  id: string;
  title: string;
  content?: string | null;
  created_at: string;
  updated_at: string;
  attachments?: NoteAttachment[];
}

interface Props {
  notes: Note[];
  onCreateNote: () => void;
  onNotePress: (id: string) => void;
  onDeleteNote: (id: string) => void;
  canEdit?: boolean;
}

export default function NotesSection({
  notes,
  onCreateNote,
  onNotePress,
  onDeleteNote,
  canEdit = true,
}: Props) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const router = useRouter();

  const MiniAudio = ({
    url,
    noteId,
    attachmentId,
  }: {
    url?: string;
    noteId?: string;
    attachmentId?: string;
  }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<AudioContext | null>(null);
    const rafRef = useRef<number>(0);
    const soundRef = useRef<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);
    const [streamUrl, setStreamUrl] = useState<string | null>(null);

    // Build streaming URL for native platforms
    useEffect(() => {
      if (Platform.OS !== "web" && noteId && attachmentId) {
        getApiBaseUrl().then((baseUrl) => {
          // baseUrl already ends with /api, so just append /notes/...
          setStreamUrl(
            `${baseUrl}/notes/${noteId}/attachments/${attachmentId}/stream`,
          );
        });
      }
    }, [noteId, attachmentId]);

    // Native audio playback - use streaming URL on native, direct URL on web
    const playNativeAudio = useCallback(async () => {
      const audioUrl = Platform.OS === "web" ? url : streamUrl;
      if (!audioUrl) return;
      try {
        setIsLoading(true);
        // Unload previous sound if exists
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }

        // Get auth token for the streaming request
        const token = await AsyncStorage.getItem("authToken");

        // Create and play new sound
        const { sound, status: _status } = await Audio.Sound.createAsync(
          {
            uri: audioUrl,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          },
          { shouldPlay: true },
          (playbackStatus) => {
            if (playbackStatus.isLoaded) {
              setPosition(playbackStatus.positionMillis);
              setDuration(playbackStatus.durationMillis || 0);
              setIsPlaying(playbackStatus.isPlaying);
              if (playbackStatus.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
              }
            }
          },
        );
        soundRef.current = sound;
        setIsLoading(false);
      } catch (e) {
        console.error("Failed to play audio:", e);
        setIsLoading(false);
        showAlert("Error", "Failed to play audio");
      }
    }, [url, streamUrl]);

    const pauseNativeAudio = useCallback(async () => {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (soundRef.current) {
          soundRef.current.unloadAsync();
        }
      };
    }, []);

    useEffect(() => {
      if (Platform.OS !== "web") return;
      if (!url || !audioRef.current || !canvasRef.current) return;
      let ctx: AudioContext | null = null;
      let analyser: AnalyserNode | null = null;
      let mounted = true;
      try {
        audioRef.current.crossOrigin = "anonymous";
        ctx = new AudioContext();
        ctxRef.current = ctx;
        const src = ctx.createMediaElementSource(audioRef.current);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        const data = new Uint8Array(analyser.fftSize);
        const g = canvasRef.current.getContext("2d")!;
        const draw = () => {
          if (!mounted || !canvasRef.current) return;
          rafRef.current = requestAnimationFrame(draw);
          analyser!.getByteTimeDomainData(data);
          const w = canvasRef.current.width;
          const h = canvasRef.current.height;
          g.clearRect(0, 0, w, h);
          g.strokeStyle = "#FF2A2A";
          g.lineWidth = 2;
          g.beginPath();
          const slice = w / data.length;
          for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128 - 1;
            const y = (v * h) / 2 + h / 2;
            if (i === 0) g.moveTo(0, y);
            else g.lineTo(i * slice, y);
          }
          g.stroke();
        };
        draw();
      } catch {}
      return () => {
        mounted = false;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        try {
          ctx?.close();
        } catch {}
      };
    }, [url]);

    if (Platform.OS !== "web") {
      const formatTime = (ms: number) => {
        const secs = Math.floor(ms / 1000);
        const mins = Math.floor(secs / 60);
        const remainingSecs = secs % 60;
        return `${mins}:${remainingSecs.toString().padStart(2, "0")}`;
      };

      return (
        <View style={styles.nativeAudioPlayer}>
          <TouchableOpacity
            style={styles.audioPlayBtn}
            onPress={isPlaying ? pauseNativeAudio : playNativeAudio}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FF2A2A" />
            ) : (
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={20}
                color="#FF2A2A"
              />
            )}
          </TouchableOpacity>
          <View style={styles.audioProgress}>
            <View
              style={[
                styles.audioProgressBar,
                { width: duration > 0 ? `${(position / duration) * 100}%` : "0%" },
              ]}
            />
          </View>
          <Text style={styles.audioTime}>
            {formatTime(position)} / {formatTime(duration)}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.audioPreviewWrapper}>
        {/* @ts-ignore */}
        <audio
          ref={audioRef as any}
          src={url}
          controls
          preload="metadata"
          style={styles.audioTag}
          onPlay={() => {
            const c = ctxRef.current;
            if (c && c.state === "suspended") c.resume().catch(() => {});
          }}
        />
        <canvas ref={canvasRef} width={300} height={40} style={styles.audioCanvas} />
      </View>
    );
  };

  const renderNote = ({ item }: { item: Note }) => {
    const attachments = item.attachments || [];
    const hasAudio = attachments.some((a) =>
      (a.mime_type || a.file_type || "").startsWith("audio/"),
    );
    const isVoice = (!item.content || item.content.trim() === "") && hasAudio;
    const audioAtt = attachments.find((a) =>
      (a.mime_type || a.file_type || "").startsWith("audio/"),
    );

    return (
      <View style={styles.noteCard}>
        <TouchableOpacity
          onPress={() =>
            isVoice
              ? router.push({ pathname: "/voice-note/[id]", params: { id: item.id } })
              : onNotePress(item.id)
          }
          activeOpacity={0.7}
        >
          <View style={styles.noteHeader}>
            <Text style={styles.noteTitle} numberOfLines={1}>
              {item.title}
              {isVoice ? " (Voice)" : ""}
            </Text>
            <Text style={styles.noteDate}>
              {new Date(item.updated_at).toLocaleDateString(undefined, {
                timeZone: "UTC",
              })}
            </Text>
          </View>
          {!isVoice && !!item.content && (
            <Text style={styles.notePreview} numberOfLines={2}>
              {item.content}
            </Text>
          )}
          {isVoice && audioAtt?.url && (
            <MiniAudio
              url={audioAtt.url}
              noteId={item.id}
              attachmentId={audioAtt.id}
            />
          )}
        </TouchableOpacity>
        {isVoice && canEdit && (
          <View style={styles.voiceActions}>
            {pendingDeleteId === item.id ? (
              <View style={styles.inlineConfirm}>
                <Text style={styles.confirmText}>Delete this voice note?</Text>
                <View style={styles.confirmButtons}>
                  <TouchableOpacity
                    style={[styles.metaBtn, styles.cancelBtn]}
                    onPress={() => setPendingDeleteId(null)}
                  >
                    <Text style={styles.metaBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.metaBtn, styles.deleteBtn]}
                    onPress={() => {
                      setPendingDeleteId(null);
                      onDeleteNote(item.id);
                    }}
                  >
                    <Text style={[styles.metaBtnText, styles.deleteBtnText]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.metaBtn, styles.deleteBtn]}
                onPress={() => {
                  if (Platform.OS === "web") {
                    // Inline confirmation for web
                    setPendingDeleteId(item.id);
                  } else {
                    showAlert(
                      "Delete voice note?",
                      "This will permanently delete the note and its audio attachment.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => onDeleteNote(item.id),
                        },
                      ],
                    );
                  }
                }}
              >
                <Text style={[styles.metaBtnText, styles.deleteBtnText]}>
                  Delete
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Notes</Text>
        {canEdit && (
          <TouchableOpacity style={styles.addButton} onPress={onCreateNote}>
            <Text style={styles.addButtonText}>+ Add Note</Text>
          </TouchableOpacity>
        )}
      </View>
      {notes.length > 0 ? (
        <FlatList
          data={notes}
          renderItem={renderNote}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No notes yet</Text>
          {canEdit ? (
            <>
              <Text style={styles.emptyStateSubtext}>
                Create your first note to get started
              </Text>
              <TouchableOpacity style={styles.createButton} onPress={onCreateNote}>
                <Text style={styles.createButtonText}>CREATE FIRST NOTE</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.emptyStateSubtext}>
              No notes have been added to this project yet
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
    },
    addButton: {
      backgroundColor: "#FF2A2A",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
    },
    addButtonText: { color: "#F5F5F5", fontWeight: "600", fontSize: 12 },
    noteCard: {
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    noteHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    noteTitle: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontWeight: "700",
      fontSize: 16,
      flex: 1,
      marginRight: 8,
    },
    noteDate: { color: isDarkMode ? "#9A9A9A" : "#666666", fontSize: 12 },
    notePreview: { color: isDarkMode ? "#CFCFCF" : "#4D4D4D", marginTop: 4 },
    emptyState: { alignItems: "center", paddingVertical: 48 },
    emptyStateText: {
      fontSize: 18,
      fontWeight: "600",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 8,
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginBottom: 24,
    },
    createButton: {
      backgroundColor: isDarkMode ? "#2A2A2A" : "#EFEFEF",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#333" : "#D0D0D0",
    },
    createButtonText: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontWeight: "600",
    },
    audioPreviewWrapper: { marginTop: 6, gap: 6 },
    audioTag: { width: "100%" },
    audioCanvas: {
      width: "100%",
      height: 40,
      backgroundColor: isDarkMode ? "#111" : "#EDEDED",
      borderRadius: 6,
    },
    voiceActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
      flexWrap: "wrap",
    },
    metaBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: isDarkMode ? "#2A2A2A" : "#F1F1F1",
      borderWidth: 1,
      borderColor: isDarkMode ? "#333" : "#D9D9D9",
    },
    metaBtnText: {
      color: isDarkMode ? "#CFCFCF" : "#4D4D4D",
      fontSize: 12,
      fontWeight: "600",
    },
    deleteBtn: {
      borderColor: isDarkMode ? "#3A0C0C" : "#F3B3B3",
      backgroundColor: isDarkMode ? "#2A1414" : "#FFECEC",
    },
    deleteBtnText: { color: "#FF4444" },
    inlineConfirm: {
      flex: 1,
      padding: 8,
      backgroundColor: isDarkMode ? "#1E1E1E" : "#FFFFFF",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? "#333" : "#D9D9D9",
      gap: 8,
    },
    confirmText: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 12,
      fontWeight: "600",
    },
    confirmButtons: { flexDirection: "row", gap: 8 },
    cancelBtn: {
      backgroundColor: isDarkMode ? "#2A2A2A" : "#F1F1F1",
      borderColor: isDarkMode ? "#444" : "#D9D9D9",
    },
    nativeAudioPlayer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#111" : "#F3F3F3",
      borderRadius: 8,
      padding: 8,
      gap: 8,
    },
    audioPlayBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDarkMode ? "#2A2A2A" : "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#FF2A2A",
    },
    audioPlayIcon: {
      color: "#FF2A2A",
      fontSize: 14,
    },
    audioProgress: {
      flex: 1,
      height: 4,
      backgroundColor: isDarkMode ? "#2A2A2A" : "#DADADA",
      borderRadius: 2,
      overflow: "hidden",
    },
    audioProgressBar: {
      height: "100%",
      backgroundColor: "#FF2A2A",
    },
    audioTime: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontSize: 11,
      minWidth: 70,
      textAlign: "right",
    },
  });

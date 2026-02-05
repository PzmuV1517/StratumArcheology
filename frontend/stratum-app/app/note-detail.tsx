import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from "expo-router";
import { noteService } from "../src/services/noteService";

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_id: string;
  project_id: string;
  attachments?: {
    id: string;
    filename?: string;
    file_path?: string;
    mime_type?: string;
    url?: string;
  }[];
}

export default function NoteDetailScreen() {
  const { noteId, projectId } = useLocalSearchParams();
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadNote();
  }, [noteId]);

  // Reload note when screen comes back into focus (after editing)
  useFocusEffect(
    React.useCallback(() => {
      if (noteId) {
        loadNote();
      }
    }, [noteId]),
  );

  const loadNote = async () => {
    try {
      setLoading(true);
      const noteData = await noteService.getNote(noteId as string);
      setNote(noteData);
    } catch (error) {
      console.error("Error loading note:", error);
      Alert.alert("Error", "Failed to load note details", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    router.push({
      pathname: "/edit-note",
      params: { noteId, projectId },
    });
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      setIsDeleting(true);
      await noteService.deleteNote(noteId as string);
      setShowDeleteModal(false);
      Alert.alert("Deleted", "Note has been deleted.", [
        {
          text: "OK",
          onPress: () => {
            // Navigate back to the project detail page reliably
            if (projectId) {
              router.replace({
                pathname: "/project/[id]",
                params: { id: String(projectId) },
              });
            } else {
              router.back();
            }
          },
        },
      ]);
    } catch (error: any) {
      console.error("Error deleting note:", error);
      const message =
        error?.detail ||
        error?.message ||
        "Failed to delete note. Please try again.";
      Alert.alert("Error", message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen
          options={{
            title: "Note Details",
            headerStyle: { backgroundColor: "#111111" },
            headerTintColor: "#FF2A2A",
            headerTitleStyle: {
              color: "#F5F5F5",
              fontSize: 18,
              fontWeight: "600",
            },
            headerBackTitle: "Project",
            headerShown: true,
            presentation: "card",
          }}
        />
        <ActivityIndicator size="large" color="#FF2A2A" />
        <Text style={styles.loadingText}>Loading note...</Text>
      </View>
    );
  }

  if (!note) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen
          options={{
            title: "Note Not Found",
            headerStyle: { backgroundColor: "#111111" },
            headerTintColor: "#FF2A2A",
            headerTitleStyle: {
              color: "#F5F5F5",
              fontSize: 18,
              fontWeight: "600",
            },
            headerBackTitle: "Project",
            headerShown: true,
          }}
        />
        <Text style={styles.errorText}>Note not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back to Project</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isAudioNote =
    note &&
    (!note.content || note.content.trim() === "") &&
    (note.attachments || []).some((a: any) =>
      (a.mime_type || a.file_type)?.startsWith("audio/"),
    );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: note.title,
          headerStyle: { backgroundColor: "#111111" },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: {
            color: "#F5F5F5",
            fontSize: 18,
            fontWeight: "600",
          },
          headerBackTitle: "Project",
          headerShown: true,
          presentation: "card",
          headerRight: () => (
            <View style={styles.headerButtons}>
              <TouchableOpacity onPress={handleEdit} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                <Text style={[styles.headerButtonText, styles.deleteButtonText]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <ScrollView style={styles.content}>
        <View style={styles.noteContainer}>
          <Text style={styles.noteTitle}>{note.title}</Text>

          <View style={styles.noteMeta}>
            <Text style={styles.noteMetaText}>
              Created: {new Date(note.created_at).toLocaleDateString()}
            </Text>
            {note.updated_at !== note.created_at && (
              <Text style={styles.noteMetaText}>
                Updated: {new Date(note.updated_at).toLocaleDateString()}
              </Text>
            )}
          </View>

          {isAudioNote ? (
            <View style={styles.voiceNoteWrapper}>
              <Text style={styles.sectionTitle}>Voice Note</Text>
              {(note?.attachments || [])
                .filter((a: any) =>
                  (a.mime_type || a.file_type)?.startsWith("audio/"),
                )
                .map((att: any) => (
                  <View key={att.id} style={styles.voicePlayback}>
                    <AudioAttachmentPlayer url={att.url} />
                  </View>
                ))}
            </View>
          ) : (
            <View style={styles.noteContentWrapper}>
              <Text style={styles.noteContent}>{note.content}</Text>
            </View>
          )}

          {/* Attachments section */}
          {note.attachments &&
            note.attachments.length > 0 &&
            (() => {
              const nonAudio = note.attachments.filter(
                (a: any) => !(a.mime_type || a.file_type)?.startsWith("audio/"),
              );
              if (isAudioNote && nonAudio.length === 0) return null;
              return (
                <View style={{ marginTop: 24 }}>
                  <Text
                    style={{ color: "#F5F5F5", fontWeight: "700", marginBottom: 12 }}
                  >
                    Attachments
                  </Text>
                  {nonAudio.map((att: any) => (
                    <View key={att.id} style={{ marginBottom: 12 }}>
                      <Text style={{ color: "#9A9A9A" }}>{att.filename}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}
        </View>
      </ScrollView>

      {/* Delete confirmation modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete note?</Text>
            <Text style={styles.modalText}>
              This will permanently delete this note and its attachments. This action
              cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: "#3A0C0C",
                    borderWidth: 1,
                    borderColor: "#FF4444",
                    opacity: isDeleting ? 0.7 : 1,
                  },
                ]}
                onPress={confirmDelete}
                disabled={isDeleting}
              >
                <Text style={[styles.modalButtonText, { color: "#FF4444" }]}>
                  {isDeleting ? "Deleting…" : "Delete"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const AudioAttachmentPlayer = ({ url }: { url: string }) => {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const ctxRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const rafRef = React.useRef<number>(0);
  const [ready, setReady] = React.useState(false);

  const cleanup = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try {
      ctxRef.current?.close();
    } catch {}
    ctxRef.current = null;
    analyserRef.current = null;
  };

  const init = () => {
    if (!url || !audioRef.current || !canvasRef.current) return;
    if (ctxRef.current) return; // already initialized
    try {
      audioRef.current.crossOrigin = "anonymous";
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const srcNode = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      srcNode.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.fftSize);
      const g = canvasRef.current.getContext("2d")!;
      const draw = () => {
        rafRef.current = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(data);
        g.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
        g.strokeStyle = "#FF2A2A";
        g.lineWidth = 2;
        g.beginPath();
        const slice = canvasRef.current!.width / data.length;
        for (let i = 0; i < data.length; i++) {
          const v = data[i] / 128.0 - 1.0;
          const y =
            (v * canvasRef.current!.height) / 2 + canvasRef.current!.height / 2;
          if (i === 0) g.moveTo(0, y);
          else g.lineTo(i * slice, y);
        }
        g.stroke();
      };
      draw();
      setReady(true);
    } catch (e) {
      console.warn("Attachment audio init failed", e);
    }
  };

  React.useEffect(() => {
    cleanup();
    // Wait for user interaction or metadata before initializing
    const el = audioRef.current;
    if (!el) return;
    const onMeta = () => {
      try {
        el.currentTime = 0;
      } catch {}
    };
    const onFirstPlay = () => {
      init();
      const ctx = ctxRef.current;
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    };
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("play", onFirstPlay, { once: true });
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("play", onFirstPlay);
      cleanup();
    };
  }, [url]);

  const needsResume = ctxRef.current && ctxRef.current.state === "suspended";

  return (
    <View style={{ gap: 8, position: "relative" }}>
      {/* @ts-ignore */}
      <audio
        ref={audioRef as any}
        src={url}
        controls
        style={{ width: "100%" }}
        preload="metadata"
        playsInline
      />
      {(!ready || needsResume) && (
        <TouchableOpacity
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 6,
          }}
          onPress={() => {
            init();
            const ctx = ctxRef.current;
            if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
            try {
              audioRef.current?.play();
            } catch {}
          }}
        >
          <Text style={{ color: "#F5F5F5", fontWeight: "600" }}>
            Tap to enable audio
          </Text>
        </TouchableOpacity>
      )}
      <canvas
        ref={canvasRef as any}
        width={600}
        height={60}
        style={{
          width: "100%",
          height: 60,
          backgroundColor: "#111",
          borderRadius: 6,
        }}
      />
    </View>
  );
};

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
  errorText: {
    fontSize: 18,
    color: "#F5F5F5",
    marginBottom: 24,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  backButton: {
    backgroundColor: "#FF2A2A",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  backButtonText: {
    color: "#F5F5F5",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerButtonText: {
    color: "#FF2A2A",
    fontSize: 16,
    fontWeight: "600",
  },
  deleteButtonText: {
    color: "#FF4444",
  },
  noteContainer: {
    padding: 24,
  },
  noteTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  noteMeta: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  noteMetaText: {
    fontSize: 14,
    color: "#9A9A9A",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  contentContainer: {
    backgroundColor: "#1E1E1E",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  noteContent: {
    fontSize: 16,
    color: "#F5F5F5",
    lineHeight: 24,
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333",
    width: "100%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: "#CCCCCC",
    marginBottom: 16,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#2A2A2A",
  },
  modalButtonText: {
    color: "#F5F5F5",
    fontSize: 14,
    fontWeight: "600",
  },
  voiceNoteWrapper: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  voicePlayback: {
    marginBottom: 16,
  },
  noteContentWrapper: {
    backgroundColor: "#1E1E1E",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  sectionTitle: {
    color: "#F5F5F5",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 12,
  },
});

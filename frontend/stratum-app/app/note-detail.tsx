/**
 * Note Detail Screen
 * Restyled to match new-project / join-project design language
 * with iOS Liquid Glass support.
 */
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Platform,
} from "react-native";
import { useDelayedLoading } from "../src/hooks/useDelayedLoading";
import { NoteDetailSkeleton } from "../src/components/common/Skeleton";
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { noteService } from "../src/services/noteService";
import { showAlert } from "../src/utils/alert";

const isIOS = Platform.OS === "ios";

// ---------------------------------------------------------------------------
// Shared UI components (matching new-project / join-project)
// ---------------------------------------------------------------------------
function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[s.solidCard, style]}>{children}</View>;
}

function GlassButton({
  onPress,
  title,
  variant = "primary",
  icon,
  disabled,
  loading: isLoading,
}: {
  onPress: () => void;
  title: string;
  variant?: "primary" | "secondary" | "destructive";
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isPrimary = variant === "primary";
  const isDestructive = variant === "destructive";
  const content = (
    <>
      {icon && (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={isDestructive ? "#FF4444" : isPrimary ? "#FFFFFF" : "#9A9A9A"}
          style={{ marginRight: 8 }}
        />
      )}
      {isLoading ? (
        <ActivityIndicator color={isDestructive ? "#FF4444" : "#FFFFFF"} />
      ) : (
        <Text
          style={[
            s.buttonText,
            !isPrimary && !isDestructive && s.secondaryButtonText,
            isDestructive && s.destructiveButtonText,
          ]}
        >
          {title}
        </Text>
      )}
    </>
  );

  if (isDestructive) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || isLoading}
        activeOpacity={0.7}
        style={[s.destructiveButton, disabled && s.disabledButton]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
      style={[
        isPrimary ? s.primaryButton : s.secondaryBtn,
        disabled && s.disabledButton,
      ]}
    >
      {content}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function NoteDetailScreen() {
  const { noteId, projectId } = useLocalSearchParams();
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const showSkeleton = useDelayedLoading(loading);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadNote();
  }, [noteId]);

  useFocusEffect(
    React.useCallback(() => {
      if (noteId) loadNote();
    }, [noteId]),
  );

  const loadNote = async () => {
    try {
      setLoading(true);
      const noteData = await noteService.getNote(noteId as string);
      setNote(noteData);
    } catch (error) {
      console.error("Error loading note:", error);
      showAlert("Error", "Failed to load note details", [
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

  const handleDelete = () => setShowDeleteModal(true);

  const confirmDelete = async () => {
    try {
      setIsDeleting(true);
      await noteService.deleteNote(noteId as string);
      setShowDeleteModal(false);
      showAlert("Deleted", "Note has been deleted.", [
        {
          text: "OK",
          onPress: () => {
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
      showAlert("Error", message);
    } finally {
      setIsDeleting(false);
    }
  };

  const stackScreenOpts = {
    headerTransparent: isIOS,
    headerBlurEffect: isIOS ? ("systemChromeMaterial" as const) : undefined,
    headerStyle: isIOS ? {} : { backgroundColor: "#111111" },
    headerTintColor: "#FF2A2A",
    headerTitleStyle: { color: "#F5F5F5", fontWeight: "600" as const },
    headerBackTitle: "Project",
    headerShown: true,
    presentation: "card" as const,
  };

  if (showSkeleton) {
    return (
      <View style={s.container}>
        <Stack.Screen options={{ title: "Note Details", ...stackScreenOpts }} />
        <NoteDetailSkeleton />
      </View>
    );
  }

  if (!note) {
    return (
      <View style={s.container}>
        <Stack.Screen options={{ title: "Note Not Found", ...stackScreenOpts }} />
        <View style={s.centerContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF2A2A" />
          <Text style={s.errorText}>Note not found</Text>
          <GlassButton
            onPress={() => router.back()}
            title="Back to Project"
            variant="primary"
            icon="arrow-back"
          />
        </View>
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
    <View style={s.container}>
      <Stack.Screen
        options={{
          title: note.title,
          ...stackScreenOpts,
          headerRight: () => (
            <View style={s.headerButtons}>
              <TouchableOpacity onPress={handleEdit} style={s.headerButton}>
                <Ionicons name="create-outline" size={22} color="#FF2A2A" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={s.headerButton}>
                <Ionicons name="trash-outline" size={22} color="#FF4444" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Header icon */}
        <View style={s.headerIcon}>
          <Ionicons
            name={isAudioNote ? "mic" : "document-text"}
            size={48}
            color="#FF2A2A"
          />
        </View>
        <Text style={s.title}>{note.title}</Text>
        <Text style={s.subtitle}>
          Created {new Date(note.created_at).toLocaleDateString()}
          {note.updated_at !== note.created_at &&
            `  ·  Updated ${new Date(note.updated_at).toLocaleDateString()}`}
        </Text>

        {/* Content / Voice note card */}
        {isAudioNote ? (
          <GlassCard style={s.card}>
            <Text style={s.label}>
              <Ionicons name="mic" size={14} color="#9A9A9A" /> Voice Note
            </Text>
            {(note?.attachments || [])
              .filter((a: any) =>
                (a.mime_type || a.file_type)?.startsWith("audio/"),
              )
              .map((att: any) => (
                <View key={att.id} style={{ marginTop: 8 }}>
                  <AudioAttachmentPlayer url={att.url} />
                </View>
              ))}
          </GlassCard>
        ) : (
          <GlassCard style={s.card}>
            <Text style={s.label}>
              <Ionicons name="document-text" size={14} color="#9A9A9A" />{" "}
              Content
            </Text>
            <Text style={s.noteContent}>{note.content}</Text>
          </GlassCard>
        )}

        {/* Attachments card */}
        {note.attachments &&
          note.attachments.length > 0 &&
          (() => {
            const nonAudio = note.attachments!.filter(
              (a: any) => !(a.mime_type || a.file_type)?.startsWith("audio/"),
            );
            if (isAudioNote && nonAudio.length === 0) return null;
            return (
              <GlassCard style={s.card}>
                <Text style={s.label}>
                  <Ionicons name="attach" size={14} color="#9A9A9A" />{" "}
                  Attachments
                  <Text style={s.countBadge}> ({nonAudio.length})</Text>
                </Text>
                <View style={{ gap: 8, marginTop: 4 }}>
                  {nonAudio.map((att: any) => (
                    <View key={att.id} style={s.fileRow}>
                      <Ionicons name="document" size={18} color="#9A9A9A" />
                      <Text style={s.fileRowText} numberOfLines={1}>
                        {att.filename}
                      </Text>
                    </View>
                  ))}
                </View>
              </GlassCard>
            );
          })()}

        {/* Action buttons */}
        <View style={s.buttonContainer}>
          <GlassButton
            onPress={handleEdit}
            title="Edit Note"
            variant="primary"
            icon="create"
          />
          <GlassButton
            onPress={handleDelete}
            title="Delete Note"
            variant="destructive"
            icon="trash"
          />
        </View>
      </ScrollView>

      {/* Delete confirmation modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={s.modalBackdrop}>
          <GlassCard style={s.modalContent}>
            <Text style={s.modalTitle}>Delete Note</Text>
            <Text style={s.modalText}>
              This will permanently delete this note and its attachments. This
              action cannot be undone.
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <GlassButton
                onPress={() => setShowDeleteModal(false)}
                title="Cancel"
                variant="secondary"
                disabled={isDeleting}
              />
              <GlassButton
                onPress={confirmDelete}
                title={isDeleting ? "Deleting..." : "Delete"}
                variant="destructive"
                icon="trash"
                disabled={isDeleting}
                loading={isDeleting}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Audio player (web)
// ---------------------------------------------------------------------------
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
    if (ctxRef.current) return;
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
            borderRadius: 12,
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
          <Ionicons name="play-circle" size={32} color="#FF2A2A" />
          <Text style={{ color: "#F5F5F5", fontWeight: "600", marginTop: 4 }}>
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
          backgroundColor: "rgba(255,255,255,0.03)",
          borderRadius: 12,
        }}
      />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles — matching new-project / join-project design language
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111111" },
  scrollView: { flex: 1 },
  content: { padding: 24, paddingTop: 24, paddingBottom: 48 },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  loadingText: { fontSize: 16, color: "#9A9A9A", marginTop: 16 },
  errorText: { fontSize: 18, color: "#F5F5F5", fontWeight: "600" },
  // Header
  headerIcon: { alignItems: "center", marginBottom: 16, marginTop: 16 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#9A9A9A",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerButton: {
    padding: 6,
  },
  // Cards
  card: { marginBottom: 16 },
  glassCard: { borderRadius: 20, padding: 20, overflow: "hidden" },
  blurCard: {
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  solidCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  label: { fontSize: 14, fontWeight: "600", color: "#9A9A9A", marginBottom: 12 },
  countBadge: { fontWeight: "400", color: "#666" },
  noteContent: {
    fontSize: 16,
    color: "#F5F5F5",
    lineHeight: 26,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  fileRowText: { flex: 1, color: "#F5F5F5", fontSize: 14 },
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
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  destructiveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 68, 68, 0.1)",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 68, 68, 0.3)",
  },
  disabledButton: { opacity: 0.5 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  secondaryButtonText: { color: "#9A9A9A" },
  destructiveButtonText: { color: "#FF4444", fontSize: 16, fontWeight: "600" },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: { width: "100%", maxWidth: 420 },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 8,
  },
  modalText: { fontSize: 14, color: "#9A9A9A", lineHeight: 20 },
});

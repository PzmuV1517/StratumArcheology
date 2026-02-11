import React, { useEffect, useRef, useState, useCallback } from "react";
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
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../src/utils/alert";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { noteService } from "../src/services/noteService";
import { useAutoSave } from "../src/hooks/useAutoSave";

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
  return <View style={[styles.solidCard, style]}>{children}</View>;
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
  variant?: "primary" | "secondary";
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isPrimary = variant === "primary";
  const content = (
    <>
      {icon && (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={isPrimary ? "#FFFFFF" : "#9A9A9A"}
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
// Lazy import expo-av only on native/mobile to avoid bundler issues on web if unavailable
let Audio: any = null;
let Sound: any = null;
if (Platform.OS !== "web") {
  try {
    const av = require("expo-av");
    Audio = av.Audio;
    Sound = av.Audio?.Sound;
  } catch {}
}

export default function CreateNoteScreen() {
  const { projectId } = useLocalSearchParams();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const iosHeaderPad =
    Platform.OS === "ios"
      ? Math.max(headerHeight || 0, (insets.top || 0) + 44) + 8
      : 0;
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [isVoiceNote, setIsVoiceNote] = useState(false);
  const [recording, setRecording] = useState<any>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [meterLevel, setMeterLevel] = useState(-160);
  const meterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);

  // Auto-save hook for draft recovery
  const {
    saveStatus,
    wasRestored,
    saveDraft,
    clearDraft,
    hasDraft,
    getDraft,
    markSubmitted,
    scheduleAutoSave,
  } = useAutoSave<{ title: string; content: string; isVoiceNote: boolean }>({
    formId: `create-note-${projectId}`,
    initialData: { title: "", content: "", isVoiceNote: false },
    onRestore: (draft) => {
      setTitle(draft.title);
      setContent(draft.content);
      setIsVoiceNote(draft.isVoiceNote);
    },
    skipRestore: true, // We'll handle restore manually with a modal
  });

  // Check for existing draft on mount
  useEffect(() => {
    const checkDraft = async () => {
      const exists = await hasDraft();
      if (exists) {
        setShowDraftModal(true);
      }
    };
    checkDraft();
  }, []);

  // Auto-save when form data changes
  useEffect(() => {
    if (title || content) {
      scheduleAutoSave({ title, content, isVoiceNote });
    }
  }, [title, content, isVoiceNote]);

  const handleRestoreDraft = async () => {
    const draft = await getDraft();
    if (draft) {
      setTitle(draft.title);
      setContent(draft.content);
      setIsVoiceNote(draft.isVoiceNote);
    }
    setShowDraftModal(false);
  };

  const handleDiscardDraft = async () => {
    await clearDraft();
    setShowDraftModal(false);
  };

  const startRecording = async () => {
    try {
      setRecordingError(null);
      if (Platform.OS === "web") {
        if (!navigator.mediaDevices) {
          setRecordingError("MediaDevices unavailable");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLiveStream(stream);
        const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaChunksRef.current = [];
        mr.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) mediaChunksRef.current.push(ev.data);
        };
        mr.start();
        setRecording(mr);
        setIsRecording(true);
      } else {
        if (!Audio) {
          setRecordingError("Audio module unavailable");
          return;
        }
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) {
          setRecordingError("Microphone permission denied");
          return;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        // Create recording with metering enabled
        const recordingOptions = {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        };
        const result = await Audio.Recording.createAsync(recordingOptions);
        setRecording(result.recording);
        setIsRecording(true);

        // Start polling for metering levels
        meterIntervalRef.current = setInterval(async () => {
          try {
            const status = await result.recording.getStatusAsync();
            if (status.isRecording && status.metering !== undefined) {
              setMeterLevel(status.metering);
            }
          } catch (err) {
            // Recording may have stopped
          }
        }, 100);
      }
    } catch (e: any) {
      console.error("Start recording failed", e);
      setRecordingError("Failed to start recording");
    }
  };

  const stopRecording = async () => {
    try {
      // Clear metering interval first
      if (meterIntervalRef.current) {
        clearInterval(meterIntervalRef.current);
        meterIntervalRef.current = null;
      }
      setMeterLevel(-160);

      if (!recording) return;
      if (Platform.OS === "web") {
        const mr: MediaRecorder = recording;
        if (mr.state !== "inactive") mr.stop();
        setIsRecording(false);
        setTimeout(() => {
          const blob = new Blob(mediaChunksRef.current, { type: "audio/webm" });
          const url = URL.createObjectURL(blob);
          setRecordedUri(url);
          setRecording(null);
          if (liveStream) {
            liveStream.getTracks().forEach((t) => t.stop());
            setLiveStream(null);
          }
        }, 200);
      } else {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecordedUri(uri);
        setRecording(null);
        setIsRecording(false);
      }
    } catch (e: any) {
      console.error("Stop recording failed", e);
      setRecordingError("Failed to stop recording");
    }
  };

  const resetRecording = () => {
    // Clear metering interval
    if (meterIntervalRef.current) {
      clearInterval(meterIntervalRef.current);
      meterIntervalRef.current = null;
    }
    setMeterLevel(-160);

    if (Platform.OS === "web" && recordedUri) {
      try {
        URL.revokeObjectURL(recordedUri);
      } catch {}
    }
    if (liveStream) {
      liveStream.getTracks().forEach((t) => t.stop());
      setLiveStream(null);
    }
    setRecording(null);
    setRecordedUri(null);
    setRecordingError(null);
    setIsRecording(false);
  };

  const navigateBackToNotes = useCallback(() => {
    const dest = {
      pathname: "/project/[id]",
      params: { id: String(projectId), tab: "notes" },
    };
    router.replace(dest as any);
    // web sometimes needs a push to refresh list
    setTimeout(() => {
      try {
        router.push(dest as any);
      } catch {}
    }, 10);
  }, [projectId]);

  const handleCreate = async () => {
    if (!title.trim()) {
      showAlert("Error", "Title required");
      return;
    }
    if (!isVoiceNote && !content.trim()) {
      showAlert("Error", "Content required");
      return;
    }
    if (isVoiceNote && isRecording) {
      showAlert("Finish recording", "Finish creating audio before saving");
      return;
    }
    if (isVoiceNote && !recordedUri) {
      showAlert("Error", "Record audio before saving");
      return;
    }

    setLoading(true);
    try {
      const note = await noteService.createNote({
        title: title.trim(),
        content: isVoiceNote ? "" : content.trim(),
        project_id: projectId as string,
        is_voice: isVoiceNote,
      });
      if (isVoiceNote && recordedUri) {
        try {
          const safeBase = (title.trim() || "audio").replace(
            /[^a-z0-9_\-\.]/gi,
            "_",
          );
          if (Platform.OS === "web") {
            const response = await fetch(recordedUri);
            const blob = await response.blob();
            const uploadAudioBlob = noteService.uploadAudioBlob;
            if (!uploadAudioBlob) {
              throw new Error("Audio upload is unavailable on web");
            }
            await uploadAudioBlob(note.id, blob, `${safeBase}.webm`);
          } else {
            await noteService.uploadAudio(note.id, recordedUri, `${safeBase}.m4a`);
          }
        } catch (e) {
          console.error("Audio upload failed", e);
          showAlert("Warning", "Note saved but audio upload failed");
        }
      }
      // Clear the draft after successful creation
      await markSubmitted();
      // Navigate back first, then show alert (better UX on mobile)
      // On web, we also navigate immediately to prevent duplicate submissions
      navigateBackToNotes();
      // Small delay before showing success alert so navigation happens first
      setTimeout(
        () => {
          showAlert("Success", "Note created successfully!");
        },
        Platform.OS === "web" ? 300 : 100,
      );
    } catch (error: any) {
      console.error("Failed to create note:", error);
      const message =
        error?.detail ||
        error?.message ||
        "Failed to create note. Please try again.";
      showAlert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Create Note",
          headerTransparent: isIOS,
          headerBlurEffect: isIOS ? "systemChromeMaterial" : undefined,
          headerStyle: isIOS ? {} : { backgroundColor: "#111111" },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: {
            color: "#F5F5F5",
            fontWeight: "600",
          },
          headerBackTitle: "Project",
          headerShown: true,
        }}
      />

      {/* Draft Recovery Modal */}
      <Modal
        visible={showDraftModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDraftModal(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalContent}>
            <Text style={styles.modalTitle}>Restore Draft?</Text>
            <Text style={styles.modalText}>
              You have an unsaved draft from a previous session. Would you like to
              restore it?
            </Text>
            <View style={styles.modalButtons}>
              <GlassButton
                onPress={handleDiscardDraft}
                title="Discard"
                variant="secondary"
              />
              <GlassButton
                onPress={handleRestoreDraft}
                title="Restore"
                variant="primary"
                icon="refresh"
              />
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Auto-save status indicator */}
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
        style={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header icon */}
        <View style={styles.headerIcon}>
          <Ionicons name="create" size={48} color="#FF2A2A" />
        </View>
        <Text style={styles.title}>Create New Note</Text>
        <Text style={styles.subtitle}>Add a text or voice note to your project</Text>

        {/* Title card */}
        <GlassCard style={styles.card}>
          <Text style={styles.label}>
            <Ionicons name="text" size={14} color="#9A9A9A" /> Title
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter note title"
            placeholderTextColor="#555"
            value={title}
            onChangeText={setTitle}
          />
        </GlassCard>

        {/* Note type toggle */}
        <GlassCard style={styles.card}>
          <Text style={styles.label}>
            <Ionicons name="options" size={14} color="#9A9A9A" /> Note Type
          </Text>
          <TouchableOpacity
            style={[styles.toggleButton, isVoiceNote && styles.toggleActive]}
            onPress={() => {
              setIsVoiceNote((v) => !v);
              if (!isVoiceNote) setContent("");
              else resetRecording();
            }}
            disabled={loading}
          >
            <Ionicons
              name={isVoiceNote ? "mic" : "mic-off"}
              size={18}
              color={isVoiceNote ? "#FF2A2A" : "#9A9A9A"}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.toggleText, isVoiceNote && { color: "#FF2A2A" }]}>
              {isVoiceNote ? "Voice Note Enabled" : "Voice Note: OFF"}
            </Text>
          </TouchableOpacity>
        </GlassCard>

        {/* Content card (text mode) */}
        {!isVoiceNote && (
          <GlassCard style={styles.card}>
            <Text style={styles.label}>
              <Ionicons name="document-text" size={14} color="#9A9A9A" /> Content
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your archaeological findings, observations, or thoughts..."
              placeholderTextColor="#555"
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={10}
              textAlignVertical="top"
            />
          </GlassCard>
        )}

        {/* Voice recording card */}
        {isVoiceNote && (
          <GlassCard style={styles.card}>
            <Text style={styles.label}>
              <Ionicons name="mic" size={14} color="#9A9A9A" /> Voice Recording
            </Text>
            {Platform.OS === "web" && (
              <LiveWaveform stream={liveStream} isRecording={isRecording} />
            )}
            {Platform.OS !== "web" && (
              <NativeLevelBar active={isRecording} meterLevel={meterLevel} />
            )}
            {recording ? (
              <TouchableOpacity
                style={[styles.recButton, styles.stop]}
                onPress={stopRecording}
                disabled={loading}
              >
                <Ionicons
                  name="stop-circle"
                  size={20}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.recButtonText}>Stop Recording</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.recButton,
                  recordedUri ? styles.reRecord : styles.start,
                ]}
                onPress={startRecording}
                disabled={loading}
              >
                <Ionicons
                  name={recordedUri ? "refresh" : "mic"}
                  size={20}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.recButtonText}>
                  {recordedUri ? "Re-record" : "Start Recording"}
                </Text>
              </TouchableOpacity>
            )}
            {recordedUri && !recording && (
              <>
                <View style={styles.recordedRow}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  <Text style={styles.recInfo}>Recorded file ready to upload</Text>
                </View>
                {Platform.OS === "web" ? (
                  <audio
                    src={recordedUri}
                    controls
                    style={{ width: "100%", marginBottom: 8 }}
                  />
                ) : (
                  <NativeAudioPreview uri={recordedUri} />
                )}
                <TouchableOpacity
                  style={styles.clearAudio}
                  onPress={resetRecording}
                  disabled={loading}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color="#FF4444"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.clearAudioText}>Remove Audio</Text>
                </TouchableOpacity>
              </>
            )}
            {recordingError && (
              <Text style={styles.errorText}>{recordingError}</Text>
            )}
          </GlassCard>
        )}

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          <GlassButton
            onPress={handleCreate}
            title="Create Note"
            variant="primary"
            icon="checkmark-circle"
            disabled={loading}
            loading={loading}
          />
          <GlassButton
            onPress={() => router.back()}
            title="Cancel"
            variant="secondary"
            disabled={loading}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// Live waveform (web)
function LiveWaveform({
  stream,
  isRecording,
}: {
  stream: MediaStream | null;
  isRecording: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const acRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  useEffect(() => {
    if (!stream || !isRecording || !canvasRef.current) return;
    const ac = new AudioContext();
    acRef.current = ac;
    const src = ac.createMediaStreamSource(stream);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.fftSize);
    const ctx = canvasRef.current.getContext("2d")!;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(data);
      ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      ctx.strokeStyle = "#FF2A2A";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const slice = canvasRef.current!.width / data.length;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0 - 1.0;
        const y =
          (v * canvasRef.current!.height) / 2 + canvasRef.current!.height / 2;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * slice, y);
      }
      ctx.stroke();
    };
    draw();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      try {
        ac.close();
      } catch {}
    };
  }, [stream, isRecording]);
  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={120}
      style={{
        width: "100%",
        height: 120,
        backgroundColor: "#111",
        borderRadius: 8,
        marginBottom: 12,
      }}
    />
  );
}

// Native simple level bar placeholder
function NativeLevelBar({
  active,
  meterLevel,
}: {
  active: boolean;
  meterLevel: number;
}) {
  // meterLevel is typically in dBFS, range roughly -160 (silence) to 0 (max)
  // Convert to a percentage (0-100) for display
  const normalizedLevel = active
    ? Math.max(0, Math.min(100, ((meterLevel + 60) / 60) * 100))
    : 0;

  return (
    <View style={{ height: 40, marginBottom: 12, justifyContent: "center" }}>
      <View
        style={{
          height: 12,
          backgroundColor: "#2A2A2A",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${normalizedLevel}%`,
            height: 12,
            backgroundColor: normalizedLevel > 80 ? "#FF4444" : "#FF2A2A",
            borderRadius: 6,
          }}
        />
      </View>
      {active && (
        <Text
          style={{
            color: "#9A9A9A",
            fontSize: 11,
            marginTop: 4,
            textAlign: "center",
          }}
        >
          Listening... speak now
        </Text>
      )}
    </View>
  );
}

// Native audio preview player for recorded audio
function NativeAudioPreview({ uri }: { uri: string }) {
  const soundRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  const formatTime = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  const playAudio = useCallback(async () => {
    if (!uri || !Audio) return;
    try {
      setIsLoading(true);
      // Unload previous sound if exists
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      // Create and play new sound from local file URI
      const { sound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (playbackStatus: any) => {
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
      console.error("Failed to play preview audio:", e);
      setIsLoading(false);
      showAlert("Error", "Failed to play recording preview");
    }
  }, [uri]);

  const pauseAudio = useCallback(async () => {
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

  return (
    <View style={previewStyles.container}>
      <TouchableOpacity
        style={previewStyles.playBtn}
        onPress={isPlaying ? pauseAudio : playAudio}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FF2A2A" />
        ) : (
          <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="#FF2A2A" />
        )}
      </TouchableOpacity>
      <View style={previewStyles.progress}>
        <View
          style={[
            previewStyles.progressBar,
            { width: duration > 0 ? `${(position / duration) * 100}%` : "0%" },
          ]}
        />
      </View>
      <Text style={previewStyles.time}>
        {formatTime(position)} / {formatTime(duration)}
      </Text>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FF2A2A",
  },
  playIcon: {
    color: "#FF2A2A",
    fontSize: 18,
  },
  progress: {
    flex: 1,
    height: 6,
    backgroundColor: "#333",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#FF2A2A",
  },
  time: {
    color: "#9A9A9A",
    fontSize: 12,
    minWidth: 80,
    textAlign: "right",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
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
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9A9A9A",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  textArea: {
    height: 200,
    textAlignVertical: "top",
  },
  // Toggle
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  toggleActive: {
    borderColor: "rgba(255, 42, 42, 0.4)",
    backgroundColor: "rgba(255, 42, 42, 0.08)",
  },
  toggleText: {
    color: "#F5F5F5",
    fontWeight: "600",
    fontSize: 14,
  },
  // Voice
  recButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  start: { backgroundColor: "#FF2A2A" },
  stop: { backgroundColor: "#FF4444" },
  reRecord: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#FF2A2A",
  },
  recButtonText: { color: "#F5F5F5", fontWeight: "600", fontSize: 14 },
  recordedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  recInfo: { color: "#9A9A9A", fontSize: 13 },
  clearAudio: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 68, 68, 0.3)",
  },
  clearAudioText: { color: "#FF4444", fontSize: 13, fontWeight: "600" },
  errorText: { color: "#FF5555", fontSize: 12, marginTop: 4 },
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
  },
  disabledButton: { opacity: 0.5 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  secondaryButtonText: { color: "#9A9A9A" },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    maxWidth: 420,
    width: "100%",
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
  // Save status bar
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
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  saveStatusText: {
    color: "#9A9A9A",
    fontSize: 12,
    textAlign: "center",
  },
});

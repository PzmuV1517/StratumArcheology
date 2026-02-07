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
import { showAlert } from "../src/utils/alert";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { noteService } from "../src/services/noteService";
import { useAutoSave } from "../src/hooks/useAutoSave";
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
          headerTransparent: Platform.OS === "ios",
          headerBlurEffect: Platform.OS === "ios" ? "systemChromeMaterial" : undefined,
          headerStyle: Platform.OS === "ios" ? {} : { backgroundColor: "#111111" },
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

      {/* Draft Recovery Modal */}
      <Modal
        visible={showDraftModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDraftModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Restore Draft?</Text>
            <Text style={styles.modalText}>
              You have an unsaved draft from a previous session. Would you like to
              restore it?
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

      {/* Auto-save status indicator */}
      {saveStatus !== "idle" && (
        <View
          style={[
            styles.saveStatusBar,
            Platform.OS === "ios"
              ? { top: Math.max(headerHeight || 0, (insets.top || 0) + 44) }
              : null,
          ]}
        >
          <Text style={styles.saveStatusText}>
            {saveStatus === "saving"
              ? "💾 Saving draft..."
              : saveStatus === "saved"
                ? "✓ Draft saved"
                : saveStatus === "error"
                  ? "⚠ Save failed"
                  : ""}
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingTop: iosHeaderPad,
        }}
      >
        <View style={styles.form}>
          <Text style={styles.pageTitle}>Create New Note</Text>

          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter note title"
            placeholderTextColor="#666"
            value={title}
            onChangeText={setTitle}
          />

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleButton, isVoiceNote && styles.toggleActive]}
              onPress={() => {
                setIsVoiceNote((v) => !v);
                if (!isVoiceNote) setContent("");
                else resetRecording();
              }}
              disabled={loading}
            >
              <Text style={styles.toggleText}>
                {isVoiceNote ? "Voice Note Enabled" : "Voice Note: OFF"}
              </Text>
            </TouchableOpacity>
          </View>

          {!isVoiceNote && (
            <>
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
            </>
          )}

          {isVoiceNote && (
            <View style={styles.voiceContainer}>
              <Text style={styles.label}>Voice Recording</Text>
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
                  <Text style={styles.recButtonText}>
                    {recordedUri ? "Re-record" : "Start Recording"}
                  </Text>
                </TouchableOpacity>
              )}
              {recordedUri && !recording && (
                <>
                  <Text style={styles.recInfo}>Recorded file ready to upload</Text>
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
                    <Text style={styles.clearAudioText}>Remove Audio</Text>
                  </TouchableOpacity>
                </>
              )}
              {recordingError && (
                <Text style={styles.errorText}>{recordingError}</Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#F5F5F5" />
            ) : (
              <Text style={styles.buttonText}>Create Note</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
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
        }
      );
      soundRef.current = sound;
      setIsLoading(false);
    } catch (e) {
      console.error("Failed to play preview audio:", e);
      setIsLoading(false);
      showAlert("Error", "Failed to play recording preview");
    }
  }, [uri]);

  const stopAudio = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      setIsPlaying(false);
      setPosition(0);
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
        onPress={isPlaying ? stopAudio : playAudio}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FF2A2A" />
        ) : (
          <Text style={previewStyles.playIcon}>{isPlaying ? "⏹" : "▶"}</Text>
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
  toggleRow: { marginBottom: 24 },
  toggleButton: {
    backgroundColor: "#1E1E1E",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  toggleActive: { borderColor: "#FF2A2A", backgroundColor: "#2A2A2A" },
  toggleText: {
    color: "#F5F5F5",
    fontWeight: "600",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  voiceContainer: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333",
  },
  recButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  start: { backgroundColor: "#FF2A2A" },
  stop: { backgroundColor: "#FF4444" },
  reRecord: { backgroundColor: "#2A2A2A", borderWidth: 1, borderColor: "#FF2A2A" },
  recButtonText: { color: "#F5F5F5", fontWeight: "600", fontSize: 14 },
  recInfo: { color: "#9A9A9A", fontSize: 12, marginBottom: 8 },
  clearAudio: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "#444",
  },
  clearAudioText: { color: "#CFCFCF", fontSize: 12 },
  errorText: { color: "#FF5555", fontSize: 12, marginTop: 4 },
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

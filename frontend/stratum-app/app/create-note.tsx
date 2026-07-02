/**
 * @file
 * Note creation screen.
 *
 * Provides a form for creating new text or voice notes
 * within an archaeological project.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { showAlert } from "@/utils/alert";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { noteService } from "@/services/noteService";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useColorScheme } from "@/hooks/use-color-scheme";

const isIOS = Platform.OS === "ios";

// ---------------------------------------------------------------------------
// Shared UI components (matching new-project / join-project)
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
  secondaryTextColor,
}: {
  onPress: () => void;
  title: string;
  variant?: "primary" | "secondary";
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  styles: ReturnType<typeof createStyles>;
  secondaryTextColor: string;
}) {
  const isPrimary = variant === "primary";
  const content = (
    <>
      {icon && (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={isPrimary ? "#FFFFFF" : secondaryTextColor}
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
let _Sound: any = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const av = require("expo-av");
    Audio = av.Audio;
    _Sound = av.Audio?.Sound;
  } catch {}
}

export default function CreateNoteScreen() {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const pageBackground = isDarkMode ? "#111111" : "#F7F7F7";
  const textPrimary = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const textSecondary = isDarkMode ? "#9A9A9A" : "#666666";
  const placeholderTextColor = isDarkMode ? "#555" : "#7A7A7A";

  const { projectId } = useLocalSearchParams();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const _iosHeaderPad =
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
  const [noiseWarning, setNoiseWarning] = useState(false);
  const noiseSamplesRef = useRef<number[]>([]);
  const [showDraftModal, setShowDraftModal] = useState(false);

  // Auto-save hook for draft recovery
  const {
    saveStatus,
    wasRestored: _wasRestored,
    saveDraft: _saveDraft,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save when form data changes
  useEffect(() => {
    if (title || content) {
      scheduleAutoSave({ title, content, isVoiceNote });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setNoiseWarning(false);
      noiseSamplesRef.current = [];
      if (Platform.OS === "web") {
        if (!navigator.mediaDevices) {
          setRecordingError("MediaDevices unavailable");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLiveStream(stream);

        // Sample RMS for ~1.5s to detect background noise floor
        const noiseCtx = new AudioContext();
        const src = noiseCtx.createMediaStreamSource(stream);
        const analyser = noiseCtx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        const noiseTimer = setInterval(() => {
          analyser.getFloatTimeDomainData(buf);
          const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
          noiseSamplesRef.current.push(rms);
          if (noiseSamplesRef.current.length >= 8) {
            clearInterval(noiseTimer);
            noiseCtx.close();
            const floor = [...noiseSamplesRef.current].sort((a, b) => a - b)[1]; // 2nd lowest
            if (floor > 0.08) setNoiseWarning(true);
          }
        }, 200);

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

        // Start polling for metering levels + noise floor detection
        meterIntervalRef.current = setInterval(async () => {
          try {
            const status = await result.recording.getStatusAsync();
            if (status.isRecording && status.metering !== undefined) {
              setMeterLevel(status.metering);
              const samples = noiseSamplesRef.current;
              if (samples.length < 15) {
                samples.push(status.metering);
                if (samples.length === 15) {
                  const floor = [...samples].sort((a, b) => a - b)[2]; // 3rd lowest dBFS
                  if (floor > -40) setNoiseWarning(true);
                }
              }
            }
          } catch (_err) {
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
      noiseSamplesRef.current = [];

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          headerStyle: isIOS ? {} : { backgroundColor: pageBackground },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: {
            color: textPrimary,
            fontWeight: "600",
          },
          headerBackTitle: "Project",
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingLeft: Platform.OS === "ios" ? 0 : 8,
                paddingRight: 16,
              }}
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={22} color="#FF2A2A" />
              {Platform.OS === "ios" && (
                <Text style={{ color: "#FF2A2A", fontSize: 17, marginLeft: 4 }}>
                  Project
                </Text>
              )}
            </TouchableOpacity>
          ),
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
          <GlassCard style={styles.modalContent} styles={styles}>
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
                styles={styles}
                secondaryTextColor={textSecondary}
              />
              <GlassButton
                onPress={handleRestoreDraft}
                title="Restore"
                variant="primary"
                icon="refresh"
                styles={styles}
                secondaryTextColor={textSecondary}
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

        {/* Note type toggle */}
        <GlassCard style={styles.card} styles={styles}>
          <Text style={styles.label}>
            <Ionicons name="options" size={14} color={textSecondary} /> Note Type
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
              color={isVoiceNote ? "#FF2A2A" : textSecondary}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.toggleText, isVoiceNote && { color: "#FF2A2A" }]}>
              {isVoiceNote ? "Voice Note Enabled" : "Voice Note: OFF"}
            </Text>
          </TouchableOpacity>
        </GlassCard>

        {/* Content card (text mode) */}
        {!isVoiceNote && (
          <GlassCard style={styles.card} styles={styles}>
            <Text style={styles.label}>
              <Ionicons name="document-text" size={14} color={textSecondary} />{" "}
              Content
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
        )}

        {/* Voice recording card */}
        {isVoiceNote && (
          <GlassCard style={styles.card} styles={styles}>
            <Text style={styles.label}>
              <Ionicons name="mic" size={14} color={textSecondary} /> Voice Recording
            </Text>
            {Platform.OS === "web" && (
              <LiveWaveform
                stream={liveStream}
                isRecording={isRecording}
                isDarkMode={isDarkMode}
              />
            )}
            {Platform.OS !== "web" && (
              <NativeLevelBar
                active={isRecording}
                meterLevel={meterLevel}
                isDarkMode={isDarkMode}
              />
            )}
            {noiseWarning && (
              <View style={styles.noiseWarning}>
                <Ionicons name="warning-outline" size={15} color="#B45309" />
                <Text style={styles.noiseWarningText}>
                  High background noise detected — transcription may be less
                  accurate. Try recording in a quieter spot.
                </Text>
              </View>
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
                  <NativeAudioPreview uri={recordedUri} isDarkMode={isDarkMode} />
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
            styles={styles}
            secondaryTextColor={textSecondary}
          />
          <GlassButton
            onPress={() => router.back()}
            title="Cancel"
            variant="secondary"
            disabled={loading}
            styles={styles}
            secondaryTextColor={textSecondary}
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
  isDarkMode,
}: {
  stream: MediaStream | null;
  isRecording: boolean;
  isDarkMode: boolean;
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
      if (!canvasRef.current) return;
      raf = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(data);
      const w = canvasRef.current.width;
      const h = canvasRef.current.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "#FF2A2A";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const slice = w / data.length;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0 - 1.0;
        const y = (v * h) / 2 + h / 2;
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
        backgroundColor: isDarkMode ? "#111" : "#F0F0F0",
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
  isDarkMode,
}: {
  active: boolean;
  meterLevel: number;
  isDarkMode: boolean;
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
          backgroundColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
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
            color: isDarkMode ? "#9A9A9A" : "#666666",
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
function NativeAudioPreview({
  uri,
  isDarkMode,
}: {
  uri: string;
  isDarkMode: boolean;
}) {
  const previewStyles = useMemo(() => createPreviewStyles(isDarkMode), [isDarkMode]);
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
      const { sound, status: _status } = await Audio.Sound.createAsync(
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

const createPreviewStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      gap: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    playBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDarkMode ? "#2A2A2A" : "#F1F1F1",
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
      backgroundColor: isDarkMode ? "#333" : "#D9D9D9",
      borderRadius: 3,
      overflow: "hidden",
    },
    progressBar: {
      height: "100%",
      backgroundColor: "#FF2A2A",
    },
    time: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontSize: 12,
      minWidth: 80,
      textAlign: "right",
    },
  });

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
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
    // Toggle
    toggleButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.05)" : "#F1F1F1",
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "#D9D9D9",
    },
    toggleActive: {
      borderColor: "rgba(255, 42, 42, 0.4)",
      backgroundColor: "rgba(255, 42, 42, 0.08)",
    },
    toggleText: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
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
    recInfo: { color: isDarkMode ? "#9A9A9A" : "#666666", fontSize: 13 },
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
    noiseWarning: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      backgroundColor: isDarkMode ? "#2A1F0A" : "#FEF3C7",
      borderRadius: 8,
      padding: 10,
      marginTop: 8,
    },
    noiseWarningText: {
      flex: 1,
      color: "#B45309",
      fontSize: 13,
      lineHeight: 18,
    },
  });

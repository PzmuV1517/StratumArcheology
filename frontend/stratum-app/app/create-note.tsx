import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { noteService } from '../src/services/noteService';
import { Platform } from 'react-native';
// Lazy import expo-av only on native/mobile to avoid bundler issues on web if unavailable
let Audio: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Audio = require('expo-av').Audio;
  } catch {}
}

export default function CreateNoteScreen() {
  const { projectId } = useLocalSearchParams();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVoiceNote, setIsVoiceNote] = useState(false);
  const [recording, setRecording] = useState<any>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      setRecordingError(null);
      if (Platform.OS === 'web') {
        if (!navigator.mediaDevices) {
          setRecordingError('MediaDevices unavailable');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLiveStream(stream);
        const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaChunksRef.current = [];
        mr.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) mediaChunksRef.current.push(ev.data);
        };
        mr.start();
        setRecording(mr);
        setIsRecording(true);
      } else {
        if (!Audio) {
          setRecordingError('Audio module unavailable');
          return;
        }
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) {
          setRecordingError('Microphone permission denied');
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const result = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(result.recording);
        setIsRecording(true);
      }
    } catch (e: any) {
      console.error('Start recording failed', e);
      setRecordingError('Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      if (Platform.OS === 'web') {
        const mr: MediaRecorder = recording;
        if (mr.state !== 'inactive') mr.stop();
        setIsRecording(false);
        setTimeout(() => {
          const blob = new Blob(mediaChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setRecordedUri(url);
          setRecording(null);
          if (liveStream) {
            liveStream.getTracks().forEach(t => t.stop());
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
      console.error('Stop recording failed', e);
      setRecordingError('Failed to stop recording');
    }
  };

  const resetRecording = () => {
    if (Platform.OS === 'web' && recordedUri) {
      try { URL.revokeObjectURL(recordedUri); } catch {}
    }
    if (liveStream) {
      liveStream.getTracks().forEach(t => t.stop());
      setLiveStream(null);
    }
    setRecording(null);
    setRecordedUri(null);
    setRecordingError(null);
    setIsRecording(false);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title required');
      return;
    }
    if (!isVoiceNote && !content.trim()) {
      Alert.alert('Error', 'Content required');
      return;
    }
    if (isVoiceNote && !recordedUri) {
      Alert.alert('Error', 'Record audio before saving');
      return;
    }

    setLoading(true);
    try {
      const note = await noteService.createNote({
        title: title.trim(),
        content: isVoiceNote ? '' : content.trim(),
        project_id: projectId as string,
        is_voice: isVoiceNote
      });
      if (isVoiceNote && recordedUri) {
        try {
          if (Platform.OS === 'web') {
            const response = await fetch(recordedUri);
            const blob = await response.blob();
            await noteService.uploadAudioBlob(note.id, blob, 'voice-note.webm');
          } else {
            await noteService.uploadAudio(note.id, recordedUri);
          }
        } catch (e) {
          console.error('Audio upload failed', e);
          Alert.alert('Warning', 'Note saved but audio upload failed');
        }
      }
      router.replace({ pathname: '/project/[id]', params: { id: String(projectId), tab: 'notes' } });
    } catch (error) {
      console.error('Failed to create note:', error);
      Alert.alert('Error', 'Failed to create note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'Create Note',
          headerStyle: { backgroundColor: '#111111' },
          headerTintColor: '#FF2A2A',
          headerTitleStyle: { 
            color: '#F5F5F5',
            fontSize: 18,
            fontWeight: '600'
          },
          headerBackTitle: 'Project',
          headerShown: true,
        }} 
      />
      
      <ScrollView style={styles.content}>
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
                setIsVoiceNote(v => !v);
                if (!isVoiceNote) setContent('');
                else resetRecording();
              }}
              disabled={loading}
            >
              <Text style={styles.toggleText}>{isVoiceNote ? 'Voice Note Enabled' : 'Voice Note: OFF'}</Text>
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
              {Platform.OS === 'web' && <LiveWaveform stream={liveStream} isRecording={isRecording} />}
              {Platform.OS !== 'web' && <NativeLevelBar active={isRecording} />}
              {recording ? (
                <TouchableOpacity style={[styles.recButton, styles.stop]} onPress={stopRecording} disabled={loading}>
                  <Text style={styles.recButtonText}>Stop Recording</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.recButton, recordedUri ? styles.reRecord : styles.start]}
                  onPress={startRecording}
                  disabled={loading}
                >
                  <Text style={styles.recButtonText}>{recordedUri ? 'Re-record' : 'Start Recording'}</Text>
                </TouchableOpacity>
              )}
              {recordedUri && !recording && (
                <>
                  <Text style={styles.recInfo}>Recorded file ready to upload</Text>
                  {Platform.OS === 'web' ? <audio src={recordedUri} controls style={{ width: '100%', marginBottom: 8 }} /> : null}
                  <TouchableOpacity style={styles.clearAudio} onPress={resetRecording} disabled={loading}>
                    <Text style={styles.clearAudioText}>Remove Audio</Text>
                  </TouchableOpacity>
                </>
              )}
              {recordingError && <Text style={styles.errorText}>{recordingError}</Text>}
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
function LiveWaveform({ stream, isRecording }: { stream: MediaStream | null; isRecording: boolean }) {
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
    const ctx = canvasRef.current.getContext('2d')!;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(data);
      ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      ctx.strokeStyle = '#FF2A2A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const slice = canvasRef.current!.width / data.length;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0 - 1.0;
        const y = (v * canvasRef.current!.height) / 2 + canvasRef.current!.height / 2;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * slice, y);
      }
      ctx.stroke();
    };
    draw();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      try { ac.close(); } catch {}
    };
  }, [stream, isRecording]);
  return <canvas ref={canvasRef} width={800} height={120} style={{ width: '100%', height: 120, backgroundColor: '#111', borderRadius: 8, marginBottom: 12 }} />;
}

// Native simple level bar placeholder
function NativeLevelBar({ active }: { active: boolean }) {
  return (
    <View style={{ height: 40, marginBottom: 12, justifyContent: 'center' }}>
      <View style={{ height: 8, backgroundColor: '#2A2A2A', borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ width: active ? '80%' : '5%', height: 8, backgroundColor: '#FF2A2A' }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F5F5F5',
    marginBottom: 32,
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5F5F5',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#1E1E1E',
    color: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
    fontSize: 16,
  },
  textArea: {
    height: 200,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#FF2A2A',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#FF2A2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#F5F5F5',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    color: '#9A9A9A',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  toggleRow: { marginBottom: 24 },
  toggleButton: { backgroundColor: '#1E1E1E', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  toggleActive: { borderColor: '#FF2A2A', backgroundColor: '#2A2A2A' },
  toggleText: { color: '#F5F5F5', fontWeight: '600', fontSize: 14, letterSpacing: 0.3 },
  voiceContainer: { marginBottom: 24, padding: 16, borderRadius: 12, backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#333' },
  recButton: { padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  start: { backgroundColor: '#FF2A2A' },
  stop: { backgroundColor: '#FF4444' },
  reRecord: { backgroundColor: '#2A2A2A', borderWidth: 1, borderColor: '#FF2A2A' },
  recButtonText: { color: '#F5F5F5', fontWeight: '600', fontSize: 14 },
  recInfo: { color: '#9A9A9A', fontSize: 12, marginBottom: 8 },
  clearAudio: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#2A2A2A', borderWidth: 1, borderColor: '#444' },
  clearAudioText: { color: '#CFCFCF', fontSize: 12 },
  errorText: { color: '#FF5555', fontSize: 12, marginTop: 4 },
});
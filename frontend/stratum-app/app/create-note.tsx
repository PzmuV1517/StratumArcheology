import React, { useState } from 'react';
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
import { Audio } from 'expo-av';

export default function CreateNoteScreen() {
  const { projectId } = useLocalSearchParams();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVoiceNote, setIsVoiceNote] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const startRecording = async () => {
    try {
      setRecordingError(null);
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setRecordingError('Microphone permission denied');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const result = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(result.recording);
    } catch (e: any) {
      console.error('Start recording failed', e);
      setRecordingError('Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedUri(uri);
      setRecording(null);
    } catch (e: any) {
      console.error('Stop recording failed', e);
      setRecordingError('Failed to stop recording');
    }
  };

  const resetRecording = () => {
    setRecording(null);
    setRecordedUri(null);
    setRecordingError(null);
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
      });
      if (isVoiceNote && recordedUri) {
        try {
          await noteService.uploadAudio(note.id, recordedUri);
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
                if (!isVoiceNote) {
                  // switching to voice mode – clear text content
                  setContent('');
                } else {
                  // leaving voice mode – reset recording state
                  resetRecording();
                }
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
                <Text style={styles.recInfo}>Recorded file ready to upload</Text>
              )}
              {recordingError && <Text style={styles.errorText}>{recordingError}</Text>}
              {!!recordedUri && (
                <TouchableOpacity style={styles.clearAudio} onPress={resetRecording} disabled={loading}>
                  <Text style={styles.clearAudioText}>Remove Audio</Text>
                </TouchableOpacity>
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
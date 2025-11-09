import React, { useState, useEffect } from 'react';
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
  Platform
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Stack } from 'expo-router';
import { noteService } from '../src/services/noteService';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  author_id: string;
  project_id: string;
  attachments?: Array<{
    id: string;
    filename?: string;
    file_path?: string;
    mime_type?: string;
    url?: string;
  }>;
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
    }, [noteId])
  );

  const loadNote = async () => {
    try {
      setLoading(true);
      const noteData = await noteService.getNote(noteId as string);
      setNote(noteData);
    } catch (error) {
      console.error('Error loading note:', error);
      Alert.alert('Error', 'Failed to load note details', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    router.push({
      pathname: '/edit-note',
      params: { noteId, projectId }
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
      // Navigate back to the project detail page reliably
      if (projectId) {
        router.replace({ pathname: '/project/[id]', params: { id: String(projectId) } });
      } else {
        router.back();
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      Alert.alert('Error', 'Failed to delete note');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen 
          options={{
            title: 'Note Details',
            headerStyle: { backgroundColor: '#111111' },
            headerTintColor: '#FF2A2A',
            headerTitleStyle: { 
              color: '#F5F5F5',
              fontSize: 18,
              fontWeight: '600'
            },
            headerBackTitle: 'Project',
            headerShown: true,
            presentation: 'card',
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
            title: 'Note Not Found',
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
        <Text style={styles.errorText}>Note not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back to Project</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <Stack.Screen 
        options={{
          title: note.title,
          headerStyle: { backgroundColor: '#111111' },
          headerTintColor: '#FF2A2A',
          headerTitleStyle: { 
            color: '#F5F5F5',
            fontSize: 18,
            fontWeight: '600'
          },
          headerBackTitle: 'Project',
          headerShown: true,
          presentation: 'card',
          headerRight: () => (
            <View style={styles.headerButtons}>
              <TouchableOpacity onPress={handleEdit} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                <Text style={[styles.headerButtonText, styles.deleteButtonText]}>Delete</Text>
              </TouchableOpacity>
            </View>
          ),
        }} 
      />      <ScrollView style={styles.content}>
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

          <View style={styles.contentContainer}>
            <Text style={styles.noteContent}>{note.content}</Text>
          </View>

          {/* Attachments section */}
          {note.attachments && note.attachments.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={{ color: '#F5F5F5', fontWeight: '700', marginBottom: 12 }}>Attachments</Text>
              {note.attachments.map((att: any) => {
                const isAudio = att.mime_type?.startsWith('audio/');
                if (Platform.OS === 'web' && isAudio) {
                  return (
                    <View key={att.id} style={{ marginBottom: 16, padding: 12, borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12, backgroundColor: '#1A1A1A' }}>
                      <Text style={{ color: '#F5F5F5', marginBottom: 6 }}>{att.filename || att.file_path || 'audio'}</Text>
                      <AudioAttachmentPlayer url={att.url} />
                    </View>
                  );
                }
                return (
                  <View key={att.id} style={{ marginBottom: 12 }}>
                    <Text style={{ color: '#9A9A9A' }}>{att.filename || att.file_path}</Text>
                  </View>
                );
              })}
            </View>
          )}
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
              This will permanently delete this note and its attachments. This action cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowDeleteModal(false)} disabled={isDeleting}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#3A0C0C', borderWidth: 1, borderColor: '#FF4444', opacity: isDeleting ? 0.7 : 1 }]}
                onPress={confirmDelete}
                disabled={isDeleting}
              >
                <Text style={[styles.modalButtonText, { color: '#FF4444' }]}>{isDeleting ? 'Deleting…' : 'Delete'}</Text>
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
  React.useEffect(() => {
    if (!url || !audioRef.current || !canvasRef.current) return;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let raf = 0;
    try {
      ctx = new AudioContext();
      const src = ctx.createMediaElementSource(audioRef.current);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const g = canvasRef.current.getContext('2d')!;
      const draw = () => {
        raf = requestAnimationFrame(draw);
        analyser!.getByteFrequencyData(data);
        g.clearRect(0,0,canvasRef.current!.width,canvasRef.current!.height);
        const w = canvasRef.current!.width / data.length;
        for (let i=0;i<data.length;i++){
          const v = data[i]/255;
          const h = v * canvasRef.current!.height;
          g.fillStyle = '#FF2A2A';
          g.fillRect(i*w, canvasRef.current!.height - h, w-1, h);
        }
      };
      draw();
    } catch {}
    return () => { if (raf) cancelAnimationFrame(raf); try { ctx?.close(); } catch {} };
  }, [url]);
  return (
    <View style={{ gap: 8 }}>
      <audio ref={audioRef} src={url} controls style={{ width: '100%' }} />
      <canvas ref={canvasRef} width={600} height={60} style={{ width: '100%', height: 60, backgroundColor: '#111', borderRadius: 6 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111111',
    padding: 24,
  },
  content: {
    flex: 1,
  },
  loadingText: {
    fontSize: 16,
    color: '#9A9A9A',
    marginTop: 16,
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: 18,
    color: '#F5F5F5',
    marginBottom: 24,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  backButton: {
    backgroundColor: '#FF2A2A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  backButtonText: {
    color: '#F5F5F5',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerButtonText: {
    color: '#FF2A2A',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButtonText: {
    color: '#FF4444',
  },
  noteContainer: {
    padding: 24,
  },
  noteTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F5F5F5',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  noteMeta: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  noteMetaText: {
    fontSize: 14,
    color: '#9A9A9A',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  contentContainer: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  noteContent: {
    fontSize: 16,
    color: '#F5F5F5',
    lineHeight: 24,
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F5F5F5',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#2A2A2A',
  },
  modalButtonText: {
    color: '#F5F5F5',
    fontSize: 14,
    fontWeight: '600',
  },
});
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Platform, Alert } from 'react-native';

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

export default function NotesSection({ notes, onCreateNote, onNotePress, onDeleteNote, canEdit = true }: Props) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const MiniAudio = ({ url }: { url?: string }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<AudioContext | null>(null);
    const rafRef = useRef<number>(0);

    useEffect(() => {
      if (Platform.OS !== 'web') return;
      if (!url || !audioRef.current || !canvasRef.current) return;
      let ctx: AudioContext | null = null;
      let analyser: AnalyserNode | null = null;
      let mounted = true;
      try {
        audioRef.current.crossOrigin = 'anonymous';
        ctx = new AudioContext();
        ctxRef.current = ctx;
        const src = ctx.createMediaElementSource(audioRef.current);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        const data = new Uint8Array(analyser.fftSize);
        const g = canvasRef.current.getContext('2d')!;
        const draw = () => {
          if (!mounted) return;
          rafRef.current = requestAnimationFrame(draw);
          analyser!.getByteTimeDomainData(data);
          g.clearRect(0,0,canvasRef.current!.width,canvasRef.current!.height);
          g.strokeStyle = '#FF2A2A';
          g.lineWidth = 2;
          g.beginPath();
          const slice = canvasRef.current!.width / data.length;
          for (let i=0;i<data.length;i++){
            const v = data[i]/128 - 1;
            const y = (v * canvasRef.current!.height)/2 + canvasRef.current!.height/2;
            if (i===0) g.moveTo(0,y); else g.lineTo(i*slice,y);
          }
          g.stroke();
        };
        draw();
      } catch {}
      return () => {
        mounted = false;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        try { ctx?.close(); } catch {}
      };
    }, [url]);

    if (Platform.OS !== 'web') {
      return <Text style={{ color: '#9A9A9A', fontSize: 12 }}>Audio (open note to play)</Text>;
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
            if (c && c.state === 'suspended') c.resume().catch(()=>{});
          }}
        />
        <canvas ref={canvasRef} width={300} height={40} style={styles.audioCanvas} />
      </View>
    );
  };

  const renderNote = ({ item }: { item: Note }) => {
    const attachments = item.attachments || [];
    const hasAudio = attachments.some((a) => (a.mime_type || a.file_type || '').startsWith('audio/'));
    const isVoice = (!item.content || item.content.trim() === '') && hasAudio;
    const audioAtt = attachments.find((a) => (a.mime_type || a.file_type || '').startsWith('audio/'));

    return (
      <View style={styles.noteCard}>
        <TouchableOpacity onPress={() => !isVoice && onNotePress(item.id)} activeOpacity={isVoice ? 1 : 0.7}>
          <View style={styles.noteHeader}>
            <Text style={styles.noteTitle} numberOfLines={1}>{item.title}{isVoice ? ' 🔊' : ''}</Text>
            <Text style={styles.noteDate}>{new Date(item.updated_at).toLocaleDateString(undefined, { timeZone: 'UTC' })}</Text>
          </View>
          {!isVoice && !!item.content && (
            <Text style={styles.notePreview} numberOfLines={2}>{item.content}</Text>
          )}
          {isVoice && audioAtt?.url && (
            <MiniAudio url={audioAtt.url} />
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
                    onPress={() => { setPendingDeleteId(null); onDeleteNote(item.id); }}
                  >
                    <Text style={[styles.metaBtnText, styles.deleteBtnText]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.metaBtn, styles.deleteBtn]}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    // Inline confirmation for web
                    setPendingDeleteId(item.id);
                  } else {
                    Alert.alert(
                      'Delete voice note?',
                      'This will permanently delete the note and its audio attachment.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => onDeleteNote(item.id) }
                      ]
                    );
                  }
                }}
              >
                <Text style={[styles.metaBtnText, styles.deleteBtnText]}>Delete</Text>
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
              <Text style={styles.emptyStateSubtext}>Create your first note to get started</Text>
              <TouchableOpacity style={styles.createButton} onPress={onCreateNote}>
                <Text style={styles.createButtonText}>CREATE FIRST NOTE</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.emptyStateSubtext}>No notes have been added to this project yet</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#F5F5F5' },
  addButton: { backgroundColor: '#FF2A2A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  addButtonText: { color: '#F5F5F5', fontWeight: '600', fontSize: 12 },
  noteCard: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#2A2A2A' },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  noteTitle: { color: '#F5F5F5', fontWeight: '700', fontSize: 16, flex: 1, marginRight: 8 },
  noteDate: { color: '#9A9A9A', fontSize: 12 },
  notePreview: { color: '#CFCFCF', marginTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyStateText: { fontSize: 18, fontWeight: '600', color: '#F5F5F5', marginBottom: 8 },
  emptyStateSubtext: { fontSize: 14, color: '#9A9A9A', marginBottom: 24 },
  createButton: { backgroundColor: '#2A2A2A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  createButtonText: { color: '#F5F5F5', fontWeight: '600' },
  audioPreviewWrapper: { marginTop: 6, gap: 6 },
  audioTag: { width: '100%' },
  audioCanvas: { width: '100%', height: 40, backgroundColor: '#111', borderRadius: 6 },
  voiceActions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  metaBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#2A2A2A', borderWidth: 1, borderColor: '#333' },
  metaBtnText: { color: '#CFCFCF', fontSize: 12, fontWeight: '600' },
  deleteBtn: { borderColor: '#3A0C0C', backgroundColor: '#2A1414' },
  deleteBtnText: { color: '#FF4444' },
  inlineConfirm: { flex: 1, padding: 8, backgroundColor: '#1E1E1E', borderRadius: 8, borderWidth: 1, borderColor: '#333', gap: 8 },
  confirmText: { color: '#F5F5F5', fontSize: 12, fontWeight: '600' },
  confirmButtons: { flexDirection: 'row', gap: 8 },
  cancelBtn: { backgroundColor: '#2A2A2A', borderColor: '#444' },
});

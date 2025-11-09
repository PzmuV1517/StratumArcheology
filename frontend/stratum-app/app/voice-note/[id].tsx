import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import AudioPanel from '../../src/components/data/AudioPanel.web';
import { noteService } from '../../src/services/noteService';

export default function VoiceNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [note, setNote] = useState<any>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!id) return;
        const n = await noteService.getNote(id as string);
        if (!mounted) return;
        setNote(n);
        const att = (n.attachments || []).find((a: any) => a.mime_type?.startsWith('audio/'));
        setAudioUrl(att?.url || null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: note?.title || 'Voice Note' }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.loading}>Loading…</Text>
        </View>
      ) : audioUrl ? (
        <View style={styles.content}>
          <AudioPanel src={audioUrl} name={note?.title} />
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.loading}>No audio attachment found.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { color: '#9A9A9A', marginTop: 8 },
  content: { flex: 1 },
});

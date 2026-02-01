import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { noteService } from "@/services/noteService";
import AudioPanel from "@/components/data/AudioPanel"; // platform auto-resolution

export default function VoiceNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [note, setNote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!id) return;
        const n = await noteService.getNote(id);
        setNote(n);
        const att = (n.attachments || []).find((a: any) =>
          (a.mime_type || a.file_type)?.startsWith("audio/"),
        );
        setAudioUrl(att?.url || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: note?.title || "Voice Note",
          headerStyle: { backgroundColor: "#111" },
          headerTintColor: "#FF2A2A",
        }}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FF2A2A" />
          <Text style={styles.loading}>Loading…</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{note?.title}</Text>
          <View style={{ flex: 1, marginTop: 16 }}>
            <AudioPanel audioUrl={audioUrl || ""} />
            {!audioUrl && (
              <Text style={{ color: "#9A9A9A", marginTop: 12 }}>
                No audio attachment found.
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loading: { color: "#9A9A9A", marginTop: 8 },
  title: { color: "#F5F5F5", fontSize: 20, fontWeight: "700" },
});

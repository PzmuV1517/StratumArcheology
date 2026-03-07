/**
 * @file
 * Voice note playback screen.
 *
 * Plays back recorded voice notes with waveform visualization
 * and playback controls.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { noteService } from "../../src/services/noteService";
import AudioPanel from "../../src/components/data/AudioPanel"; // platform auto-resolution

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

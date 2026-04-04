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
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { noteService } from "@/services/noteService";
import AudioPanel from "@/components/data/AudioPanel"; // platform auto-resolution
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function VoiceNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const pageBackground = isDarkMode ? "#111111" : "#F7F7F7";
  const textPrimary = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const textSecondary = isDarkMode ? "#9A9A9A" : "#666666";
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
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      <Stack.Screen
        options={{
          title: note?.title || "Voice Note",
          headerStyle: { backgroundColor: pageBackground },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: { color: textPrimary },
        }}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FF2A2A" />
          <Text style={[styles.loading, { color: textSecondary }]}>Loading…</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: textPrimary }]}>{note?.title}</Text>
          <View style={{ flex: 1, marginTop: 16 }}>
            <AudioPanel audioUrl={audioUrl || ""} />
            {!audioUrl && (
              <Text style={{ color: textSecondary, marginTop: 12 }}>
                No audio attachment found.
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
      padding: 16,
    },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    loading: { color: isDarkMode ? "#9A9A9A" : "#666666", marginTop: 8 },
    title: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 20,
      fontWeight: "700",
    },
  });

/**
 * @file
 * Image preview screen.
 *
 * Full-screen image viewer with zoom and pan capabilities.
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
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { fileService } from "../src/services/fileService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import PhotoPanel from "../src/components/data/PhotoPanel";
import { showAlert } from "../src/utils/alert";

export default function ImagePreviewScreen() {
  const { nodeId, name } = useLocalSearchParams<{ nodeId: string; name: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    (async () => {
      try {
        if (Platform.OS === "web") {
          // Web: downloadFile returns { blob, contentLength, mimeType }
          try {
            const { blob } = await fileService.downloadFile(nodeId);
            if (blob) {
              const url = window.URL.createObjectURL(blob);
              if (!revoked) setBlobUrl(url);
            } else {
              throw new Error("No blob returned");
            }
          } catch (err) {
            console.error("[ImagePreview] Download failed:", err);
            if (!revoked) setError("Failed to load image");
          }
        } else {
          // On native, downloadFile returns { uri, contentLength, mimeType }
          try {
            const res = await fileService.downloadFile(nodeId, name as string);
            console.log("[ImagePreview] Native download result:", res);
            if (!revoked && res && res.uri) {
              // Use the local file URI directly for native platforms
              setBlobUrl(res.uri);
            } else {
              if (!revoked) setError("Failed to load image - no URI returned");
            }
          } catch (nativeErr) {
            console.error("[ImagePreview] Native download failed:", nativeErr);
            if (!revoked) setError("Failed to load image");
          }
        }
      } catch (e) {
        console.error("[ImagePreview] Unexpected error:", e);
        if (!revoked) setError("Failed to load image");
      } finally {
        if (!revoked) setLoading(false);
      }
    })();
    return () => {
      revoked = true;
      if (blobUrl && Platform.OS === "web") {
        try {
          window.URL.revokeObjectURL(blobUrl);
        } catch {}
      }
    };
  }, [nodeId, name]);

  const handleDownload = async () => {
    if (!blobUrl) return;
    if (Platform.OS === "web") {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = (name as string) || "image";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      showAlert("Download", "Mobile download not implemented yet.");
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: (name as string) || "Image",
          headerTransparent: Platform.OS === "ios",
          headerBlurEffect:
            Platform.OS === "ios" ? "systemChromeMaterial" : undefined,
          headerStyle: Platform.OS === "ios" ? {} : { backgroundColor: "#111111" },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: { color: "#F5F5F5" },
        }}
      />
      <View style={styles.content}>
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color="#FF2A2A" />
            <Text style={styles.loadingText}>Loading image…</Text>
          </View>
        )}
        {!loading && error && (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {!loading && !error && blobUrl && <PhotoPanel uri={blobUrl} />}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleDownload}
          disabled={!blobUrl}
        >
          <Text style={styles.actionButtonText}>Download</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.closeButton]}
          onPress={() => router.back()}
        >
          <Text style={[styles.actionButtonText, { color: "#9A9A9A" }]}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111111" },
  content: { flex: 1, padding: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#9A9A9A" },
  errorText: { color: "#FF4444", fontSize: 16 },
  actions: { flexDirection: "row", gap: 12, padding: 16 },
  actionButton: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  closeButton: { backgroundColor: "#1A1A1A" },
  actionButtonText: { color: "#F5F5F5", fontWeight: "600" },
});

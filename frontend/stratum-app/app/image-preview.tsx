/**
 * @file
 * Image preview screen.
 *
 * Full-screen image viewer with zoom and pan capabilities.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { fileService } from "@/services/fileService";
import PhotoPanel from "@/components/data/PhotoPanel";
import { showAlert } from "@/utils/alert";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function ImagePreviewScreen() {
  const { nodeId, name } = useLocalSearchParams<{ nodeId: string; name: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const pageBackground = isDarkMode ? "#111111" : "#F7F7F7";
  const surfaceBackground = isDarkMode ? "#1A1A1A" : "#FFFFFF";
  const borderColor = isDarkMode ? "#333" : "#D9D9D9";
  const textPrimary = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const textSecondary = isDarkMode ? "#9A9A9A" : "#666666";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      <Stack.Screen
        options={{
          title: (name as string) || "Image",
          headerTransparent: Platform.OS === "ios",
          headerBlurEffect:
            Platform.OS === "ios" ? "systemChromeMaterial" : undefined,
          headerStyle:
            Platform.OS === "ios" ? {} : { backgroundColor: pageBackground },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: { color: textPrimary },
        }}
      />
      <View style={styles.content}>
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color="#FF2A2A" />
            <Text style={[styles.loadingText, { color: textSecondary }]}>
              Loading image…
            </Text>
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
          style={[
            styles.actionButton,
            { backgroundColor: surfaceBackground, borderColor },
          ]}
          onPress={handleDownload}
          disabled={!blobUrl}
        >
          <Text style={[styles.actionButtonText, { color: textPrimary }]}>
            Download
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.closeButton,
            { backgroundColor: isDarkMode ? "#1A1A1A" : "#EFEFEF", borderColor },
          ]}
          onPress={() => router.back()}
        >
          <Text style={[styles.actionButtonText, { color: textSecondary }]}>
            Close
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    content: { flex: 1, padding: 12 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    loadingText: { marginTop: 12, color: isDarkMode ? "#9A9A9A" : "#666666" },
    errorText: { color: "#FF4444", fontSize: 16 },
    actions: { flexDirection: "row", gap: 12, padding: 16 },
    actionButton: {
      flex: 1,
      backgroundColor: isDarkMode ? "#2A2A2A" : "#FFFFFF",
      padding: 14,
      borderRadius: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: isDarkMode ? "#333333" : "#D9D9D9",
    },
    closeButton: { backgroundColor: isDarkMode ? "#1A1A1A" : "#EFEFEF" },
    actionButtonText: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontWeight: "600",
    },
  });

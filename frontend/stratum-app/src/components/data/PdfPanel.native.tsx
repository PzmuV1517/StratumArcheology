/**
 * @file
 * PDF viewer panel for React Native.
 *
 * Renders PDF documents using a native PDF viewer.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function PdfPanel({ src }: { src: string | null }) {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const mutedIconColor = isDarkMode ? "#444" : "#8A8A8A";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_currentPage, _setCurrentPage] = useState(1);
  const webViewRef = React.useRef<WebView>(null);

  if (!src) {
    return (
      <View style={styles.wrapper}>
        <Ionicons name="document-text-outline" size={48} color={mutedIconColor} />
        <Text style={styles.info}>No PDF to display</Text>
      </View>
    );
  }

  // Use Google Docs Viewer as a fallback for PDF rendering
  // This works reliably on mobile and handles most PDFs
  const viewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(src)}`;

  return (
    <View style={styles.wrapper}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF2A2A" />
          <Text style={styles.loadingText}>Loading PDF...</Text>
        </View>
      )}
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setLoading(true);
              webViewRef.current?.reload();
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: viewerUrl }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error("WebView error:", nativeEvent);
            setError("Failed to load PDF");
            setLoading(false);
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error("HTTP error:", nativeEvent.statusCode);
            if (nativeEvent.statusCode >= 400) {
              setError(`Failed to load PDF (${nativeEvent.statusCode})`);
              setLoading(false);
            }
          }}
          startInLoadingState={false}
          scalesPageToFit={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mixedContentMode="compatibility"
          originWhitelist={["*"]}
        />
      )}

      {/* Simple page indicator - Google Docs viewer handles pagination internally */}
      {!loading && !error && (
        <View style={styles.pageIndicator}>
          <Text style={styles.pageText}>Use pinch to zoom • Swipe to navigate</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    wrapper: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
      backgroundColor: isDarkMode ? "#0E0E0E" : "#FFFFFF",
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
    },
    webview: {
      flex: 1,
      width: "100%",
      backgroundColor: isDarkMode ? "#0E0E0E" : "#FFFFFF",
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isDarkMode ? "rgba(14,14,14,0.9)" : "rgba(255,255,255,0.9)",
      zIndex: 1,
    },
    loadingText: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginTop: 12,
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    errorText: {
      color: "#FF4444",
      textAlign: "center",
      marginTop: 12,
      marginBottom: 20,
    },
    retryButton: {
      backgroundColor: "#FF2A2A",
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryText: {
      color: "#FFFFFF",
      fontWeight: "600",
    },
    pageIndicator: {
      position: "absolute",
      bottom: 10,
      left: 0,
      right: 0,
      alignItems: "center",
    },
    pageText: {
      color: isDarkMode ? "#666666" : "#555555",
      fontSize: 12,
      backgroundColor: isDarkMode ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.75)",
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    info: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      textAlign: "center",
      marginTop: 12,
    },
  });

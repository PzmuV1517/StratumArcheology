import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";

export default function VideoPanel({ src }: { src: string | null }) {
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isPlaying = status?.isLoaded && status.isPlaying;

  useEffect(() => {
    // Reset state when src changes
    setError(null);
    setLoading(true);
  }, [src]);

  if (!src) {
    return (
      <View style={styles.wrapper}>
        <Text style={styles.info}>No video to display</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF2A2A" />
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      )}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <Video
          ref={videoRef}
          source={{ uri: src }}
          style={styles.video}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={false}
          isLooping={false}
          onPlaybackStatusUpdate={(newStatus) => {
            setStatus(newStatus);
            if (newStatus.isLoaded) {
              setLoading(false);
            }
          }}
          onError={(err) => {
            console.error("Video error:", err);
            setError("Failed to load video");
            setLoading(false);
          }}
          onLoad={() => setLoading(false)}
        />
      )}
      {/* Custom play/pause overlay for better UX */}
      {!loading && !error && status?.isLoaded && !isPlaying && (
        <TouchableOpacity
          style={styles.playOverlay}
          onPress={() => videoRef.current?.playAsync()}
        >
          <View style={styles.playButton}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    backgroundColor: "#0E0E0E",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    zIndex: 1,
  },
  loadingText: {
    color: "#9A9A9A",
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
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255, 42, 42, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  playIcon: {
    color: "#FFFFFF",
    fontSize: 28,
    marginLeft: 4,
  },
  info: {
    color: "#9A9A9A",
    textAlign: "center",
  },
});

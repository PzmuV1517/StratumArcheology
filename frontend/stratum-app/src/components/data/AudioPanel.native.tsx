import React, { useRef, useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import { Ionicons } from "@expo/vector-icons";

export interface AudioPanelProps {
  audioUrl: string;
}

export default function AudioPanel({ audioUrl }: AudioPanelProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isLoaded = status?.isLoaded;
  const isPlaying = status?.isLoaded && status.isPlaying;
  const position = status?.isLoaded ? status.positionMillis : 0;
  const duration = status?.isLoaded ? status.durationMillis || 0 : 0;

  useEffect(() => {
    let mounted = true;

    const loadAudio = async () => {
      if (!audioUrl) return;

      setLoading(true);
      setError(null);

      try {
        // Unload previous sound
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
        }

        // Configure audio mode
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        // Load new sound
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false },
          (newStatus) => {
            if (mounted) setStatus(newStatus);
          }
        );

        if (mounted) {
          soundRef.current = sound;
          setLoading(false);
        } else {
          await sound.unloadAsync();
        }
      } catch (err) {
        console.error("Audio load error:", err);
        if (mounted) {
          setError("Failed to load audio");
          setLoading(false);
        }
      }
    };

    loadAudio();

    return () => {
      mounted = false;
      soundRef.current?.unloadAsync();
    };
  }, [audioUrl]);

  const togglePlayPause = async () => {
    if (!soundRef.current) return;
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  };

  const seekTo = async (percentage: number) => {
    if (!soundRef.current || !duration) return;
    const newPosition = percentage * duration;
    await soundRef.current.setPositionAsync(newPosition);
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!audioUrl) {
    return (
      <View style={styles.wrapper}>
        <Text style={styles.info}>No audio to play</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF2A2A" />
          <Text style={styles.loadingText}>Loading audio...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={40} color="#FF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <View style={styles.playerContainer}>
          {/* Waveform placeholder */}
          <View style={styles.waveformContainer}>
            <View style={styles.waveformBars}>
              {Array.from({ length: 40 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveformBar,
                    {
                      height: 10 + Math.sin(i * 0.5) * 20 + Math.random() * 10,
                      backgroundColor:
                        duration > 0 && (i / 40) < (position / duration)
                          ? "#FF2A2A"
                          : "#444",
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Progress bar */}
          <TouchableOpacity
            style={styles.progressContainer}
            onPress={(e) => {
              const { locationX } = e.nativeEvent;
              const percentage = locationX / 280; // Approximate width
              seekTo(Math.max(0, Math.min(1, percentage)));
            }}
            activeOpacity={0.8}
          >
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${duration > 0 ? (position / duration) * 100 : 0}%` },
                ]}
              />
            </View>
          </TouchableOpacity>

          {/* Time display */}
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>

          {/* Controls */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              onPress={async () => {
                if (soundRef.current) {
                  const newPos = Math.max(0, position - 10000);
                  await soundRef.current.setPositionAsync(newPos);
                }
              }}
              style={styles.controlButton}
            >
              <Ionicons name="play-back" size={28} color="#F5F5F5" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={togglePlayPause}
              style={styles.playPauseButton}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={36}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                if (soundRef.current && duration) {
                  const newPos = Math.min(duration, position + 10000);
                  await soundRef.current.setPositionAsync(newPos);
                }
              }}
              style={styles.controlButton}
            >
              <Ionicons name="play-forward" size={28} color="#F5F5F5" />
            </TouchableOpacity>
          </View>
        </View>
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
    padding: 20,
    justifyContent: "center",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#9A9A9A",
    marginTop: 12,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#FF4444",
    marginTop: 12,
    textAlign: "center",
  },
  playerContainer: {
    alignItems: "center",
  },
  waveformContainer: {
    width: "100%",
    height: 60,
    marginBottom: 20,
    justifyContent: "center",
  },
  waveformBars: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    gap: 2,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
  },
  progressContainer: {
    width: "100%",
    paddingVertical: 10,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#333",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FF2A2A",
    borderRadius: 3,
  },
  timeContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  timeText: {
    color: "#9A9A9A",
    fontSize: 12,
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    gap: 20,
  },
  controlButton: {
    padding: 10,
  },
  playPauseButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FF2A2A",
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    color: "#9A9A9A",
    textAlign: "center",
  },
});

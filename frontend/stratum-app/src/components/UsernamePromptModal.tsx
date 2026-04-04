/**
 * @file
 * Username prompt modal.
 *
 * Shown to existing users who don't have a username set.
 * Blocks the main UI until they choose a unique username.
 *
 * Copyright (c) 2026 Andrei Banu & Levin Mircea
 */
import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from "react-native";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface Props {
  visible: boolean;
  onComplete: () => void;
}

export default function UsernamePromptModal({ visible, onComplete }: Props) {
  const { refreshUser } = useAuth();
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const placeholderTextColor = isDarkMode ? "#666666" : "#7A7A7A";

  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  const sanitize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, "")
      .slice(0, 30);

  const checkAvailability = useCallback(async (name: string) => {
    if (name.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const { data } = await api.get(
        `/auth/username/check?username=${encodeURIComponent(name)}`,
      );
      if (!data.available) {
        setError(data.reason || "Username is taken");
      }
    } catch {
      // Silently fail availability check
    } finally {
      setChecking(false);
    }
  }, []);

  const handleChange = (text: string) => {
    const sanitized = sanitize(text);
    setUsername(sanitized);
    setError(null);
    // Debounce check
    if (sanitized.length >= 3) {
      const t = setTimeout(() => checkAvailability(sanitized), 400);
      return () => clearTimeout(t);
    }
  };

  const handleSave = async () => {
    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (error) return;

    setSaving(true);
    try {
      await api.patch("/auth/me", { username });
      await refreshUser();
      onComplete();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to set username");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Choose your username</Text>
          <Text style={styles.subtitle}>
            Pick a unique username for your STRATUM profile. This is how others will
            @mention you in project chats.
          </Text>

          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="e.g. john.doe"
            placeholderTextColor={placeholderTextColor}
            value={username}
            onChangeText={handleChange}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
          />

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : username.length >= 3 && !checking ? (
            <Text style={styles.available}>Username available!</Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.button,
              (saving || !!error || username.length < 3) && styles.buttonDisabled,
            ]}
            onPress={handleSave}
            disabled={saving || !!error || username.length < 3}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Set Username</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDarkMode ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.28)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    card: {
      backgroundColor: isDarkMode ? "#1E1E1E" : "#FFFFFF",
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: isDarkMode ? "#333" : "#D9D9D9",
      width: "100%",
      maxWidth: 400,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      lineHeight: 20,
      marginBottom: 20,
    },
    input: {
      backgroundColor: isDarkMode ? "#121212" : "#FFFFFF",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#333" : "#D9D9D9",
      fontSize: 16,
      marginBottom: 8,
    },
    inputError: {
      borderColor: "#FF4444",
    },
    error: {
      color: "#FF4444",
      fontSize: 12,
      marginBottom: 12,
    },
    available: {
      color: "#34C759",
      fontSize: 12,
      marginBottom: 12,
    },
    button: {
      backgroundColor: "#FF2A2A",
      padding: 14,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
    },
  });

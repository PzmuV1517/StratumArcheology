/**
 * @file
 * Android alert override component.
 *
 * Provides custom alert dialogs for Android that match
 * the application's design language.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Alert,
  Platform,
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";

// ── Types ──────────────────────────────────────────────────────────────
interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface QueuedAlert {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

// ── Module-level plumbing (runs once on import) ────────────────────────
const _originalAlertFn = Alert.alert.bind(Alert);

let showCustomAlert: ((a: QueuedAlert) => void) | null = null;
const pendingQueue: QueuedAlert[] = [];

// Monkey-patch Alert.alert on ANDROID only.
// Web is handled via DOM events (see useEffect below).
if (Platform.OS === "android") {
  Alert.alert = (
    title: string,
    message?: string,
    buttons?: any[],
    _options?: any,
  ) => {
    const entry: QueuedAlert = {
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: "OK" }],
    };

    if (showCustomAlert) {
      showCustomAlert(entry);
    } else {
      // Component not mounted yet — queue it
      pendingQueue.push(entry);
    }
  };
}

// ── Component ──────────────────────────────────────────────────────────
/**
 * Custom alert dialog override for Android and web platforms.
 * @returns The rendered component
 */
export default function CustomAlertOverride() {
  const [current, setCurrent] = useState<QueuedAlert | null>(null);
  const queue = useRef<QueuedAlert[]>([]);

  // Process the next alert in queue
  const showNext = useCallback(() => {
    if (queue.current.length > 0) {
      setCurrent(queue.current.shift()!);
    } else {
      setCurrent(null);
    }
  }, []);

  // Shared handler for both monkey-patch (Android) and DOM events (web)
  const handleIncoming = useCallback(
    (entry: QueuedAlert) => {
      if (current) {
        queue.current.push(entry);
      } else {
        setCurrent(entry);
      }
    },
    [current],
  );

  // Register the callback so the monkey-patch can reach us (Android)
  useEffect(() => {
    if (Platform.OS === "ios") return;

    showCustomAlert = (entry: QueuedAlert) => handleIncoming(entry);

    // Drain anything that arrived before we mounted
    if (pendingQueue.length > 0) {
      queue.current.push(...pendingQueue.splice(0));
      showNext();
    }

    return () => {
      showCustomAlert = null;
    };
  }, [handleIncoming, showNext]);

  // Listen for "stratum-alert" DOM events on web
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const onStratumAlert = (e: Event) => {
      const { title, message, buttons } = (e as CustomEvent).detail;
      handleIncoming({ title, message, buttons });
    };

    window.addEventListener("stratum-alert", onStratumAlert);
    return () => window.removeEventListener("stratum-alert", onStratumAlert);
  }, [handleIncoming]);

  // Handle button press
  const handleButtonPress = useCallback(
    (button: AlertButton) => {
      setCurrent(null);
      button.onPress?.();
      // Show next queued alert after a brief delay
      setTimeout(() => showNext(), 150);
    },
    [showNext],
  );

  // Handle dismiss (tap outside / back button)
  const handleDismiss = useCallback(() => {
    if (!current) return;
    const cancelBtn = current.buttons.find((b) => b.style === "cancel");
    setCurrent(null);
    cancelBtn?.onPress?.();
    setTimeout(() => showNext(), 150);
  }, [current, showNext]);

  // On iOS this component renders nothing (keeps native alerts)
  if (Platform.OS === "ios" || !current) return null;

  const { title, message, buttons } = current;

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleDismiss}
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={styles.alertContainer}>
            <Text style={styles.title}>{title}</Text>

            {message ? <Text style={styles.message}>{message}</Text> : null}

            <View
              style={[
                styles.buttonContainer,
                buttons.length === 2 && styles.buttonContainerRow,
              ]}
            >
              {buttons.map((button, index) => {
                const isCancel = button.style === "cancel";
                const isDestructive = button.style === "destructive";

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      buttons.length === 2 && styles.buttonHalf,
                      isCancel && styles.buttonCancel,
                      isDestructive && styles.buttonDestructive,
                    ]}
                    onPress={() => handleButtonPress(button)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isCancel && styles.buttonTextCancel,
                        isDestructive && styles.buttonTextDestructive,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  alertContainer: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 24,
    minWidth: Math.min(Dimensions.get("window").width - 80, 320),
    maxWidth: 400,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FF2A2A",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#F5F5F5",
    lineHeight: 22,
    marginBottom: 24,
    textAlign: "center",
  },
  buttonContainer: {
    gap: 12,
  },
  buttonContainerRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    backgroundColor: "#FF2A2A",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  buttonHalf: {
    flex: 1,
  },
  buttonCancel: {
    backgroundColor: "#2C2C2C",
    borderWidth: 1,
    borderColor: "#444444",
  },
  buttonDestructive: {
    backgroundColor: "#D32F2F",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  buttonTextCancel: {
    color: "#AAAAAA",
  },
  buttonTextDestructive: {
    color: "#FFFFFF",
  },
});

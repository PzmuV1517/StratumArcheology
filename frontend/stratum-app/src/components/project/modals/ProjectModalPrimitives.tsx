import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface ProjectModalShellProps {
  visible: boolean;
  onRequestClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function ProjectModalShell({
  visible,
  onRequestClose,
  title,
  description,
  children,
}: ProjectModalShellProps) {
  const { styles } = useProjectModalTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          {description ? <Text style={styles.modalText}>{description}</Text> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

type ProjectModalStyleKey =
  | "actions"
  | "button"
  | "buttonText"
  | "primary"
  | "danger"
  | "input";

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.24)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalCard: {
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
      width: "100%",
    },
    modalTitle: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontWeight: "700",
      fontSize: 18,
      marginBottom: 6,
    },
    modalText: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginBottom: 12,
    },
    input: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      backgroundColor: isDarkMode ? "#141414" : "#FFFFFF",
      borderWidth: 1,
      borderColor: isDarkMode ? "#333333" : "#D9D9D9",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 12,
      gap: 8,
    },
    button: {
      backgroundColor: isDarkMode ? "#232323" : "#EFEFEF",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#333333" : "#D9D9D9",
    },
    buttonText: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontWeight: "600",
    },
    primary: {
      backgroundColor: isDarkMode ? "rgba(255, 42, 42, 0.16)" : "#FFFFFF",
      borderColor: "#FF2A2A",
    },
    danger: {
      backgroundColor: isDarkMode ? "rgba(255, 68, 68, 0.18)" : "#FFF1F1",
      borderColor: "#FF4444",
    },
  });

export function useProjectModalTheme() {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";

  return useMemo(
    () => ({
      styles: createStyles(isDarkMode),
      placeholderTextColor: isDarkMode ? "#777777" : "#8A8A8A",
      destructiveTextColor: isDarkMode ? "#FF6B6B" : "#FF4444",
    }),
    [isDarkMode],
  );
}

export function useProjectModalStyles() {
  return useProjectModalTheme().styles;
}

export function getProjectModalStyle(
  styles: ReturnType<typeof createStyles>,
  styleKey: ProjectModalStyleKey,
): ViewStyle | TextStyle {
  return styles[styleKey];
}

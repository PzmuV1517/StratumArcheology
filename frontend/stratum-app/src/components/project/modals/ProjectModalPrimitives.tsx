import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from "react-native";

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

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#1E1E1A",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333",
    width: "100%",
  },
  modalTitle: {
    color: "#F5F5F5",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 6,
  },
  modalText: {
    color: "#9A9A9A",
    marginBottom: 12,
  },
  input: {
    color: "#EAEAEA",
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333",
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
    backgroundColor: "#2A2A2A",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  buttonText: {
    color: "#F5F5F5",
    fontWeight: "600",
  },
  primary: {
    backgroundColor: "#2A2A2A",
    borderColor: "#FF2A2A",
  },
  danger: {
    backgroundColor: "#3A0C0C",
    borderColor: "#FF4444",
  },
});

export const projectModalStyles = styles;

export function getProjectModalStyle(
  styleKey: ProjectModalStyleKey
): ViewStyle | TextStyle {
  return styles[styleKey];
}
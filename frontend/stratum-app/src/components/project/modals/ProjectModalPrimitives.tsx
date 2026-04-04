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
    backgroundColor: "rgba(0,0,0,0.24)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#D9D9D9",
    width: "100%",
  },
  modalTitle: {
    color: "#1A1A1A",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 6,
  },
  modalText: {
    color: "#666666",
    marginBottom: 12,
  },
  input: {
    color: "#1A1A1A",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D9D9D9",
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
    backgroundColor: "#EFEFEF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D9D9D9",
  },
  buttonText: {
    color: "#1A1A1A",
    fontWeight: "600",
  },
  primary: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FF2A2A",
  },
  danger: {
    backgroundColor: "#FFF1F1",
    borderColor: "#FF4444",
  },
});

export const projectModalStyles = styles;

export function getProjectModalStyle(
  styleKey: ProjectModalStyleKey,
): ViewStyle | TextStyle {
  return styles[styleKey];
}

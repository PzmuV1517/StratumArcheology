import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";

interface Props {
  visible: boolean;
  membersCount: number;
  onClose: () => void;
  onOpenMembers: () => void;
  onOpenSettings: () => void;
  onExitProject?: () => void;
  onDeleteProject?: () => void;
  onTransferLeadership?: () => void;
  isOwner?: boolean;
  canChangeSettings?: boolean;
}

export default function ProjectMenuModal({
  visible,
  membersCount,
  onClose,
  onOpenMembers,
  onOpenSettings,
  onExitProject,
  onDeleteProject,
  onTransferLeadership,
  isOwner = false,
  canChangeSettings = true,
}: Props) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleExitPress = () => {
    setShowExitConfirm(true);
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    onClose();
    onExitProject?.();
  };

  const handleTransferLeadership = () => {
    setShowExitConfirm(false);
    onClose();
    onTransferLeadership?.();
  };

  const handleDeleteProject = () => {
    setShowExitConfirm(false);
    onClose();
    onDeleteProject?.();
  };

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.menuBackdrop}>
        {/* Click outside to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onOpenMembers();
            }}
          >
            <Text style={styles.menuItemText}>Members ({membersCount})</Text>
          </TouchableOpacity>
          {canChangeSettings ? (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onOpenSettings();
              }}
            >
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.menuItem, styles.disabledMenuItem]}>
              <Text style={[styles.menuItemText, styles.disabledText]}>
                Settings
              </Text>
              <Text style={styles.permissionHint}>
                Only the leader can change settings
              </Text>
            </View>
          )}
          {onExitProject && (
            <TouchableOpacity
              style={[styles.menuItem]}
              onPress={() => {
                onClose();
                onExitProject();
              }}
            >
              <Text style={[styles.menuItemText, styles.exitButtonText]}>Exit Project</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.menuItem, styles.closeButton, { justifyContent: "center" }]}
            onPress={onClose}
          >
            <Text style={[styles.menuItemText, { color: "#9A9A9A" }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  menuCard: {
    backgroundColor: "#1E1E1A",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333",
    width: "100%",
  },
  menuItem: { paddingVertical: 12 },
  menuItemText: { color: "#F5F5F5", fontSize: 16, fontWeight: "600" },
  disabledMenuItem: { opacity: 0.6 },
  disabledText: { color: "#666" },
  exitButtonText: {
    color: "#888",
  },
  closeButton: {
    borderTopWidth: 1,
    borderTopColor: "#333",
    marginTop: 8,
    paddingTop: 16,
  },
  permissionHint: {
    color: "#FF6B6B",
    fontSize: 12,
    marginTop: 4,
    fontStyle: "italic",
  },
});

import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ProjectActionModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateProject: () => void;
  onJoinProject: () => void;
}

export function ProjectActionModal({
  visible,
  onClose,
  onCreateProject,
  onJoinProject,
}: ProjectActionModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Project</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#9A9A9A" />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Options */}
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                onClose();
                onCreateProject();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="add-circle-outline" size={28} color="#FF2A2A" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Create Project</Text>
                <Text style={styles.optionSubtitle}>
                  Start a new archaeological project
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                onClose();
                onJoinProject();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="people-outline" size={28} color="#FF2A2A" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Join Project</Text>
                <Text style={styles.optionSubtitle}>
                  Join with invite link or code
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  container: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#2A2A2A",
  },
  optionsContainer: {
    padding: 12,
    gap: 8,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222222",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  optionSubtitle: {
    fontSize: 13,
    color: "#9A9A9A",
    letterSpacing: 0.2,
  },
});

/**
 * @file
 * Project action confirmation modal.
 *
 * Generic confirmation dialog for project-level actions.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";

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
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const closeIconColor = isDarkMode ? "#B3B3B3" : "#666666";
  const chevronColor = isDarkMode ? "#9A9A9A" : "#8A8A8A";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>Project</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={closeIconColor} />
            </TouchableOpacity>
          </View>

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
              <Ionicons name="chevron-forward" size={20} color={chevronColor} />
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
              <Ionicons name="chevron-forward" size={20} color={chevronColor} />
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.24)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    container: {
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 20,
      width: "100%",
      maxWidth: 400,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
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
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      letterSpacing: 0.5,
    },
    closeButton: {
      padding: 4,
    },
    divider: {
      height: 1,
      backgroundColor: isDarkMode ? "#2A2A2A" : "#E5E5E5",
    },
    optionsContainer: {
      padding: 12,
      gap: 8,
    },
    optionButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#141414" : "#F7F7F7",
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2E2E2E" : "#E0E0E0",
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: isDarkMode ? "rgba(255, 42, 42, 0.18)" : "#FFECEC",
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
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 4,
      letterSpacing: 0.3,
    },
    optionSubtitle: {
      fontSize: 13,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      letterSpacing: 0.2,
    },
  });

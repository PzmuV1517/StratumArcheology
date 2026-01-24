/**
 * STRATUM Conflict Resolution Modal
 *
 * Displays when a file/note has conflicts between local and remote versions.
 * Allows user to choose which version to keep or keep both.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FileConflict } from "../../services/offlineQueueService";

interface ConflictResolutionModalProps {
  visible: boolean;
  conflict: FileConflict | null;
  onResolve: (resolution: "keep_local" | "keep_remote" | "keep_both") => void;
  onCancel: () => void;
  localContent?: string;
  remoteContent?: string;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  visible,
  conflict,
  onResolve,
  onCancel,
  localContent,
  remoteContent,
}) => {
  const [showDiff, setShowDiff] = useState(false);

  if (!conflict) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isTextFile = conflict.fileName.match(
    /\.(txt|md|json|csv|xml|html|css|js|ts|py)$/i,
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="git-compare" size={24} color="#f97316" />
            </View>
            <Text style={styles.title}>File Conflict</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* File Info */}
            <View style={styles.fileInfo}>
              <Text style={styles.fileName}>{conflict.fileName}</Text>
              <Text style={styles.description}>
                This file was modified both locally and on the server while you were
                offline. Choose which version to keep.
              </Text>
            </View>

            {/* Version Cards */}
            <View style={styles.versionsContainer}>
              {/* Local Version */}
              <TouchableOpacity
                style={[styles.versionCard, styles.localCard]}
                onPress={() => onResolve("keep_local")}
              >
                <View style={styles.versionHeader}>
                  <Ionicons name="phone-portrait" size={20} color="#22c55e" />
                  <Text style={styles.versionTitle}>Your Local Version</Text>
                </View>
                <Text style={styles.versionDate}>
                  Modified: {formatDate(conflict.localVersion.localUpdatedAt)}
                </Text>
                <Text style={styles.versionInfo}>
                  Version {conflict.localVersion.localVersion}
                </Text>
                <View style={styles.keepButton}>
                  <Text style={styles.keepButtonText}>Keep This</Text>
                </View>
              </TouchableOpacity>

              {/* Remote Version */}
              <TouchableOpacity
                style={[styles.versionCard, styles.remoteCard]}
                onPress={() => onResolve("keep_remote")}
              >
                <View style={styles.versionHeader}>
                  <Ionicons name="cloud" size={20} color="#3b82f6" />
                  <Text style={styles.versionTitle}>Server Version</Text>
                </View>
                <Text style={styles.versionDate}>
                  Modified: {formatDate(conflict.remoteVersion.updatedAt)}
                </Text>
                <Text style={styles.versionInfo}>
                  Version {conflict.remoteVersion.version}
                  {conflict.remoteVersion.updatedBy &&
                    ` by ${conflict.remoteVersion.updatedBy}`}
                </Text>
                <View style={styles.keepButton}>
                  <Text style={styles.keepButtonText}>Keep This</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Keep Both Option */}
            <TouchableOpacity
              style={styles.keepBothButton}
              onPress={() => onResolve("keep_both")}
            >
              <Ionicons name="copy" size={20} color="#a855f7" />
              <Text style={styles.keepBothText}>Keep Both (create copy)</Text>
            </TouchableOpacity>

            {/* Diff View for Text Files */}
            {isTextFile && localContent && remoteContent && (
              <View style={styles.diffSection}>
                <TouchableOpacity
                  style={styles.diffToggle}
                  onPress={() => setShowDiff(!showDiff)}
                >
                  <Ionicons
                    name={showDiff ? "chevron-down" : "chevron-forward"}
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.diffToggleText}>
                    {showDiff ? "Hide" : "Show"} Content Comparison
                  </Text>
                </TouchableOpacity>

                {showDiff && (
                  <View style={styles.diffContainer}>
                    <View style={styles.diffPane}>
                      <Text style={styles.diffPaneTitle}>Local</Text>
                      <ScrollView style={styles.diffContent}>
                        <Text style={styles.diffText}>{localContent}</Text>
                      </ScrollView>
                    </View>
                    <View style={styles.diffPane}>
                      <Text style={styles.diffPaneTitle}>Server</Text>
                      <ScrollView style={styles.diffContent}>
                        <Text style={styles.diffText}>{remoteContent}</Text>
                      </ScrollView>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Cancel Button */}
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Decide Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#333",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(249, 115, 22, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  fileInfo: {
    marginBottom: 20,
  },
  fileName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#888",
    lineHeight: 20,
  },
  versionsContainer: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
    marginBottom: 16,
  },
  versionCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  localCard: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  remoteCard: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  versionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  versionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 8,
  },
  versionDate: {
    fontSize: 12,
    color: "#888",
    marginBottom: 4,
  },
  versionInfo: {
    fontSize: 12,
    color: "#666",
    marginBottom: 12,
  },
  keepButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  keepButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  keepBothButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
    marginBottom: 16,
  },
  keepBothText: {
    color: "#a855f7",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  diffSection: {
    marginTop: 8,
  },
  diffToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  diffToggleText: {
    color: "#888",
    fontSize: 14,
    marginLeft: 4,
  },
  diffContainer: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
    marginTop: 12,
  },
  diffPane: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
    overflow: "hidden",
  },
  diffPaneTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    padding: 8,
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  diffContent: {
    maxHeight: 150,
    padding: 8,
  },
  diffText: {
    fontSize: 12,
    color: "#ccc",
    fontFamily: Platform.OS === "web" ? "monospace" : "Courier",
  },
  cancelButton: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#333",
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#888",
    fontSize: 14,
  },
});

export default ConflictResolutionModal;

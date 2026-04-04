/**
 * @file
 * Project menu modal component.
 *
 * Displays project-level actions (edit, invite, delete)
 * in a modal menu.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";

// ─── Main Burger Menu ───────────────────────────────────────────────

interface Props {
  visible: boolean;
  membersCount: number;
  onClose: () => void;
  onOpenMembers: () => void;
  onOpenSettings: () => void;
  currentTabName?: string;
  onExitProject?: () => void;
  onDeleteProject?: () => void;
  onTransferLeadership?: () => void;
  isOwner?: boolean;
  isPublic?: boolean;
  onTogglePublicise?: () => void;
  canChangeSettings?: boolean;
}

export default function ProjectMenuModal({
  visible,
  membersCount,
  onClose,
  onOpenMembers,
  onOpenSettings,
  currentTabName: _currentTabName,
  onExitProject,
  onDeleteProject,
  onTransferLeadership,
  isOwner = false,
  isPublic = false,
  onTogglePublicise,
  canChangeSettings = true,
}: Props) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showPubliciseConfirm, setShowPubliciseConfirm] = useState(false);

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
            {isOwner && onTogglePublicise && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  setShowPubliciseConfirm(true);
                }}
              >
                <Text style={styles.menuItemText}>
                  {isPublic ? "Privatise Project" : "Publicise Project"}
                </Text>
              </TouchableOpacity>
            )}
            {onExitProject && (
              <TouchableOpacity style={[styles.menuItem]} onPress={handleExitPress}>
                <Text style={[styles.menuItemText, styles.exitButtonText]}>
                  Exit Project
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.menuItem,
                styles.closeButton,
                { justifyContent: "center" },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.menuItemText, { color: "#666666" }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Exit confirmation modal */}
      <Modal
        visible={showExitConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExitConfirm(false)}
      >
        <View style={styles.menuBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowExitConfirm(false)}
          />
          <View style={styles.menuCard}>
            <Text style={styles.confirmTitle}>
              {isOwner ? "Leave Project" : "Exit Project?"}
            </Text>
            <Text style={styles.confirmText}>
              {isOwner
                ? "You are the owner of this project. You must either transfer leadership to another member or delete the project."
                : "Are you sure you want to leave this project? You will need to be re-invited to rejoin."}
            </Text>

            {isOwner ? (
              <>
                {membersCount > 1 && (
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleTransferLeadership}
                  >
                    <Text style={styles.confirmButtonText}>Transfer Leadership</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.confirmButton, styles.dangerButton]}
                  onPress={handleDeleteProject}
                >
                  <Text style={[styles.confirmButtonText, styles.dangerText]}>
                    Delete Project
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.confirmButton, styles.dangerButton]}
                onPress={handleConfirmExit}
              >
                <Text style={[styles.confirmButtonText, styles.dangerText]}>
                  Leave Project
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowExitConfirm(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Publicise / Privatise confirmation modal */}
      <Modal
        visible={showPubliciseConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPubliciseConfirm(false)}
      >
        <View style={styles.menuBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowPubliciseConfirm(false)}
          />
          <View style={styles.menuCard}>
            <Text style={styles.confirmTitle}>
              {isPublic ? "Privatise Project?" : "Publicise Project?"}
            </Text>
            <Text style={styles.confirmText}>
              {isPublic
                ? "This project will no longer be visible in Unearthed. Only members will be able to access it."
                : "This project will be visible to everyone in Unearthed. Anyone will be able to see its name, description and cover image."}
            </Text>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                !isPublic && {
                  backgroundColor: "#EAF8EA",
                  borderWidth: 1,
                  borderColor: "#44AA44",
                },
              ]}
              onPress={() => {
                setShowPubliciseConfirm(false);
                onTogglePublicise?.();
              }}
            >
              <Text
                style={[styles.confirmButtonText, !isPublic && { color: "#44AA44" }]}
              >
                {isPublic ? "Privatise" : "Publicise"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowPubliciseConfirm(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.24)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#D9D9D9",
    width: "100%",
  },
  menuCardGlass: {
    borderRadius: 20,
    padding: 20,
    width: "100%",
  },
  menuItem: { paddingVertical: 12 },
  menuItemText: { color: "#1A1A1A", fontSize: 16, fontWeight: "600" },
  disabledMenuItem: { opacity: 0.6 },
  disabledText: { color: "#8A8A8A" },
  exitButtonText: {
    color: "#A94442",
  },
  closeButton: {
    borderTopWidth: 1,
    borderTopColor: "#D9D9D9",
    marginTop: 8,
    paddingTop: 16,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#E5E5E5",
    marginVertical: 8,
  },
  activeNavItem: {
    backgroundColor: "rgba(255, 42, 42, 0.12)",
    borderRadius: 10,
  },
  activeNavText: {
    color: "#FF2A2A",
  },
  permissionHint: {
    color: "#FF6B6B",
    fontSize: 12,
    marginTop: 4,
    fontStyle: "italic",
  },
  confirmTitle: {
    color: "#1A1A1A",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  confirmText: {
    color: "#666666",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  confirmButton: {
    backgroundColor: "#EFEFEF",
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#1A1A1A",
    fontSize: 16,
    fontWeight: "600",
  },
  dangerButton: {
    backgroundColor: "#FFF1F1",
    borderWidth: 1,
    borderColor: "#FF4444",
  },
  dangerText: {
    color: "#FF4444",
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#666666",
    fontSize: 16,
  },
});

import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LiquidGlassView, isLiquidGlassSupported } from "../../../utils/liquidGlass";

// ─── Tools / Other Pages Modal ──────────────────────────────────────

interface ToolItem {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  active?: boolean;
}

function ToolsModal({
  visible,
  onClose,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  items: ToolItem[];
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={toolStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={toolStyles.sheet}>
          <View style={toolStyles.handle} />
          <Text style={toolStyles.title}>More Tools</Text>
          <Text style={toolStyles.subtitle}>
            Navigate to other project views
          </Text>

          <View style={toolStyles.grid}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[
                  toolStyles.card,
                  item.active && toolStyles.cardActive,
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  onClose();
                  // Small delay to let sheet dismiss
                  setTimeout(() => item.onPress(), 200);
                }}
              >
                <View
                  style={[
                    toolStyles.iconCircle,
                    item.active && toolStyles.iconCircleActive,
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={26}
                    color={item.active ? "#FFFFFF" : "#FF2A2A"}
                  />
                </View>
                <Text
                  style={[
                    toolStyles.cardLabel,
                    item.active && toolStyles.cardLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
                <Text style={toolStyles.cardDesc} numberOfLines={2}>
                  {item.description}
                </Text>
                {item.active && (
                  <View style={toolStyles.activeBadge}>
                    <Text style={toolStyles.activeBadgeText}>Current</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={toolStyles.closeBtn} onPress={onClose}>
            <Text style={toolStyles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const toolStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    paddingTop: 14,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#555",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    color: "#F5F5F5",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#9A9A9A",
    fontSize: 14,
    marginBottom: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  card: {
    width: "47%",
    backgroundColor: "#2A2A2A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  cardActive: {
    borderColor: "#FF2A2A",
    backgroundColor: "rgba(255,42,42,0.08)",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,42,42,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  iconCircleActive: {
    backgroundColor: "#FF2A2A",
  },
  cardLabel: {
    color: "#F5F5F5",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardLabelActive: {
    color: "#FF2A2A",
  },
  cardDesc: {
    color: "#9A9A9A",
    fontSize: 12,
    lineHeight: 17,
  },
  activeBadge: {
    marginTop: 8,
    backgroundColor: "#FF2A2A",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  activeBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  closeBtn: {
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#2A2A2A",
    borderRadius: 14,
  },
  closeBtnText: {
    color: "#9A9A9A",
    fontSize: 16,
    fontWeight: "600",
  },
});

// ─── Main Burger Menu ───────────────────────────────────────────────

interface Props {
  visible: boolean;
  membersCount: number;
  onClose: () => void;
  onOpenMembers: () => void;
  onOpenSettings: () => void;
  onOpenGallery?: () => void;
  onOpenMap?: () => void;
  onOpenTimeMachine?: () => void;
  onOpenTools?: () => void;
  currentTabName?: string;
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
  onOpenGallery,
  onOpenMap,
  onOpenTimeMachine,
  onOpenTools,
  currentTabName,
  onExitProject,
  onDeleteProject,
  onTransferLeadership,
  isOwner = false,
  canChangeSettings = true,
}: Props) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);

  const toolItems: ToolItem[] = [
    ...(onOpenGallery
      ? [
          {
            key: "gallery",
            label: "Gallery",
            description: "Browse project photos and media files",
            icon: "images" as keyof typeof Ionicons.glyphMap,
            onPress: () => { onClose(); onOpenGallery(); },
            active: currentTabName === "gallery",
          },
        ]
      : []),
    ...(onOpenMap
      ? [
          {
            key: "map",
            label: "Map",
            description: "View GPS coordinates and site locations",
            icon: "map" as keyof typeof Ionicons.glyphMap,
            onPress: () => { onClose(); onOpenMap(); },
            active: currentTabName === "gps",
          },
        ]
      : []),
    ...(onOpenTimeMachine
      ? [
          {
            key: "history",
            label: "Time Machine",
            description: "See project history and past versions",
            icon: "time" as keyof typeof Ionicons.glyphMap,
            onPress: () => { onClose(); onOpenTimeMachine(); },
            active: currentTabName === "history",
          },
        ]
      : []),
    ...(onOpenTools && Platform.OS !== "web"
      ? [
          {
            key: "tools",
            label: "Tools",
            description: "Convert, export, and utility tools",
            icon: "construct" as keyof typeof Ionicons.glyphMap,
            onPress: () => { onClose(); onOpenTools(); },
            active: currentTabName === "tools",
          },
        ]
      : []),
  ];

  const hasTools = toolItems.length > 0;

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
          {Platform.OS === "ios" && isLiquidGlassSupported ? (
            <LiquidGlassView style={styles.menuCardGlass} effect="regular">
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
                <TouchableOpacity style={[styles.menuItem]} onPress={handleExitPress}>
                  <Text style={[styles.menuItemText, styles.exitButtonText]}>
                    Exit Project
                  </Text>
                </TouchableOpacity>
              )}
              {hasTools && (
                <>
                  <View style={styles.sectionDivider} />
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => setShowToolsModal(true)}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="grid-outline" size={18} color="#FF2A2A" />
                      <Text style={[styles.menuItemText, { color: "#FF2A2A" }]}>More Tools</Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={[
                  styles.menuItem,
                  styles.closeButton,
                  { justifyContent: "center" },
                ]}
                onPress={onClose}
              >
                <Text style={[styles.menuItemText, { color: "#9A9A9A" }]}>Close</Text>
              </TouchableOpacity>
            </LiquidGlassView>
          ) : (
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
              <TouchableOpacity style={[styles.menuItem]} onPress={handleExitPress}>
                <Text style={[styles.menuItemText, styles.exitButtonText]}>
                  Exit Project
                </Text>
              </TouchableOpacity>
            )}
            {hasTools && (
              <>
                <View style={styles.sectionDivider} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => setShowToolsModal(true)}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="grid-outline" size={18} color="#FF2A2A" />
                    <Text style={[styles.menuItemText, { color: "#FF2A2A" }]}>More Tools</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={[
                styles.menuItem,
                styles.closeButton,
                { justifyContent: "center" },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.menuItemText, { color: "#9A9A9A" }]}>Close</Text>
            </TouchableOpacity>
          </View>
          )}
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

      <ToolsModal
        visible={showToolsModal}
        onClose={() => setShowToolsModal(false)}
        items={toolItems}
      />
    </>
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
  menuCardGlass: {
    borderRadius: 20,
    padding: 20,
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
  sectionDivider: {
    height: 1,
    backgroundColor: "#333",
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
    color: "#F5F5F5",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  confirmText: {
    color: "#9A9A9A",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  confirmButton: {
    backgroundColor: "#2A2A2A",
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#F5F5F5",
    fontSize: 16,
    fontWeight: "600",
  },
  dangerButton: {
    backgroundColor: "#3A1515",
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
    color: "#9A9A9A",
    fontSize: 16,
  },
});

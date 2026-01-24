import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";

interface Member {
  id: string;
  display_name: string;
  email: string;
  role: string;
}

interface FilePermission {
  user_id: string;
  can_view: boolean;
  can_edit: boolean;
}

interface FolderSettings {
  default_can_view: boolean;
  default_can_edit: boolean;
  member_permissions: FilePermission[];
}

interface MyFolderSettingsModalProps {
  visible: boolean;
  projectId: string;
  members: Member[];
  currentUserId: string;
  onClose: () => void;
  onSave: (settings: FolderSettings) => void;
}

export default function MyFolderSettingsModal({
  visible,
  projectId: _projectId,
  members,
  currentUserId,
  onClose,
  onSave,
}: MyFolderSettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [defaultCanView, setDefaultCanView] = useState(true);
  const [defaultCanEdit, setDefaultCanEdit] = useState(false);
  const [memberPermissions, setMemberPermissions] = useState<
    Map<string, { canView: boolean; canEdit: boolean }>
  >(new Map());
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize member permissions
  useEffect(() => {
    const initialPermissions = new Map<
      string,
      { canView: boolean; canEdit: boolean }
    >();
    members.forEach((member) => {
      if (member.id !== currentUserId) {
        initialPermissions.set(member.id, {
          canView: defaultCanView,
          canEdit: defaultCanEdit,
        });
      }
    });
    setMemberPermissions(initialPermissions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, currentUserId]);

  const otherMembers = members.filter((m) => m.id !== currentUserId);

  const handleToggleView = (memberId: string) => {
    setMemberPermissions((prev) => {
      const updated = new Map(prev);
      const current = updated.get(memberId) || {
        canView: defaultCanView,
        canEdit: defaultCanEdit,
      };
      updated.set(memberId, { ...current, canView: !current.canView });
      // If removing view, also remove edit
      if (current.canView && !current.canEdit) {
        updated.set(memberId, { canView: false, canEdit: false });
      }
      return updated;
    });
  };

  const handleToggleEdit = (memberId: string) => {
    setMemberPermissions((prev) => {
      const updated = new Map(prev);
      const current = updated.get(memberId) || {
        canView: defaultCanView,
        canEdit: defaultCanEdit,
      };
      // If enabling edit, also enable view
      if (!current.canEdit) {
        updated.set(memberId, { canView: true, canEdit: true });
      } else {
        updated.set(memberId, { ...current, canEdit: false });
      }
      return updated;
    });
  };

  const handleApplyDefaultsToAll = () => {
    setMemberPermissions((prev) => {
      const updated = new Map(prev);
      otherMembers.forEach((member) => {
        updated.set(member.id, {
          canView: defaultCanView,
          canEdit: defaultCanEdit,
        });
      });
      return updated;
    });
    Alert.alert("Applied", "Default permissions applied to all members");
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const permissions: FilePermission[] = [];
      memberPermissions.forEach((perm, userId) => {
        permissions.push({
          user_id: userId,
          can_view: perm.canView,
          can_edit: perm.canEdit,
        });
      });

      await onSave({
        default_can_view: defaultCanView,
        default_can_edit: defaultCanEdit,
        member_permissions: permissions,
      });

      onClose();
    } catch {
      Alert.alert("Error", "Failed to save folder settings");
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>My Folder Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Default Permissions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Default Permissions</Text>
              <Text style={styles.sectionDescription}>
                These settings apply to new team members and files by default.
              </Text>

              <View style={styles.permissionRow}>
                <View style={styles.permissionInfo}>
                  <Text style={styles.permissionLabel}>Others can view</Text>
                  <Text style={styles.permissionHint}>
                    Team members can see your files
                  </Text>
                </View>
                <Switch
                  value={defaultCanView}
                  onValueChange={(value) => {
                    setDefaultCanView(value);
                    if (!value) setDefaultCanEdit(false);
                  }}
                  trackColor={{ false: "#2A2A2A", true: "#FF2A2A" }}
                  thumbColor="#F5F5F5"
                />
              </View>

              <View style={styles.permissionRow}>
                <View style={styles.permissionInfo}>
                  <Text style={styles.permissionLabel}>Others can edit</Text>
                  <Text style={styles.permissionHint}>
                    Team members can modify your files
                  </Text>
                </View>
                <Switch
                  value={defaultCanEdit}
                  onValueChange={setDefaultCanEdit}
                  disabled={!defaultCanView}
                  trackColor={{ false: "#2A2A2A", true: "#FF2A2A" }}
                  thumbColor={defaultCanView ? "#F5F5F5" : "#666"}
                />
              </View>
            </View>

            {/* Advanced: Per-Member Settings */}
            <TouchableOpacity
              style={styles.advancedToggle}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <Text style={styles.advancedToggleText}>
                {showAdvanced ? "▼" : "▶"} Per-Member Permissions
              </Text>
              <Text style={styles.advancedToggleHint}>
                Override defaults for specific members
              </Text>
            </TouchableOpacity>

            {showAdvanced && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.applyDefaultsButton}
                  onPress={handleApplyDefaultsToAll}
                >
                  <Text style={styles.applyDefaultsText}>Apply Defaults to All</Text>
                </TouchableOpacity>

                {otherMembers.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      No other members in this project
                    </Text>
                  </View>
                ) : (
                  otherMembers.map((member) => {
                    const perm = memberPermissions.get(member.id) || {
                      canView: defaultCanView,
                      canEdit: defaultCanEdit,
                    };

                    return (
                      <View key={member.id} style={styles.memberRow}>
                        <View style={styles.memberAvatar}>
                          <Text style={styles.memberAvatarText}>
                            {getInitials(member.display_name)}
                          </Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>
                            {member.display_name}
                          </Text>
                          <Text style={styles.memberRole}>{member.role}</Text>
                        </View>
                        <View style={styles.memberPermissions}>
                          <TouchableOpacity
                            style={[
                              styles.permBadge,
                              perm.canView && styles.permBadgeActive,
                            ]}
                            onPress={() => handleToggleView(member.id)}
                          >
                            <Text
                              style={[
                                styles.permBadgeText,
                                perm.canView && styles.permBadgeTextActive,
                              ]}
                            >
                              👁 View
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.permBadge,
                              perm.canEdit && styles.permBadgeActive,
                            ]}
                            onPress={() => handleToggleEdit(member.id)}
                          >
                            <Text
                              style={[
                                styles.permBadgeText,
                                perm.canEdit && styles.permBadgeTextActive,
                              ]}
                            >
                              ✏️ Edit
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#F5F5F5" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#2A2A2A",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#9A9A9A",
    fontSize: 14,
    fontWeight: "600",
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  sectionDescription: {
    fontSize: 13,
    color: "#9A9A9A",
    marginBottom: 16,
    lineHeight: 18,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  permissionInfo: {
    flex: 1,
    marginRight: 16,
  },
  permissionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 2,
  },
  permissionHint: {
    fontSize: 12,
    color: "#9A9A9A",
  },
  advancedToggle: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
    marginBottom: 16,
  },
  advancedToggleText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FF2A2A",
    marginBottom: 4,
  },
  advancedToggleHint: {
    fontSize: 12,
    color: "#9A9A9A",
  },
  applyDefaultsButton: {
    backgroundColor: "#2A2A2A",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  applyDefaultsText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F5F5F5",
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#9A9A9A",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF2A2A",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F5F5F5",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    color: "#9A9A9A",
    textTransform: "capitalize",
  },
  memberPermissions: {
    flexDirection: "row",
    gap: 6,
  },
  permBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "#333",
  },
  permBadgeActive: {
    backgroundColor: "rgba(255, 42, 42, 0.2)",
    borderColor: "#FF2A2A",
  },
  permBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9A9A9A",
  },
  permBadgeTextActive: {
    color: "#FF2A2A",
  },
  footer: {
    flexDirection: "row",
    padding: 20,
    paddingBottom: 36,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#F5F5F5",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#FF2A2A",
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F5F5F5",
  },
});

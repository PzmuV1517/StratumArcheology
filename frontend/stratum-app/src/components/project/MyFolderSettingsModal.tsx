/**
 * @file
 * Personal folder settings modal.
 *
 * Allows users to configure privacy and sharing settings
 * for their personal project folder.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
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
  Platform,
  Image,
} from "react-native";
import { showAlert } from "../../utils/alert";
import { IconSymbol } from "@/components/ui/icon-symbol";

const ACCENT_COLOR = "#FF2A2A";
const ACCENT_SOFT = "rgba(255, 42, 42, 0.18)";

interface Member {
  id: string;
  /**
   * @file
   * Permissions modal for files and folders.
   *
   * Provides a per-node ACL editor backed by the /acl endpoints.
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
  import React, { useEffect, useMemo, useState } from "react";
  import {
    ActivityIndicator,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
  } from "react-native";
  import { IconSymbol } from "@/components/ui/icon-symbol";
  import { showAlert } from "../../utils/alert";
  import { fileService } from "../../services/fileService";

  const ACCENT_COLOR = "#FF2A2A";
  const ACCENT_SOFT = "rgba(255, 42, 42, 0.18)";

  interface Member {
    id: string;
    display_name: string;
    email: string;
    role: string;
    photo_url?: string | null;
  }

  interface ACLPrincipalEntry {
    user_id?: string | null;
    group_id?: string | null;
    can_read: boolean;
    can_write: boolean;
    display_name?: string | null;
    photo_url?: string | null;
    role?: string | null;
  }

  interface ACLState {
    file_node_id: string;
    is_acl_root: boolean;
    inherits_from?: string | null;
    entries: ACLPrincipalEntry[];
  }

  interface PermissionsModalProps {
    visible: boolean;
    nodeId: string | null;
    nodeName?: string;
    members: Member[];
    currentUserId?: string;
    canManage?: boolean;
    onClose: () => void;
    onSaved?: () => void;
  }

  export default function PermissionsModal({
    visible,
    nodeId,
    nodeName,
    members,
    currentUserId,
    canManage = true,
    onClose,
    onSaved,
  }: PermissionsModalProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isAclRoot, setIsAclRoot] = useState(false);
    const [inheritsFrom, setInheritsFrom] = useState<string | null>(null);
    const [permissionsMap, setPermissionsMap] = useState<
      Map<string, { canRead: boolean; canWrite: boolean }>
    >(new Map());
    const [inheritedEntries, setInheritedEntries] = useState<
      ACLPrincipalEntry[]
    >([]);

    const otherMembers = useMemo(
      () => members.filter((m) => m.id !== currentUserId),
      [members, currentUserId],
    );

    useEffect(() => {
      if (!visible || !nodeId) return;
      setLoading(true);
      fileService
        .getAcl(nodeId)
        .then((state: ACLState) => {
          setIsAclRoot(state.is_acl_root);
          setInheritsFrom(state.inherits_from || null);
          setInheritedEntries(state.entries || []);
          const next = new Map<string, { canRead: boolean; canWrite: boolean }>();
          (state.entries || []).forEach((entry) => {
            if (!entry.user_id) return;
            next.set(entry.user_id, {
              canRead: !!entry.can_read,
              canWrite: !!entry.can_write,
            });
          });
          otherMembers.forEach((m) => {
            if (!next.has(m.id)) {
              next.set(m.id, { canRead: false, canWrite: false });
            }
          });
          setPermissionsMap(next);
        })
        .catch((error: any) => {
          console.error("Failed to load ACL:", error);
          showAlert(
            "Error",
            error.response?.data?.detail || "Failed to load permissions",
          );
        })
        .finally(() => setLoading(false));
    }, [visible, nodeId, otherMembers]);

    const handleToggleRead = (memberId: string) => {
      setPermissionsMap((prev) => {
        const updated = new Map(prev);
        const current = updated.get(memberId) || { canRead: false, canWrite: false };
        const nextRead = !current.canRead;
        updated.set(memberId, {
          canRead: nextRead,
          canWrite: nextRead ? current.canWrite : false,
        });
        return updated;
      });
    };

    const handleToggleWrite = (memberId: string) => {
      setPermissionsMap((prev) => {
        const updated = new Map(prev);
        const current = updated.get(memberId) || { canRead: false, canWrite: false };
        const nextWrite = !current.canWrite;
        updated.set(memberId, {
          canRead: nextWrite ? true : current.canRead,
          canWrite: nextWrite,
        });
        return updated;
      });
    };

    const handleSave = async () => {
      if (!nodeId) return;
      setSaving(true);
      try {
        const entries = Array.from(permissionsMap.entries())
          .filter(([, perm]) => perm.canRead || perm.canWrite)
          .map(([userId, perm]) => ({
            user_id: userId,
            can_read: perm.canRead || perm.canWrite,
            can_write: perm.canWrite,
          }));
        await fileService.putAcl(nodeId, {
          is_acl_root: isAclRoot,
          entries: isAclRoot ? entries : [],
        });
        onSaved?.();
        onClose();
      } catch (error: any) {
        console.error("Failed to save ACL:", error);
        showAlert(
          "Error",
          error.response?.data?.detail || "Failed to save permissions",
        );
      } finally {
        setSaving(false);
      }
    };

    const handleToggleInheritance = (value: boolean) => {
      // value === true means custom ACL (is_acl_root)
      setIsAclRoot(value);
      if (value && permissionsMap.size === 0 && inheritedEntries.length > 0) {
        const next = new Map<string, { canRead: boolean; canWrite: boolean }>();
        inheritedEntries.forEach((entry) => {
          if (!entry.user_id) return;
          next.set(entry.user_id, {
            canRead: !!entry.can_read,
            canWrite: !!entry.can_write,
          });
        });
        otherMembers.forEach((m) => {
          if (!next.has(m.id)) {
            next.set(m.id, { canRead: false, canWrite: false });
          }
        });
        setPermissionsMap(next);
      }
    };

    const getInitials = (name: string): string =>
      name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Permissions</Text>
                {!!nodeName && <Text style={styles.subtitle}>{nodeName}</Text>}
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close permissions"
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={ACCENT_COLOR} />
              </View>
            ) : (
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Access model</Text>
                  <Text style={styles.sectionDescription}>
                    {isAclRoot
                      ? "This item uses custom permissions."
                      : "This item inherits permissions from its parent."}
                  </Text>
                  <View style={styles.permissionRow}>
                    <View style={styles.permissionInfo}>
                      <Text style={styles.permissionLabel}>Custom permissions</Text>
                      <Text style={styles.permissionHint}>
                        Toggle off to inherit from the parent folder.
                      </Text>
                    </View>
                    <Switch
                      value={isAclRoot}
                      onValueChange={handleToggleInheritance}
                      disabled={!canManage}
                      trackColor={{ false: "#D9D9D9", true: ACCENT_COLOR }}
                      thumbColor="#FFFFFF"
                      accessibilityLabel="Toggle custom permissions"
                    />
                  </View>
                  {!canManage && (
                    <Text style={styles.noticeText}>
                      Only the project owner (or the owner of a personal folder)
                      can change permissions.
                    </Text>
                  )}
                  {!isAclRoot && inheritsFrom && (
                    <Text style={styles.inheritText}>
                      Inheriting from parent folder.
                    </Text>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>People</Text>
                  {otherMembers.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>
                        No other members in this project
                      </Text>
                    </View>
                  ) : (
                    otherMembers.map((member) => {
                      const perm = permissionsMap.get(member.id) || {
                        canRead: false,
                        canWrite: false,
                      };
                      return (
                        <View key={member.id} style={styles.memberRow}>
                          {member.photo_url ? (
                            <Image
                              source={{ uri: member.photo_url }}
                              style={styles.memberAvatarImage}
                            />
                          ) : (
                            <View style={styles.memberAvatar}>
                              <Text style={styles.memberAvatarText}>
                                {getInitials(member.display_name || member.email)}
                              </Text>
                            </View>
                          )}
                          <View style={styles.memberInfo}>
                            <Text style={styles.memberName}>
                              {member.display_name || member.email}
                            </Text>
                            <Text style={styles.memberRole}>{member.role}</Text>
                          </View>
                          <View style={styles.memberPermissions}>
                            <TouchableOpacity
                              style={[
                                styles.permBadge,
                                perm.canRead && styles.permBadgeActive,
                              ]}
                              onPress={() => handleToggleRead(member.id)}
                              disabled={!canManage || !isAclRoot}
                              accessibilityRole="button"
                              accessibilityLabel={`Toggle read permission for ${member.display_name}`}
                            >
                              <View style={styles.permBadgeContent}>
                                <IconSymbol
                                  name="eye"
                                  size={13}
                                  color={perm.canRead ? ACCENT_COLOR : "#666666"}
                                />
                                <Text
                                  style={[
                                    styles.permBadgeText,
                                    perm.canRead && styles.permBadgeTextActive,
                                  ]}
                                >
                                  Read
                                </Text>
                              </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.permBadge,
                                perm.canWrite && styles.permBadgeActive,
                              ]}
                              onPress={() => handleToggleWrite(member.id)}
                              disabled={!canManage || !isAclRoot}
                              accessibilityRole="button"
                              accessibilityLabel={`Toggle write permission for ${member.display_name}`}
                            >
                              <View style={styles.permBadgeContent}>
                                <IconSymbol
                                  name="pencil"
                                  size={13}
                                  color={perm.canWrite ? ACCENT_COLOR : "#666666"}
                                />
                                <Text
                                  style={[
                                    styles.permBadgeText,
                                    perm.canWrite && styles.permBadgeTextActive,
                                  ]}
                                >
                                  Write
                                </Text>
                              </View>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            )}

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel permissions changes"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (saving || !canManage) && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving || !canManage}
                accessibilityRole="button"
                accessibilityLabel="Save permissions"
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
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
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalContainer: {
      backgroundColor: "#FFFFFF",
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: "85%",
      paddingBottom: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: "#F0F0F0",
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: "#1A1A1A",
    },
    subtitle: {
      fontSize: 12,
      color: "#777777",
      marginTop: 4,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "#F2F2F2",
      alignItems: "center",
      justifyContent: "center",
    },
    closeButtonText: {
      fontSize: 18,
      color: "#666666",
    },
    loadingState: {
      paddingVertical: 32,
      alignItems: "center",
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: "#1A1A1A",
      marginBottom: 6,
    },
    sectionDescription: {
      fontSize: 13,
      color: "#666666",
      marginBottom: 12,
      lineHeight: 18,
    },
    permissionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    permissionInfo: {
      flex: 1,
      marginRight: 12,
    },
    permissionLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: "#1A1A1A",
    },
    permissionHint: {
      fontSize: 12,
      color: "#777777",
      marginTop: 2,
    },
    noticeText: {
      fontSize: 12,
      color: "#B05A00",
      marginTop: 8,
    },
    inheritText: {
      fontSize: 12,
      color: "#888888",
      marginTop: 4,
    },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: "#F0F0F0",
    },
    memberAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "#EAEAEA",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    memberAvatarImage: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginRight: 12,
    },
    memberAvatarText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#666666",
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 14,
      fontWeight: "600",
      color: "#1A1A1A",
    },
    memberRole: {
      fontSize: 11,
      color: "#888888",
      marginTop: 2,
    },
    memberPermissions: {
      flexDirection: "row",
      gap: 6,
    },
    permBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: "#F2F2F2",
      borderWidth: 1,
      borderColor: "#E0E0E0",
    },
    permBadgeActive: {
      backgroundColor: ACCENT_SOFT,
      borderColor: ACCENT_COLOR,
    },
    permBadgeContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    permBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: "#666666",
    },
    permBadgeTextActive: {
      color: ACCENT_COLOR,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 20,
    },
    emptyStateText: {
      fontSize: 13,
      color: "#777777",
    },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: "#F0F0F0",
    },
    cancelButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      backgroundColor: "#F2F2F2",
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#666666",
    },
    saveButton: {
      paddingVertical: 12,
      paddingHorizontal: 32,
      borderRadius: 8,
      backgroundColor: ACCENT_COLOR,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#FFFFFF",
    },
  });

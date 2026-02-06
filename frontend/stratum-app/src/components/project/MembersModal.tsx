import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Image,
  Clipboard,
  ActivityIndicator,
} from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { projectService } from "../../services/projectService";
import api from "../../services/api";
import { showAlert } from "../../utils/alert";

interface Member {
  id: string;
  display_name: string;
  email: string;
  role: "LEADER" | "RESEARCHER" | "GUEST" | "leader" | "researcher" | "guest";
  photo_url?: string;
  bio?: string;
}

interface Props {
  visible: boolean;
  members: Member[];
  onClose: () => void;
  onManage: () => void;
  renderMember: (member: Member) => React.ReactNode;
  projectId: string;
  currentUserId?: string;
  projectOwnerId?: string;
  onKicked?: () => void; // Called when current user is kicked
}

export default function MembersModal({
  visible,
  members,
  onClose,
  onManage,
  renderMember,
  projectId,
  currentUserId,
  projectOwnerId,
  onKicked,
}: Props) {
  const ownerId =
    projectOwnerId ||
    members.find((m) => (m.role || "").toString().toUpperCase() === "LEADER")?.id ||
    null;

  // Get current user's role
  const currentUserRole = useMemo(() => {
    if (!currentUserId) return null;
    if (currentUserId === ownerId) return "LEADER";
    const member = members.find((m) => m.id === currentUserId);
    return member ? (member.role || "").toString().toUpperCase() : null;
  }, [currentUserId, ownerId, members]);

  const isOwner = currentUserRole === "LEADER";
  const isResearcher = currentUserRole === "RESEARCHER";
  const canManage = isOwner || isResearcher; // Both can manage, but with different permissions

  const [inviteRole, setInviteRole] = useState<"RESEARCHER" | "GUEST">("GUEST");
  const [inviteMaxUses, setInviteMaxUses] = useState<number | null>(null); // null = unlimited
  const [inviteTtlHours, setInviteTtlHours] = useState<number>(336); // 14 days default
  const appOrigin =
    Platform.OS === "web"
      ? typeof window !== "undefined"
        ? window.location.origin
        : ""
      : "";

  const [manageError, setManageError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatedExpiresAt, setGeneratedExpiresAt] = useState<string | null>(null);
  const [generatedMaxUses, setGeneratedMaxUses] = useState<number | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState<string | null>(
    null,
  );
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);
  const [showRoleChangeConfirm, setShowRoleChangeConfirm] = useState<{
    userId: string;
    newRole: "RESEARCHER" | "GUEST";
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Profile viewing state
  const [viewingProfile, setViewingProfile] = useState<{
    id: string;
    display_name: string;
    email: string;
    photo_url?: string;
    bio?: string;
    role: string;
  } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Fetch and show user profile
  const viewProfile = async (member: Member) => {
    setLoadingProfile(true);
    setViewingProfile({
      id: member.id,
      display_name: member.display_name,
      email: member.email,
      photo_url: member.photo_url,
      bio: member.bio,
      role: getMemberRole(member),
    });
    
    // Try to fetch the full profile with bio if not already present
    if (!member.bio && !member.photo_url) {
      try {
        const response = await api.get(`/auth/users/${member.id}`);
        setViewingProfile({
          id: member.id,
          display_name: response.data.display_name || member.display_name,
          email: response.data.email || member.email,
          photo_url: response.data.photo_url,
          bio: response.data.bio,
          role: getMemberRole(member),
        });
      } catch (e) {
        // Ignore errors, just show what we have
        console.log("Could not fetch full profile:", e);
      }
    }
    setLoadingProfile(false);
  };

  // Role hierarchy for permission checks
  const roleHierarchy: Record<string, number> = {
    LEADER: 3,
    RESEARCHER: 2,
    GUEST: 1,
  };

  // Get member's normalized role
  const getMemberRole = (member: Member): string => {
    return (member.role || "").toString().toUpperCase();
  };

  // Check if current user can manage a specific member
  const canManageMember = (member: Member): boolean => {
    if (!canManage) return false;
    if (member.id === currentUserId) return false; // Can't manage yourself
    if (member.id === ownerId) return false; // Can't manage the owner

    const memberRole = getMemberRole(member);
    const myRole = currentUserRole || "";

    // Can only manage members with lower roles
    return roleHierarchy[myRole] > roleHierarchy[memberRole];
  };

  // Check if current user can kick a member
  const canKickMember = (member: Member): boolean => {
    if (!canManageMember(member)) return false;
    const memberRole = getMemberRole(member);

    // Leaders can kick anyone below them
    if (isOwner) return memberRole !== "LEADER";

    // Researchers can only kick guests
    if (isResearcher) return memberRole === "GUEST";

    return false;
  };

  // Check if current user can change a member's role
  const canChangeRoleOf = (member: Member): boolean => {
    return canManageMember(member);
  };

  // Get available role options for a member
  const getAvailableRoles = (member: Member): string[] => {
    const memberRole = getMemberRole(member);

    if (isOwner) {
      // Leaders can set any role except leader (that's transfer)
      return ["RESEARCHER", "GUEST"].filter((r) => r !== memberRole);
    }

    if (isResearcher) {
      // Researchers can only toggle guests to researcher
      if (memberRole === "GUEST") return ["RESEARCHER"];
      return [];
    }

    return [];
  };

  const confirmRoleChange = (userId: string, role: "RESEARCHER" | "GUEST") => {
    setShowRoleChangeConfirm({ userId, newRole: role });
  };

  const executeRoleChange = async () => {
    if (!showRoleChangeConfirm) return;
    const { userId, newRole } = showRoleChangeConfirm;
    try {
      setManageError(null);
      await projectService.updateMemberRole(
        projectId,
        userId,
        newRole.toLowerCase(),
      );
      setExpandedMemberId(null);
      setShowRoleChangeConfirm(null);
      onManage();
    } catch (e: any) {
      setManageError(e?.detail || e?.message || "Failed to update role");
      setShowRoleChangeConfirm(null);
    }
  };

  const confirmRemoveMember = (userId: string) => {
    setShowRemoveConfirm(userId);
  };

  const executeRemoveMember = async () => {
    if (!showRemoveConfirm) return;
    const userId = showRemoveConfirm;
    try {
      setManageError(null);
      await projectService.removeMember(projectId, userId);
      setExpandedMemberId(null);
      setShowRemoveConfirm(null);

      // If the current user was kicked, trigger the callback
      if (userId === currentUserId && onKicked) {
        onKicked();
      }

      onManage();
    } catch (e: any) {
      setManageError(e?.detail || e?.message || "Failed to remove member");
      setShowRemoveConfirm(null);
    }
  };

  const handleTransferOwnership = async (newOwnerId: string) => {
    try {
      setManageError(null);
      await projectService.transferOwnership(projectId, newOwnerId);
      setShowTransferConfirm(null);
      setExpandedMemberId(null);
      onManage();

      // Show success message
      if (Platform.OS === "web") {
        alert("Ownership transferred successfully. You are now a researcher.");
      } else {
        showAlert(
          "Success",
          "Ownership transferred successfully. You are now a researcher.",
        );
      }
    } catch (e: any) {
      setManageError(e?.detail || e?.message || "Failed to transfer ownership");
    }
  };

  const generateInvite = async () => {
    try {
      setManageError(null);
      setIsGenerating(true);
      setGeneratedLink(null);
      setGeneratedCode(null);
      setCopiedLink(false);
      setCopiedCode(false);
      const resp = await projectService.createInvite(
        projectId,
        inviteRole.toLowerCase(),
        inviteTtlHours,
        inviteMaxUses,
      );
      const link = `${appOrigin || "stratum://app"}${resp.accept_path}`;
      setGeneratedLink(link);
      setGeneratedCode(resp.code || null);
      setGeneratedExpiresAt(resp.expires_at || (null as any));
      setGeneratedMaxUses(resp.max_uses ?? null);
    } catch (e: any) {
      setManageError(e?.detail || e?.message || "Failed to generate invite");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedLink) return;

    try {
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(generatedLink);
      } else {
        Clipboard.setString(generatedLink);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const copyCodeToClipboard = async () => {
    if (!generatedCode) return;

    try {
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(generatedCode);
      } else {
        Clipboard.setString(generatedCode);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const toggleMemberExpand = (memberId: string) => {
    if (expandedMemberId === memberId) {
      setExpandedMemberId(null);
    } else {
      setExpandedMemberId(memberId);
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    const upperRole = role.toUpperCase();
    switch (upperRole) {
      case "LEADER":
        return { backgroundColor: "#FF2A2A" };
      case "RESEARCHER":
        return { backgroundColor: "#2A7FFF" };
      case "GUEST":
        return { backgroundColor: "#666" };
      default:
        return { backgroundColor: "#333" };
    }
  };

  // GlassCard wrapper for iOS 26+ Liquid Glass effect
  const GlassCard = ({ children, style }: { children: React.ReactNode; style?: any }) => {
    // Use native Liquid Glass on iOS 26+ if available
    if (isLiquidGlassAvailable()) {
      return (
        <GlassView
          style={[styles.modalCard, styles.glassCard, style]}
          glassEffectStyle="regular"
        >
          {children}
        </GlassView>
      );
    }
    // Fallback to regular View on other platforms
    return <View style={[styles.modalCard, style]}>{children}</View>;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <GlassCard style={{ maxHeight: "85%" }}>
          <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
            <Text style={styles.sectionTitle}>Team Members</Text>
            {canManage && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setIsManaging(!isManaging)}
              >
                <Text style={styles.actionButtonText}>
                  {isManaging ? "✓ Done" : "⚙ Manage"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={true}>
            {members.length > 0 ? (
              members.map((m) => {
                const memberRole = getMemberRole(m);
                const canManageThis = canManageMember(m);
                const isExpanded = expandedMemberId === m.id && isManaging;

                return (
                  <View key={m.id} style={styles.memberCard}>
                    <TouchableOpacity
                      style={styles.memberRow}
                      onPress={() => {
                        if (isManaging && canManageThis) {
                          toggleMemberExpand(m.id);
                        } else if (!isManaging) {
                          viewProfile(m);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.memberInfo}>{renderMember(m)}</View>
                      <View
                        style={[styles.roleBadge, getRoleBadgeStyle(memberRole)]}
                      >
                        <Text style={styles.roleBadgeText}>{memberRole}</Text>
                      </View>
                      {isManaging && canManageThis && (
                        <Text style={styles.expandIcon}>
                          {isExpanded ? "▲" : "▼"}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {/* Expanded management options */}
                    {isExpanded && (
                      <View style={styles.memberActions}>
                        {/* Role change buttons */}
                        {canChangeRoleOf(m) &&
                          getAvailableRoles(m).length > 0 &&
                          getAvailableRoles(m).map((role) => (
                            <TouchableOpacity
                              key={role}
                              style={styles.actionBtn}
                              onPress={() =>
                                confirmRoleChange(
                                  m.id,
                                  role as "RESEARCHER" | "GUEST",
                                )
                              }
                            >
                              <Text style={styles.actionBtnText}>
                                Make {role.charAt(0) + role.slice(1).toLowerCase()}
                              </Text>
                            </TouchableOpacity>
                          ))}

                        {/* Transfer ownership button (leader only) */}
                        {isOwner && (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.transferBtn]}
                            onPress={() => setShowTransferConfirm(m.id)}
                          >
                            <Text style={styles.actionBtnText}>
                              Transfer Leadership
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* Remove button */}
                        {canKickMember(m) && (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.dangerBtn]}
                            onPress={() => confirmRemoveMember(m.id)}
                          >
                            <Text style={styles.actionBtnText}>
                              Remove from Project
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* If no actions available, show info */}
                        {!canChangeRoleOf(m) && !isOwner && !canKickMember(m) && (
                          <Text style={styles.noActionsText}>
                            No actions available
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No team members</Text>
                <Text style={styles.emptyStateSubtext}>
                  Invite colleagues to collaborate
                </Text>
              </View>
            )}

          {/* Transfer ownership confirmation modal */}
          {showTransferConfirm && (
            <View style={styles.confirmOverlay}>
              <View style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>⚠️ Transfer Ownership</Text>
                <Text style={styles.confirmText}>
                  Are you sure you want to transfer project leadership to{" "}
                  <Text style={styles.confirmHighlight}>
                    {members.find((m) => m.id === showTransferConfirm)
                      ?.display_name || "this member"}
                  </Text>
                  ?
                </Text>
                <Text style={styles.confirmWarning}>
                  You will become a researcher and lose owner permissions.
                </Text>
                <View style={styles.confirmButtons}>
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.cancelBtn]}
                    onPress={() => setShowTransferConfirm(null)}
                  >
                    <Text style={styles.confirmBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.dangerBtn]}
                    onPress={() => handleTransferOwnership(showTransferConfirm)}
                  >
                    <Text style={styles.confirmBtnText}>Confirm Transfer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Remove member confirmation modal */}
          {showRemoveConfirm && (
            <View style={styles.confirmOverlay}>
              <View style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>⚠️ Remove Member</Text>
                <Text style={styles.confirmText}>
                  Are you sure you want to remove{" "}
                  <Text style={styles.confirmHighlight}>
                    {members.find((m) => m.id === showRemoveConfirm)?.display_name ||
                      "this member"}
                  </Text>{" "}
                  from the project?
                </Text>
                <Text style={styles.confirmWarning}>
                  They will lose access to all project data.
                </Text>
                <View style={styles.confirmButtons}>
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.cancelBtn]}
                    onPress={() => setShowRemoveConfirm(null)}
                  >
                    <Text style={styles.confirmBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.dangerBtn]}
                    onPress={executeRemoveMember}
                  >
                    <Text style={styles.confirmBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Role change confirmation modal */}
          {showRoleChangeConfirm && (
            <View style={styles.confirmOverlay}>
              <View style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>Change Role</Text>
                <Text style={styles.confirmText}>
                  Change{" "}
                  <Text style={styles.confirmHighlight}>
                    {members.find((m) => m.id === showRoleChangeConfirm.userId)
                      ?.display_name || "this member"}
                  </Text>
                  's role to{" "}
                  <Text style={styles.confirmHighlight}>
                    {showRoleChangeConfirm.newRole.charAt(0) +
                      showRoleChangeConfirm.newRole.slice(1).toLowerCase()}
                  </Text>
                  ?
                </Text>
                <View style={styles.confirmButtons}>
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.cancelBtn]}
                    onPress={() => setShowRoleChangeConfirm(null)}
                  >
                    <Text style={styles.confirmBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, { backgroundColor: "#2A7FFF" }]}
                    onPress={executeRoleChange}
                  >
                    <Text style={styles.confirmBtnText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Profile view modal */}
          {viewingProfile && (
            <View style={styles.confirmOverlay}>
              <View style={styles.profileCard}>
                <TouchableOpacity
                  style={styles.profileCloseBtn}
                  onPress={() => setViewingProfile(null)}
                >
                  <Text style={styles.profileCloseBtnText}>✕</Text>
                </TouchableOpacity>
                
                {loadingProfile ? (
                  <ActivityIndicator size="large" color="#FF2A2A" style={{ marginVertical: 40 }} />
                ) : (
                  <>
                    {/* Profile picture */}
                    <View style={styles.profileImageContainer}>
                      {viewingProfile.photo_url ? (
                        <Image
                          source={{ uri: viewingProfile.photo_url }}
                          style={styles.profileImage}
                        />
                      ) : (
                        <View style={styles.profilePlaceholder}>
                          <Text style={styles.profilePlaceholderText}>
                            {viewingProfile.display_name?.charAt(0).toUpperCase() || "U"}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Name and role */}
                    <Text style={styles.profileName}>{viewingProfile.display_name}</Text>
                    <View style={[styles.profileRoleBadge, getRoleBadgeStyle(viewingProfile.role)]}>
                      <Text style={styles.profileRoleBadgeText}>{viewingProfile.role}</Text>
                    </View>

                    {/* Bio */}
                    {viewingProfile.bio ? (
                      <Text style={styles.profileBio}>{viewingProfile.bio}</Text>
                    ) : (
                      <Text style={styles.profileBioEmpty}>No bio added</Text>
                    )}

                    {/* Email */}
                    <Text style={styles.profileEmail}>{viewingProfile.email}</Text>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Invite section (leaders only) */}
          {isOwner && (
            <View style={styles.inviteSection}>
              <Text style={styles.inviteTitle}>Invite to project</Text>
              
              {/* Role selector */}
              <Text style={styles.inviteSubtitle}>Role</Text>
              <View style={styles.roleSelector}>
                <TouchableOpacity
                  style={[
                    styles.roleBtn,
                    inviteRole === "GUEST" && styles.roleBtnActive,
                  ]}
                  onPress={() => setInviteRole("GUEST")}
                >
                  <Text style={styles.roleBtnText}>Guest</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleBtn,
                    inviteRole === "RESEARCHER" && styles.roleBtnActive,
                  ]}
                  onPress={() => setInviteRole("RESEARCHER")}
                >
                  <Text style={styles.roleBtnText}>Researcher</Text>
                </TouchableOpacity>
              </View>

              {/* Expiration selector */}
              <Text style={styles.inviteSubtitle}>Expires after</Text>
              <View style={styles.roleSelector}>
                <TouchableOpacity
                  style={[
                    styles.roleBtn,
                    inviteTtlHours === 24 && styles.roleBtnActive,
                  ]}
                  onPress={() => setInviteTtlHours(24)}
                >
                  <Text style={styles.roleBtnText}>1 day</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleBtn,
                    inviteTtlHours === 168 && styles.roleBtnActive,
                  ]}
                  onPress={() => setInviteTtlHours(168)}
                >
                  <Text style={styles.roleBtnText}>7 days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleBtn,
                    inviteTtlHours === 336 && styles.roleBtnActive,
                  ]}
                  onPress={() => setInviteTtlHours(336)}
                >
                  <Text style={styles.roleBtnText}>14 days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleBtn,
                    inviteTtlHours === 720 && styles.roleBtnActive,
                  ]}
                  onPress={() => setInviteTtlHours(720)}
                >
                  <Text style={styles.roleBtnText}>30 days</Text>
                </TouchableOpacity>
              </View>

              {/* Max uses selector */}
              <Text style={styles.inviteSubtitle}>Max uses</Text>
              <View style={styles.roleSelector}>
                <TouchableOpacity
                  style={[
                    styles.roleBtn,
                    inviteMaxUses === 1 && styles.roleBtnActive,
                  ]}
                  onPress={() => setInviteMaxUses(1)}
                >
                  <Text style={styles.roleBtnText}>1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleBtn,
                    inviteMaxUses === 5 && styles.roleBtnActive,
                  ]}
                  onPress={() => setInviteMaxUses(5)}
                >
                  <Text style={styles.roleBtnText}>5</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleBtn,
                    inviteMaxUses === 10 && styles.roleBtnActive,
                  ]}
                  onPress={() => setInviteMaxUses(10)}
                >
                  <Text style={styles.roleBtnText}>10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleBtn,
                    inviteMaxUses === null && styles.roleBtnActive,
                  ]}
                  onPress={() => setInviteMaxUses(null)}
                >
                  <Text style={styles.roleBtnText}>∞</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.generateBtn,
                  isGenerating && styles.generateBtnDisabled,
                ]}
                onPress={generateInvite}
                disabled={isGenerating}
              >
                <Text style={styles.generateBtnText}>
                  {isGenerating ? "Generating…" : "Generate Invite Link"}
                </Text>
              </TouchableOpacity>

              {generatedLink && (
                <View style={styles.linkContainer}>
                  {/* Close button */}
                  <TouchableOpacity
                    style={styles.inviteCloseBtn}
                    onPress={() => {
                      setGeneratedLink(null);
                      setGeneratedCode(null);
                      setGeneratedExpiresAt(null);
                      setGeneratedMaxUses(null);
                      setCopiedLink(false);
                      setCopiedCode(false);
                    }}
                  >
                    <Text style={styles.inviteCloseBtnText}>✕</Text>
                  </TouchableOpacity>

                  {/* Invite Code Section */}
                  {generatedCode && (
                    <View style={styles.codeSection}>
                      <Text style={styles.codeSectionLabel}>Invite Code</Text>
                      <View style={styles.codeRow}>
                        <Text selectable style={styles.codeText}>
                          {generatedCode}
                        </Text>
                        <TouchableOpacity
                          style={styles.copyCodeBtn}
                          onPress={copyCodeToClipboard}
                        >
                          <Text style={styles.copyBtnText}>
                            {copiedCode ? "✓" : "📋"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Invite Link Section */}
                  <Text style={styles.codeSectionLabel}>Invite Link</Text>
                  <Text selectable style={styles.linkText} numberOfLines={2}>
                    {generatedLink}
                  </Text>
                  <TouchableOpacity style={styles.copyBtn} onPress={copyToClipboard}>
                    <Text style={styles.copyBtnText}>
                      {copiedLink ? "✓ Copied!" : "📋 Copy Link"}
                    </Text>
                  </TouchableOpacity>

                  {Platform.OS === "web" && (
                    <Image
                      source={{
                        uri: `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(generatedLink)}`,
                      }}
                      style={styles.qrCode}
                    />
                  )}
                  {generatedExpiresAt && (
                    <Text style={styles.expiresText}>
                      Expires: {new Date(generatedExpiresAt).toLocaleString()}
                    </Text>
                  )}
                  <Text style={styles.expiresText}>
                    Max uses: {generatedMaxUses ?? "Unlimited"}
                  </Text>
                </View>
              )}

              <Text style={styles.inviteHint}>
                Share the invite code or link. Recipient must be signed in to accept.
              </Text>
            </View>
          )}

          {manageError && <Text style={styles.errorText}>{manageError}</Text>}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#1A1A18",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333",
    width: "100%",
    maxWidth: 600,
  },
  glassCard: {
    backgroundColor: "rgba(26, 26, 24, 0.75)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
    letterSpacing: 0.5,
  },
  actionButton: {
    backgroundColor: "#FF2A2A",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionButtonText: {
    fontSize: 13,
    color: "#F5F5F5",
    fontWeight: "600",
  },
  memberCard: {
    backgroundColor: "#252522",
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#333",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  memberInfo: {
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  roleBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  expandIcon: {
    color: "#888",
    fontSize: 12,
    marginLeft: 8,
  },
  memberActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#333",
    backgroundColor: "#1E1E1C",
  },
  actionBtn: {
    backgroundColor: "#333",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    color: "#F5F5F5",
    fontSize: 12,
    fontWeight: "500",
  },
  transferBtn: {
    backgroundColor: "#B8860B",
  },
  dangerBtn: {
    backgroundColor: "#8B0000",
  },
  noActionsText: {
    color: "#666",
    fontSize: 12,
    fontStyle: "italic",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: "#888",
  },
  confirmOverlay: {
    position: "absolute",
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    padding: 20,
    zIndex: 10,
  },
  confirmCard: {
    backgroundColor: "#252522",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#444",
    width: "100%",
    maxWidth: 320,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF2A2A",
    marginBottom: 12,
    textAlign: "center",
  },
  confirmText: {
    fontSize: 14,
    color: "#CCC",
    textAlign: "center",
    marginBottom: 8,
  },
  confirmHighlight: {
    color: "#FFF",
    fontWeight: "600",
  },
  confirmWarning: {
    fontSize: 12,
    color: "#FF6B6B",
    textAlign: "center",
    marginBottom: 16,
    fontStyle: "italic",
  },
  confirmButtons: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
  },
  confirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
  },
  cancelBtn: {
    backgroundColor: "#444",
  },
  confirmBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  inviteSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  inviteTitle: {
    color: "#F5F5F5",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
  },
  inviteSubtitle: {
    color: "#AAA",
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 6,
    marginTop: 4,
  },
  roleSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  roleBtn: {
    backgroundColor: "#333",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  roleBtnActive: {
    backgroundColor: "#FF2A2A",
  },
  roleBtnText: {
    color: "#F5F5F5",
    fontSize: 13,
    fontWeight: "500",
  },
  generateBtn: {
    backgroundColor: "#FF2A2A",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  linkContainer: {
    marginTop: 12,
    backgroundColor: "#1E1E1C",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    position: "relative",
  },
  inviteCloseBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  inviteCloseBtnText: {
    color: "#999",
    fontSize: 16,
    fontWeight: "600",
  },
  codeSection: {
    width: "100%",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    alignItems: "center",
  },
  codeSectionLabel: {
    color: "#888",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    alignSelf: "flex-start",
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  codeText: {
    color: "#F5F5F5",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  copyCodeBtn: {
    backgroundColor: "#333",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  linkText: {
    color: "#9A9A9A",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
  },
  copyBtn: {
    backgroundColor: "#333",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  copyBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "500",
  },
  qrCode: {
    width: 140,
    height: 140,
    borderRadius: 8,
    marginTop: 8,
  },
  expiresText: {
    color: "#666",
    fontSize: 11,
    marginTop: 8,
  },
  inviteHint: {
    color: "#666",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  errorText: {
    color: "#FF2A2A",
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },
  footer: {
    alignItems: "flex-end",
    marginTop: 16,
  },
  closeBtn: {
    backgroundColor: "#333",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  closeBtnText: {
    color: "#F5F5F5",
    fontSize: 14,
    fontWeight: "600",
  },
  // Profile view styles
  profileCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    minWidth: 280,
    maxWidth: 320,
    borderWidth: 1,
    borderColor: "#333",
    position: "relative",
  },
  profileCloseBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  profileCloseBtnText: {
    color: "#F5F5F5",
    fontSize: 16,
  },
  profileImageContainer: {
    marginBottom: 16,
    marginTop: 8,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#FF2A2A",
  },
  profilePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FF2A2A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FF2A2A",
  },
  profilePlaceholderText: {
    color: "#FFF",
    fontSize: 40,
    fontWeight: "700",
  },
  profileName: {
    color: "#F5F5F5",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  profileRoleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  profileRoleBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  profileBio: {
    color: "#CCC",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  profileBioEmpty: {
    color: "#666",
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 16,
  },
  profileEmail: {
    color: "#888",
    fontSize: 12,
    textAlign: "center",
  },
});

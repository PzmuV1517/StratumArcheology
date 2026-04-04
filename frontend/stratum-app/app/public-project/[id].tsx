/**
 * @file
 * Public project detail screen (read-only).
 *
 * Shows a hero banner, project name, description, team members,
 * GPS site bounds, and creation date. Accessible from the Unearthed
 * (explore) tab without requiring project membership.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { projectService } from "@/services/projectService";
import MapEditor from "@/components/map/MapEditor";
import type {
  ProjectMember,
  PublicProjectDetail,
} from "@/services/projectService.types";
import { useColorScheme } from "@/hooks/use-color-scheme";

const goBack = (router: ReturnType<typeof useRouter>) => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(tabs)/explore");
  }
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function PublicProjectDetailScreen() {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const errorIconColor = isDarkMode ? "#555555" : "#A0A0A0";
  const emptyHeroIconColor = isDarkMode ? "#444444" : "#B5B5B5";
  const heroMembersIconColor = isDarkMode ? "#CCCCCC" : "#555555";
  const floatingBackIconColor = isDarkMode ? "#FFFFFF" : "#1A1A1A";
  const memberChevronColor = isDarkMode ? "#666666" : "#999999";
  const heroGradientColors = isDarkMode
    ? (["transparent", "rgba(17,17,17,0.85)", "#111111"] as const)
    : (["transparent", "rgba(247,247,247,0.82)", "#F7F7F7"] as const);

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [project, setProject] = useState<PublicProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await projectService.getPublicProject(id);
      setProject(data);
    } catch (e: any) {
      setError(e?.detail || "Could not load project");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Loading / Error states ──────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator size="large" color="#FF2A2A" />
      </View>
    );
  }

  if (error || !project) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 60 }]}>
        <IconSymbol
          name="exclamationmark.triangle.fill"
          size={48}
          color={errorIconColor}
        />
        <Text style={styles.errorTitle}>{error ?? "Project not found"}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBack(router)}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  const createdDate = new Date(project.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hasGps = !!(project.gps?.work?.points?.length || project.gps?.sites?.length);

  const roleLabel = (role: string) => {
    switch (role) {
      case "leader":
      case "owner":
        return "Leader";
      case "researcher":
        return "Researcher";
      case "editor":
        return "Editor";
      case "viewer":
        return "Viewer";
      default:
        return "Guest";
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        bounces
      >
        {/* ── Hero banner ──────────────────────────────────────────── */}
        <View style={styles.heroContainer}>
          {project.cover_image_url ? (
            <Image
              source={{ uri: project.cover_image_url }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <IconSymbol
                name="mountain.2.fill"
                size={56}
                color={emptyHeroIconColor}
              />
            </View>
          )}

          {/* gradient overlay so the text reads well */}
          <LinearGradient colors={heroGradientColors} style={styles.heroGradient} />

          {/* Project name overlaid on the image */}
          <View style={[styles.heroTextContainer, { paddingTop: insets.top + 8 }]}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {project.name}
            </Text>
            {project.member_count != null && project.member_count > 0 && (
              <View style={styles.heroBadge}>
                <IconSymbol
                  name="person.2.fill"
                  size={14}
                  color={heroMembersIconColor}
                />
                <Text style={styles.heroBadgeText}>
                  {project.member_count} member
                  {project.member_count !== 1 ? "s" : ""}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Info cards ───────────────────────────────────────────── */}
        <View style={styles.content}>
          {/* Description */}
          {project.description ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>About this Site</Text>
              <Text style={styles.cardBody}>{project.description}</Text>
            </View>
          ) : null}

          {/* Details row */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Details</Text>

            <InfoRow
              styles={styles}
              icon="calendar"
              label="Created"
              value={createdDate}
            />

            {project.ran_lmi_id ? (
              <InfoRow
                styles={styles}
                icon="number"
                label="RAN / LMI"
                value={project.ran_lmi_id}
              />
            ) : null}
          </View>

          {/* Team members */}
          {project.members && project.members.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Team</Text>
              {[...project.members]
                .sort((a, b) => {
                  const order: Record<string, number> = {
                    leader: 0,
                    owner: 0,
                    researcher: 1,
                    editor: 1,
                    guest: 2,
                    viewer: 2,
                  };
                  return (order[a.role] ?? 3) - (order[b.role] ?? 3);
                })
                .map((member) => (
                  <MemberRow
                    key={member.user_id ?? member.email}
                    styles={styles}
                    chevronColor={memberChevronColor}
                    member={member}
                    roleLabel={roleLabel}
                    onPress={
                      member.user_id || member.id
                        ? () =>
                            router.push({
                              pathname: "/profile/[userId]",
                              params: {
                                userId: String(member.user_id || member.id),
                              },
                            })
                        : undefined
                    }
                  />
                ))}
            </View>
          )}

          {/* ── Map card — reuses the same MapEditor as the project GPS tab ── */}
          {hasGps && project.id && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Site Map</Text>
              <View style={styles.mapContainer}>
                <MapEditor projectId={project.id} canEdit={false} />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Floating back button ───────────────────────────────── */}
      <TouchableOpacity
        style={[styles.floatingBack, { top: insets.top + 8 }]}
        onPress={() => goBack(router)}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <IconSymbol
          name="chevron.backward"
          size={20}
          color={floatingBackIconColor}
        />
      </TouchableOpacity>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

type PublicProjectStyles = ReturnType<typeof createStyles>;

function InfoRow({
  styles,
  icon,
  label,
  value,
}: {
  styles: PublicProjectStyles;
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <IconSymbol
        name={icon as any}
        size={16}
        color="#FF2A2A"
        style={{ marginRight: 10, marginTop: 2 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function MemberRow({
  styles,
  chevronColor,
  member,
  roleLabel,
  onPress,
}: {
  styles: PublicProjectStyles;
  chevronColor: string;
  member: ProjectMember;
  roleLabel: (r: string) => string;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={styles.memberRow}
      {...(onPress ? { activeOpacity: 0.6, onPress } : {})}
    >
      {member.photo_url ? (
        <Image source={{ uri: member.photo_url }} style={styles.memberAvatar} />
      ) : (
        <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
          <Text style={styles.memberAvatarLetter}>
            {(member.display_name || member.email).charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.memberName} numberOfLines={1}>
          {member.display_name || member.email}
        </Text>
        <Text style={styles.memberRole}>{roleLabel(member.role)}</Text>
      </View>
      {onPress && <IconSymbol name="chevron.right" size={14} color={chevronColor} />}
    </Wrapper>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    centered: {
      flex: 1,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    errorTitle: {
      color: isDarkMode ? "#CCCCCC" : "#4D4D4D",
      fontSize: 16,
      marginTop: 16,
      textAlign: "center",
    },
    backBtn: {
      marginTop: 20,
      paddingHorizontal: 24,
      paddingVertical: 10,
      backgroundColor: "#FF2A2A",
      borderRadius: 8,
    },
    backBtnText: {
      color: "#FFFFFF",
      fontWeight: "600",
      fontSize: 15,
    },
    scrollView: {
      flex: 1,
    },

    /* ── Hero ──────────────── */
    heroContainer: {
      width: "100%",
      height: 320,
      position: "relative",
    },
    heroImage: {
      width: "100%",
      height: "100%",
    },
    heroPlaceholder: {
      width: "100%",
      height: "100%",
      backgroundColor: isDarkMode ? "#1A1A1A" : "#EDEDED",
      justifyContent: "center",
      alignItems: "center",
    },
    heroGradient: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 160,
    },
    heroTextContainer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 24,
      paddingBottom: 20,
    },
    heroTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: isDarkMode ? "#FFFFFF" : "#1A1A1A",
      letterSpacing: -0.5,
    },
    heroBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
    },
    heroBadgeText: {
      color: isDarkMode ? "#CCCCCC" : "#4D4D4D",
      fontSize: 14,
      fontWeight: "500",
    },

    /* ── Content ──────────── */
    content: {
      paddingHorizontal: 20,
      paddingTop: 8,
    },

    /* ── Cards ────────────── */
    card: {
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 14,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    cardLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: isDarkMode ? "#999999" : "#666666",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 12,
    },
    cardBody: {
      fontSize: 15,
      color: isDarkMode ? "#DDDDDD" : "#2E2E2E",
      lineHeight: 22,
    },

    /* ── Info rows ─────────── */
    infoRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    infoLabel: {
      fontSize: 12,
      color: isDarkMode ? "#999999" : "#666666",
      fontWeight: "600",
      marginBottom: 2,
    },
    infoValue: {
      fontSize: 14,
      color: isDarkMode ? "#EEEEEE" : "#2E2E2E",
    },

    /* ── Members ──────────── */
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
    },
    memberAvatarPlaceholder: {
      backgroundColor: isDarkMode ? "#333333" : "#CFCFCF",
      justifyContent: "center",
      alignItems: "center",
    },
    memberAvatarLetter: {
      color: isDarkMode ? "#FFFFFF" : "#1A1A1A",
      fontSize: 16,
      fontWeight: "700",
    },
    memberName: {
      color: isDarkMode ? "#FFFFFF" : "#1A1A1A",
      fontSize: 15,
      fontWeight: "600",
    },
    memberRole: {
      color: isDarkMode ? "#999999" : "#666666",
      fontSize: 12,
      marginTop: 2,
    },

    /* ── Floating back ─────── */
    floatingBack: {
      position: "absolute",
      left: 16,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDarkMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.9)",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: isDarkMode ? 0 : 1,
      borderColor: isDarkMode ? "transparent" : "#D9D9D9",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDarkMode ? 0.3 : 0.15,
          shadowRadius: 4,
        },
        default: { elevation: 4 },
      }),
    },

    /* ── Map ────────────────── */
    mapContainer: {
      borderRadius: 10,
      overflow: "hidden",
      height: 480,
    },
  });

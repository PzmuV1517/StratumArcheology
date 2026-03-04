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
import React, { useCallback, useEffect, useState } from "react";
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
import { projectService } from "@/src/services/projectService";
import MapEditor from "@/src/components/map/MapEditor";
import type { PublicProjectDetail } from "@/src/services/projectService.types";

const goBack = (router: ReturnType<typeof useRouter>) => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(tabs)/explore");
  }
};
import type { ProjectMember } from "@/src/services/projectService.types";

// ─── Component ──────────────────────────────────────────────────────────────

export default function PublicProjectDetailScreen() {
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
        <IconSymbol name="exclamationmark.triangle.fill" size={48} color="#555" />
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
              <IconSymbol name="mountain.2.fill" size={56} color="#444" />
            </View>
          )}

          {/* gradient overlay so the text reads well */}
          <LinearGradient
            colors={["transparent", "rgba(17,17,17,0.85)", "#111111"]}
            style={styles.heroGradient}
          />

          {/* Project name overlaid on the image */}
          <View style={[styles.heroTextContainer, { paddingTop: insets.top + 8 }]}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {project.name}
            </Text>
            {project.member_count != null && project.member_count > 0 && (
              <View style={styles.heroBadge}>
                <IconSymbol name="person.2.fill" size={14} color="#ccc" />
                <Text style={styles.heroBadgeText}>
                  {project.member_count} member{project.member_count !== 1 ? "s" : ""}
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

            <InfoRow icon="calendar" label="Created" value={createdDate} />

            {project.ran_lmi_id ? (
              <InfoRow icon="number" label="RAN / LMI" value={project.ran_lmi_id} />
            ) : null}
          </View>

          {/* Team members */}
          {project.members && project.members.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Team</Text>
              {[...project.members]
                .sort((a, b) => {
                  const order: Record<string, number> = { leader: 0, owner: 0, researcher: 1, editor: 1, guest: 2, viewer: 2 };
                  return (order[a.role] ?? 3) - (order[b.role] ?? 3);
                })
                .map((member) => (
                <MemberRow
                  key={member.user_id ?? member.email}
                  member={member}
                  roleLabel={roleLabel}
                  onPress={
                    (member.user_id || member.id)
                      ? () => router.push({ pathname: "/profile/[userId]", params: { userId: String(member.user_id || member.id) } })
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
        <IconSymbol name="chevron.backward" size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <IconSymbol name={icon as any} size={16} color="#FF2A2A" style={{ marginRight: 10, marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function MemberRow({
  member,
  roleLabel,
  onPress,
}: {
  member: ProjectMember;
  roleLabel: (r: string) => string;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={styles.memberRow} {...(onPress ? { activeOpacity: 0.6, onPress } : {})}>
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
      {onPress && (
        <IconSymbol name="chevron.right" size={14} color="#666" />
      )}
    </Wrapper>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  centered: {
    flex: 1,
    backgroundColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorTitle: {
    color: "#CCC",
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
    color: "#FFF",
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
    backgroundColor: "#1A1A1A",
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
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  heroBadgeText: {
    color: "#CCC",
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
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  cardBody: {
    fontSize: 15,
    color: "#DDD",
    lineHeight: 22,
  },

  /* ── Info rows ─────────── */
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2A2A2A",
  },
  infoLabel: {
    fontSize: 12,
    color: "#999",
    fontWeight: "600",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: "#EEE",
  },

  /* ── Members ──────────── */
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2A2A2A",
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  memberAvatarPlaceholder: {
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  memberAvatarLetter: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  memberName: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
  memberRole: {
    color: "#999",
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
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
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

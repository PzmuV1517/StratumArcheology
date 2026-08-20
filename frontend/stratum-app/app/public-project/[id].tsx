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

/* Lazy-load react-markdown on web only */
/* eslint-disable @typescript-eslint/no-require-imports */
const _ReactMarkdown =
  Platform.OS === "web"
    ? (() => {
        try {
          return require("react-markdown").default;
        } catch {
          return null;
        }
      })()
    : null;
const _remarkGfm =
  Platform.OS === "web"
    ? (() => {
        try {
          return require("remark-gfm").default;
        } catch {
          return null;
        }
      })()
    : null;
/* eslint-enable @typescript-eslint/no-require-imports */

const HISTORY_FONT =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function HistoryMarkdown({ text, isDark }: { text: string; isDark: boolean }) {
  const bodyColor = isDark ? "#CFCFCF" : "#2E2E2E";
  const boldColor = isDark ? "#F5F5F5" : "#1A1A1A";
  const borderColor = isDark ? "#333333" : "#E0E0E0";
  const quoteRowBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";

  if (Platform.OS === "web" && _ReactMarkdown && _remarkGfm) {
    return React.createElement(
      "div",
      {
        style: {
          fontFamily: HISTORY_FONT,
          color: bodyColor,
          fontSize: "15px",
          lineHeight: "24px",
        },
      },
      React.createElement(
        _ReactMarkdown,
        {
          remarkPlugins: [_remarkGfm],
          components: {
            p: ({ children }: any) =>
              React.createElement(
                "p",
                {
                  style: {
                    margin: "0 0 10px 0",
                    fontFamily: HISTORY_FONT,
                    color: "inherit",
                  },
                },
                children,
              ),
            strong: ({ children }: any) =>
              React.createElement(
                "strong",
                {
                  style: {
                    fontWeight: "700",
                    color: boldColor,
                    fontFamily: HISTORY_FONT,
                  },
                },
                children,
              ),
            em: ({ children }: any) =>
              React.createElement(
                "em",
                {
                  style: {
                    fontStyle: "italic",
                    fontFamily: HISTORY_FONT,
                    color: "inherit",
                  },
                },
                children,
              ),
            h1: ({ children }: any) =>
              React.createElement(
                "h1",
                {
                  style: {
                    margin: "0 0 8px 0",
                    fontSize: "20px",
                    fontWeight: "700",
                    color: boldColor,
                    fontFamily: HISTORY_FONT,
                  },
                },
                children,
              ),
            h2: ({ children }: any) =>
              React.createElement(
                "h2",
                {
                  style: {
                    margin: "16px 0 8px 0",
                    fontSize: "17px",
                    fontWeight: "700",
                    color: boldColor,
                    fontFamily: HISTORY_FONT,
                  },
                },
                children,
              ),
            h3: ({ children }: any) =>
              React.createElement(
                "h3",
                {
                  style: {
                    margin: "10px 0 4px 0",
                    fontSize: "15px",
                    fontWeight: "700",
                    color: boldColor,
                    fontFamily: HISTORY_FONT,
                  },
                },
                children,
              ),
            ul: ({ children }: any) =>
              React.createElement(
                "ul",
                { style: { paddingLeft: "20px", margin: "0 0 10px 0" } },
                children,
              ),
            ol: ({ children }: any) =>
              React.createElement(
                "ol",
                { style: { paddingLeft: "20px", margin: "0 0 10px 0" } },
                children,
              ),
            li: ({ children }: any) =>
              React.createElement(
                "li",
                {
                  style: {
                    fontFamily: HISTORY_FONT,
                    color: "inherit",
                    marginBottom: "4px",
                  },
                },
                children,
              ),
            blockquote: ({ children }: any) =>
              React.createElement(
                "blockquote",
                {
                  style: {
                    borderLeft: "3px solid #FF2A2A",
                    margin: "16px 0",
                    padding: "10px 16px",
                    backgroundColor: quoteRowBg,
                    borderRadius: "0 6px 6px 0",
                    fontStyle: "italic",
                    fontSize: "15px",
                    color: isDark ? "#DDDDDD" : "#3A3A3A",
                    lineHeight: "24px",
                  },
                },
                children,
              ),
            hr: () =>
              React.createElement("hr", {
                style: {
                  border: "none",
                  borderTop: `1px solid ${borderColor}`,
                  margin: "18px 0",
                },
              }),
            table: ({ children }: any) =>
              React.createElement(
                "div",
                { style: { overflowX: "auto", marginBottom: "14px" } },
                React.createElement(
                  "table",
                  {
                    style: {
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "14px",
                    },
                  },
                  children,
                ),
              ),
            thead: ({ children }: any) =>
              React.createElement(
                "thead",
                { style: { borderBottom: `2px solid ${borderColor}` } },
                children,
              ),
            tbody: ({ children }: any) => React.createElement("tbody", {}, children),
            tr: ({ children }: any) => React.createElement("tr", {}, children),
            th: ({ children }: any) =>
              React.createElement(
                "th",
                {
                  style: {
                    textAlign: "left",
                    padding: "7px 12px",
                    fontWeight: "700",
                    color: isDark ? "#AAAAAA" : "#666666",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    fontFamily: HISTORY_FONT,
                  },
                },
                children,
              ),
            td: ({ children }: any) =>
              React.createElement(
                "td",
                {
                  style: {
                    padding: "7px 12px",
                    borderBottom: `1px solid ${borderColor}`,
                    color: isDark ? "#DDDDDD" : "#2E2E2E",
                    fontFamily: HISTORY_FONT,
                    verticalAlign: "top",
                  },
                },
                children,
              ),
          },
        },
        text,
      ),
    );
  }

  // Native: paragraph / blockquote / table renderer
  const lines = text.split("\n");
  return (
    <View>
      {lines.map((line, i) => {
        if (line === "") return <View key={i} style={{ height: 8 }} />;

        // Horizontal rule
        if (/^---+$/.test(line.trim())) {
          return (
            <View
              key={i}
              style={{
                height: 1,
                backgroundColor: isDark ? "#333333" : "#E0E0E0",
                marginVertical: 10,
              }}
            />
          );
        }

        // Table rows
        if (line.trimStart().startsWith("|")) {
          // Skip separator rows like |---|---|
          if (/^\|[\s\-|:]+\|$/.test(line.trim())) return null;
          const nextLine = lines[i + 1] ?? "";
          const isHeader = /^\|[\s\-|:]+\|$/.test(nextLine.trim());
          const cells = line
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c.length > 0);
          return (
            <View
              key={i}
              style={{
                flexDirection: "row",
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: isDark ? "#2A2A2A" : "#EEEEEE",
                paddingVertical: 6,
                backgroundColor: isHeader
                  ? isDark
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(0,0,0,0.03)"
                  : "transparent",
              }}
            >
              {cells.map((cell, j) => {
                const boldParts = cell.split(/(\*\*[^*]+\*\*)/g);
                return (
                  <Text
                    key={j}
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: bodyColor,
                      paddingHorizontal: 4,
                      fontWeight: isHeader ? "700" : "400",
                    }}
                  >
                    {boldParts.map((p, k) =>
                      p.startsWith("**") && p.endsWith("**") ? (
                        <Text
                          key={k}
                          style={{ fontWeight: "700", color: boldColor }}
                        >
                          {p.slice(2, -2)}
                        </Text>
                      ) : (
                        <Text key={k}>{p}</Text>
                      ),
                    )}
                  </Text>
                );
              })}
            </View>
          );
        }

        // Blockquote
        if (line.startsWith("> ")) {
          return (
            <View
              key={i}
              style={{
                borderLeftWidth: 3,
                borderLeftColor: "#FF2A2A",
                paddingLeft: 12,
                paddingVertical: 6,
                marginVertical: 6,
                backgroundColor: quoteRowBg,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  color: isDark ? "#DDDDDD" : "#3A3A3A",
                  fontStyle: "italic",
                  lineHeight: 22,
                }}
              >
                {line.slice(2)}
              </Text>
            </View>
          );
        }

        const heading = /^#{1,3}\s/.test(line);
        const bullet = line.startsWith("- ") || line.startsWith("* ");
        const content = heading
          ? line.replace(/^#+\s/, "")
          : bullet
            ? line.slice(2)
            : line;
        const parts = content.split(/(\*\*[^*]+\*\*)/g);
        return (
          <Text
            key={i}
            style={{
              marginBottom: 4,
              fontSize: heading ? 16 : 15,
              fontWeight: heading ? "700" : "400",
              color: bodyColor,
              lineHeight: 24,
            }}
          >
            {bullet && <Text style={{ color: bodyColor }}>{"• "}</Text>}
            {parts.map((p, j) =>
              p.startsWith("**") && p.endsWith("**") ? (
                <Text key={j} style={{ fontWeight: "700", color: boldColor }}>
                  {p.slice(2, -2)}
                </Text>
              ) : (
                <Text key={j}>{p}</Text>
              ),
            )}
          </Text>
        );
      })}
    </View>
  );
}
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

  // Poll every 5 s while the history review is still being generated
  useEffect(() => {
    if (!id || !project) return;
    if (
      !("public_history_review" in project) ||
      project.public_history_review != null
    )
      return;

    const timer = setInterval(async () => {
      try {
        const updated = await projectService.getPublicProject(id);
        if (updated.public_history_review != null) {
          setProject(updated);
        }
      } catch {
        // ignore transient errors during polling
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [id, project, project?.public_history_review]);

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
          {project.description ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>About this Site</Text>
              <Text style={styles.cardBody}>{project.description}</Text>
            </View>
          ) : null}

          {/* History Review - shown once the field is present in the response */}
          {"public_history_review" in project && (
            <View style={styles.card}>
              <View style={styles.historyCardHeader}>
                <Text style={[styles.cardLabel, { marginBottom: 0 }]}>
                  History Review
                </Text>
                {!!project.public_history_provider && (
                  <Text style={styles.aiWarningText}>
                    {project.public_history_provider} · may contain mistakes
                  </Text>
                )}
              </View>
              {project.public_history_review ? (
                <HistoryMarkdown
                  text={project.public_history_review}
                  isDark={isDarkMode}
                />
              ) : (
                <Text style={styles.historyPending}>
                  History review is being prepared, please check back soon.
                </Text>
              )}
            </View>
          )}

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

          {/* ── Map card - reuses the same MapEditor as the project GPS tab ── */}
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

    /* ── History Review ────── */
    historyCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
      flexWrap: "wrap",
      gap: 6,
    },
    aiWarningText: {
      fontSize: 11,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      letterSpacing: 0.3,
      fontStyle: "italic",
    },
    historyPending: {
      fontSize: 14,
      color: isDarkMode ? "#888888" : "#888888",
      fontStyle: "italic",
      lineHeight: 20,
    },
  });

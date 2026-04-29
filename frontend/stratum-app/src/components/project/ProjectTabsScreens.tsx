/**
 * @file
 * Project detail tab screens container.
 *
 * Organizes project detail content into tab views for
 * notes, files, tools, and timeline.
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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  View,
  Text,
  ImageBackground,
  Platform,
  TouchableOpacity,
  StyleSheet as RNStyleSheet,
} from "react-native";

/* eslint-disable @typescript-eslint/no-require-imports */
const _ReactMarkdown =
  Platform.OS === "web"
    ? (() => { try { return require("react-markdown").default; } catch { return null; } })()
    : null;
const _remarkGfm =
  Platform.OS === "web"
    ? (() => { try { return require("remark-gfm").default; } catch { return null; } })()
    : null;
/* eslint-enable @typescript-eslint/no-require-imports */

function _parseBold(text: string, color: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <Text key={i} style={{ fontWeight: "700", color }}>{p.slice(2, -2)}</Text>
      : <Text key={i} style={{ color }}>{p}</Text>,
  );
}

function AiSummaryMarkdown({ text, isDark }: { text: string; isDark: boolean }) {
  const c = isDark ? "#CFCFCF" : "#444444";
  const cBold = isDark ? "#F5F5F5" : "#1A1A1A";
  const SYSTEM_FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const webBase = { fontFamily: SYSTEM_FONT, color: c, fontSize: "14px", lineHeight: "22px", letterSpacing: "0.2px" };

  if (Platform.OS === "web" && _ReactMarkdown && _remarkGfm) {
    return React.createElement(
      "div",
      { style: webBase },
      React.createElement(_ReactMarkdown, {
        remarkPlugins: [_remarkGfm],
        components: {
          p:      ({ children }: any) => React.createElement("p",      { style: { margin: "0 0 6px 0", fontFamily: SYSTEM_FONT, fontSize: "inherit", lineHeight: "inherit", color: "inherit" } }, children),
          strong: ({ children }: any) => React.createElement("strong", { style: { fontWeight: "700", color: cBold, fontFamily: SYSTEM_FONT } }, children),
          em:     ({ children }: any) => React.createElement("em",     { style: { fontStyle: "italic", fontFamily: SYSTEM_FONT, color: "inherit" } }, children),
          h1:     ({ children }: any) => React.createElement("h1",     { style: { margin: "0 0 6px 0", fontSize: "17px", fontWeight: "700", color: cBold, fontFamily: SYSTEM_FONT } }, children),
          h2:     ({ children }: any) => React.createElement("h2",     { style: { margin: "0 0 6px 0", fontSize: "16px", fontWeight: "700", color: cBold, fontFamily: SYSTEM_FONT } }, children),
          h3:     ({ children }: any) => React.createElement("h3",     { style: { margin: "0 0 4px 0", fontSize: "15px", fontWeight: "700", color: cBold, fontFamily: SYSTEM_FONT } }, children),
          li:     ({ children }: any) => React.createElement("li",     { style: { fontFamily: SYSTEM_FONT, fontSize: "inherit", lineHeight: "inherit", color: "inherit" } }, children),
        },
      }, text),
    );
  }

  // Native: no explicit fontFamily → system font (SF on iOS, Roboto on Android)
  return (
    <View>
      {text.split("\n").map((line, i) => {
        if (line === "") return <View key={i} style={{ height: 6 }} />;
        const bullet = line.startsWith("- ") || line.startsWith("* ");
        const heading = /^#{1,3}\s/.test(line);
        const content = bullet ? line.slice(2) : heading ? line.replace(/^#+\s/, "") : line;
        return (
          <Text key={i} style={{ marginBottom: 4, fontSize: heading ? 15 : 14, fontWeight: heading ? "700" : "400", letterSpacing: 0.2 }}>
            {bullet && <Text style={{ color: c }}>{"• "}</Text>}
            {_parseBold(content, c)}
          </Text>
        );
      })}
    </View>
  );
}
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import api from "@/services/api";
import NotesSection from "@/components/project/NotesSection";
import FileGallery from "@/components/project/FileGallery";
import ArtefactsTab from "@/components/project/ArtefactsTab";
import TimeMachineTab from "@/components/project/TimeMachineTab";
import ToolsTab from "@/components/project/ToolsTab";
import Timeline from "@/components/timeline/Timeline";
import MapEditor from "@/components/map/MapEditor";
import { useProjectDetailStyles } from "@/components/project/ProjectDetailStyles";
import {
  ProjectLoadingState,
  ProjectNotFoundState,
  useProjectDetail,
} from "@/contexts/ProjectDetailContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

function ProjectTabGuard({ children }: { children: React.ReactNode }) {
  const { loading, project } = useProjectDetail();
  const router = useRouter();

  if (loading) {
    return <ProjectLoadingState />;
  }

  if (!project) {
    return <ProjectNotFoundState onReturn={() => router.replace("/(tabs)")} />;
  }

  return <>{children}</>;
}

export function ProjectOverviewScreen() {
  const styles = useProjectDetailStyles();
  const isDarkMode = (useColorScheme() ?? "light") === "dark";

  const heroGradientColors = useMemo<[string, string, string]>(
    () =>
      isDarkMode
        ? ["rgba(0,0,0,0)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.88)"]
        : ["rgba(255,255,255,0)", "rgba(255,255,255,0.4)", "rgba(255,255,255,0.92)"],
    [isDarkMode],
  );

  const ov = useMemo(() => createOverviewLocalStyles(isDarkMode), [isDarkMode]);

  const {
    project,
    members,
    notes,
    bottomContentPad,
    maybeRefreshControl,
    setCurrentTabName,
  } = useProjectDetail();

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiInitialLoading, setAiInitialLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);
  const [changesSince, setChangesSince] = useState(0);
  const [aiThreshold, setAiThreshold] = useState(15);
  const [canRefresh, setCanRefresh] = useState(true);

  const applyAiResponse = useCallback((data: any) => {
    if (data.summary) setAiSummary(data.summary);
    if (data.provider) setAiProvider(data.provider);
    setChangesSince(data.changes_since ?? 0);
    setAiThreshold(data.threshold ?? 15);
    setCanRefresh(data.can_refresh ?? true);
  }, []);

  useEffect(() => {
    setCurrentTabName("overview");
  }, [setCurrentTabName]);

  // Load persisted summary on mount
  useEffect(() => {
    if (!project?.id) return;
    setAiInitialLoading(true);
    api.get(`/projects/${project.id}/ai-summary`)
      .then((res) => applyAiResponse(res.data))
      .catch(() => {})
      .finally(() => setAiInitialLoading(false));
  }, [project?.id, applyAiResponse]);

  const handleGenerateSummary = useCallback(async () => {
    if (!project?.id) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const res = await api.post(`/projects/${project.id}/ai-summary`);
      applyAiResponse(res.data);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setAiError("Rate limit reached — wait a moment and try again.");
      } else {
        setAiError(
          err.response?.data?.detail ??
            "Failed to generate summary. Check AI configuration.",
        );
      }
    } finally {
      setAiGenerating(false);
    }
  }, [project?.id, applyAiResponse]);

  const createdLabel = project?.created_at
    ? new Date(project.created_at).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <ProjectTabGuard>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: bottomContentPad }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={maybeRefreshControl}
      >
        <View style={ov.pageContainer}>

          {/* ── Hero ── */}
          {project?.cover_image_url ? (
            <View style={ov.heroBanner}>
              <ImageBackground
                source={{ uri: project.cover_image_url }}
                style={ov.heroBannerImage}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={heroGradientColors}
                  style={ov.heroBannerGradient}
                >
                  <Text style={ov.heroTitle}>{project.name}</Text>
                  {!!project.ran_lmi_id && (
                    <View style={styles.overviewBadge}>
                      <Text style={styles.overviewBadgeText}>
                        LMI · {project.ran_lmi_id}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </ImageBackground>
            </View>
          ) : (
            <View style={ov.heroFlat}>
              <Text style={ov.heroTitle}>{project?.name}</Text>
              {!!project?.ran_lmi_id && (
                <View style={styles.overviewBadge}>
                  <Text style={styles.overviewBadgeText}>
                    LMI · {project.ran_lmi_id}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Stats 2×2 ── */}
          <View style={ov.statsRowA}>
            <View style={ov.statCard}>
              <Ionicons name="people" size={20} color="#FF2A2A" style={ov.statIcon} />
              <Text style={ov.statValue}>{members.length}</Text>
              <Text style={ov.statLabel}>Members</Text>
            </View>
            <View style={ov.statCard}>
              <Ionicons name="document-text" size={20} color="#FF2A2A" style={ov.statIcon} />
              <Text style={ov.statValue}>{notes.length}</Text>
              <Text style={ov.statLabel}>Notes</Text>
            </View>
          </View>
          <View style={ov.statsRowB}>
            <View style={ov.statCard}>
              <Ionicons
                name={project?.is_public ? "globe-outline" : "lock-closed-outline"}
                size={20}
                color="#FF2A2A"
                style={ov.statIcon}
              />
              <Text style={ov.statValueSm}>
                {project?.is_public ? "Public" : "Private"}
              </Text>
              <Text style={ov.statLabel}>Visibility</Text>
            </View>
            <View style={ov.statCard}>
              <Ionicons name="calendar-outline" size={20} color="#FF2A2A" style={ov.statIcon} />
              <Text style={ov.statValueSm}>{createdLabel}</Text>
              <Text style={ov.statLabel}>Created</Text>
            </View>
          </View>

          {/* ── AI Insights ── */}
          <View style={ov.aiCard}>
            <View style={ov.aiCardHeader}>
              <View style={ov.aiCardHeaderLeft}>
                <Ionicons name="sparkles" size={18} color="#FF2A2A" />
                <Text style={ov.aiCardTitle}>AI Insights</Text>
              </View>
              {(!aiSummary || canRefresh) && !aiInitialLoading && (
                <TouchableOpacity
                  onPress={handleGenerateSummary}
                  disabled={aiGenerating}
                  style={[ov.aiBtn, aiGenerating && ov.aiBtnDisabled]}
                  activeOpacity={0.75}
                >
                  <Text style={ov.aiBtnText}>
                    {aiGenerating ? "Working…" : aiSummary ? "Refresh" : "Generate"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {aiInitialLoading && (
              <ActivityIndicator color="#FF2A2A" size="small" style={{ marginVertical: 10 }} />
            )}

            {!aiInitialLoading && !aiSummary && !aiGenerating && !aiError && (
              <Text style={ov.aiPrompt}>
                Tap Generate for an AI-powered status briefing of this project.
              </Text>
            )}

            {aiGenerating && (
              <View style={ov.aiLoadingRow}>
                <ActivityIndicator color="#FF2A2A" size="small" />
                <Text style={ov.aiLoadingText}>Analysing project data…</Text>
              </View>
            )}

            {!!aiError && !aiGenerating && (
              <Text style={ov.aiError}>{aiError}</Text>
            )}

            {!!aiSummary && !aiGenerating && (
              <>
                <AiSummaryMarkdown text={aiSummary} isDark={isDarkMode} />
                <View style={ov.aiFooter}>
                  {!!aiProvider && (
                    <Text style={ov.aiProviderText}>Powered by {aiProvider}</Text>
                  )}
                  {!!aiSummary && !canRefresh && (
                    <Text style={ov.aiChangesHint}>
                      {aiThreshold - changesSince} more change{aiThreshold - changesSince !== 1 ? "s" : ""} until refresh
                    </Text>
                  )}
                </View>
              </>
            )}
          </View>

          {/* ── About ── */}
          {!!project?.description && (
            <View style={styles.overviewCard}>
              <View style={styles.overviewCardHeader}>
                <View style={styles.overviewIconCircle}>
                  <Ionicons name="document-text-outline" size={18} color="#FF2A2A" />
                </View>
                <Text style={styles.overviewCardTitle}>About</Text>
              </View>
              <Text style={styles.overviewDescription}>{project.description}</Text>
            </View>
          )}

          {/* ── Team Preview ── */}
          {members.length > 0 && (
            <View style={styles.overviewCard}>
              <View style={styles.overviewCardHeader}>
                <View style={styles.overviewIconCircle}>
                  <Ionicons name="people-outline" size={18} color="#FF2A2A" />
                </View>
                <Text style={styles.overviewCardTitle}>Team</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={ov.memberScroll}
              >
                {members.slice(0, 12).map((m, i) => (
                  <View key={m.user_id ?? i} style={ov.memberChip}>
                    {m.photo_url ? (
                      <Image
                        source={{ uri: m.photo_url }}
                        style={ov.memberAvatar}
                      />
                    ) : (
                      <View style={[ov.memberAvatar, ov.memberAvatarFallback]}>
                        <Text style={ov.memberAvatarInitial}>
                          {(m.display_name || m.email)?.[0]?.toUpperCase() ?? "?"}
                        </Text>
                      </View>
                    )}
                    <Text style={ov.memberName} numberOfLines={1}>
                      {m.display_name || m.email.split("@")[0]}
                    </Text>
                    <Text style={ov.memberRole} numberOfLines={1}>
                      {m.role}
                    </Text>
                  </View>
                ))}
                {members.length > 12 && (
                  <View style={ov.memberChipMore}>
                    <Text style={ov.memberChipMoreText}>
                      +{members.length - 12}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {/* ── Activity Timeline ── */}
          <View style={styles.overviewCard}>
            <View style={styles.overviewCardHeader}>
              <View style={styles.overviewIconCircle}>
                <Ionicons name="time-outline" size={18} color="#FF2A2A" />
              </View>
              <Text style={styles.overviewCardTitle}>Activity</Text>
            </View>
            <View style={{ height: 360, marginTop: 8 }}>
              <Timeline projectId={project?.id as string} maxHeight={360} />
            </View>
          </View>

        </View>
      </ScrollView>
    </ProjectTabGuard>
  );
}

export function ProjectNotesScreen() {
  const styles = useProjectDetailStyles();
  const {
    notes,
    isGuest,
    bottomContentPad,
    maybeRefreshControl,
    handleCreateNote,
    handleNotePress,
    handleDeleteNote,
    setCurrentTabName,
  } = useProjectDetail();

  useEffect(() => {
    setCurrentTabName("notes");
  }, [setCurrentTabName]);

  return (
    <ProjectTabGuard>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: bottomContentPad,
        }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={maybeRefreshControl}
      >
        <NotesSection
          notes={notes as any}
          onCreateNote={handleCreateNote}
          onNotePress={handleNotePress}
          onDeleteNote={handleDeleteNote}
          canEdit={!isGuest}
        />
      </ScrollView>
    </ProjectTabGuard>
  );
}

export function ProjectArtefactsScreen() {
  const styles = useProjectDetailStyles();
  const {
    project,
    canEditFiles,
    bottomContentPad,
    maybeRefreshControl,
    setCurrentTabName,
  } = useProjectDetail();

  useEffect(() => {
    setCurrentTabName("artefacts");
  }, [setCurrentTabName]);

  return (
    <ProjectTabGuard>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: bottomContentPad,
        }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={maybeRefreshControl}
      >
        <ArtefactsTab projectId={project?.id as string} canEdit={canEditFiles} />
      </ScrollView>
    </ProjectTabGuard>
  );
}

export function ProjectMatrixScreen() {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const screenBackground = isDarkMode ? "#111111" : "#F6F6F6";
  const panelBorder = isDarkMode ? "#2A2A2A" : "#D9D9D9";
  const panelBackground = isDarkMode ? "#0A0A0A" : "#FFFFFF";

  const {
    project,
    HarrisMatrixComponent,
    canEditMatrix,
    iosHeaderPad,
    setCurrentTabName,
  } = useProjectDetail();

  useEffect(() => {
    setCurrentTabName("matrix");
  }, [setCurrentTabName]);

  return (
    <ProjectTabGuard>
      <View
        style={{
          flex: 1,
          backgroundColor: screenBackground,
          paddingTop: iosHeaderPad,
          paddingBottom: Platform.OS === "android" ? 84 : 0,
        }}
      >
        <View
          style={
            Platform.OS === "web"
              ? ({
                  flex: 1,
                  borderRadius: 12,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: panelBorder,
                  backgroundColor: panelBackground,
                } as any)
              : {
                  flex: 1,
                  backgroundColor: panelBackground,
                }
          }
        >
          {Platform.OS === "web" ? (
            <div style={{ height: "100%", width: "100%" }}>
              {HarrisMatrixComponent &&
                React.createElement(HarrisMatrixComponent, {
                  projectId: project?.id as string,
                  canEdit: canEditMatrix,
                })}
            </div>
          ) : (
            <View style={{ flex: 1, width: "100%" }}>
              {HarrisMatrixComponent &&
                React.createElement(HarrisMatrixComponent, {
                  projectId: project?.id as string,
                  canEdit: canEditMatrix,
                })}
            </View>
          )}
        </View>
      </View>
    </ProjectTabGuard>
  );
}

export function ProjectGalleryScreen() {
  const styles = useProjectDetailStyles();
  const {
    project,
    openGalleryItem,
    bottomContentPad,
    maybeRefreshControl,
    setCurrentTabName,
  } = useProjectDetail();

  useEffect(() => {
    setCurrentTabName("gallery");
  }, [setCurrentTabName]);

  return (
    <ProjectTabGuard>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: bottomContentPad,
        }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={maybeRefreshControl}
      >
        <FileGallery
          projectId={project?.id as string}
          onOpenItem={openGalleryItem}
        />
      </ScrollView>
    </ProjectTabGuard>
  );
}

export function ProjectMapScreen({
  noHeaderPad = false,
}: {
  noHeaderPad?: boolean;
}) {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const screenBackground = isDarkMode ? "#111111" : "#F6F6F6";
  const panelBorder = isDarkMode ? "#2A2A2A" : "#D9D9D9";

  const { project, canEditMap, iosHeaderPad, setCurrentTabName } =
    useProjectDetail();

  useEffect(() => {
    setCurrentTabName("gps");
  }, [setCurrentTabName]);

  return (
    <ProjectTabGuard>
      <View
        style={{
          flex: 1,
          backgroundColor: screenBackground,
          paddingTop: noHeaderPad ? 0 : iosHeaderPad,
          paddingBottom: Platform.OS === "android" ? 84 : 0,
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 12,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: panelBorder,
          }}
        >
          <MapEditor projectId={project?.id as string} canEdit={canEditMap} />
        </View>
      </View>
    </ProjectTabGuard>
  );
}

export function ProjectHistoryScreen({
  noHeaderPad = false,
}: {
  noHeaderPad?: boolean;
}) {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const screenBackground = isDarkMode ? "#111111" : "#F6F6F6";
  const panelBorder = isDarkMode ? "#2A2A2A" : "#D9D9D9";
  const panelBackground = isDarkMode ? "#0A0A0A" : "#FFFFFF";

  const { project, iosHeaderPad, setCurrentTabName } = useProjectDetail();

  useEffect(() => {
    setCurrentTabName("history");
  }, [setCurrentTabName]);

  return (
    <ProjectTabGuard>
      {Platform.OS === "ios" ? (
        <View
          style={{
            flex: 1,
            backgroundColor: screenBackground,
            paddingTop: noHeaderPad ? 0 : iosHeaderPad,
            paddingBottom: 0,
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: 16,
              overflow: "hidden",
              margin: 16,
            }}
          >
            <TimeMachineTab projectId={project?.id as string} />
          </View>
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: screenBackground,
            paddingTop: noHeaderPad ? 0 : iosHeaderPad,
            paddingBottom: Platform.OS === "android" ? 84 : 0,
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: 16,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: panelBorder,
              backgroundColor: panelBackground,
              marginHorizontal: 16,
              marginTop: 16,
              marginBottom: 16,
            }}
          >
            <TimeMachineTab projectId={project?.id as string} />
          </View>
        </View>
      )}
    </ProjectTabGuard>
  );
}

export function ProjectToolsScreen() {
  const styles = useProjectDetailStyles();
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const panelBorder = isDarkMode ? "#2A2A2A" : "#D9D9D9";
  const panelBackground = isDarkMode ? "#0A0A0A" : "#FFFFFF";

  const { project, bottomContentPad, maybeRefreshControl, setCurrentTabName } =
    useProjectDetail();

  useEffect(() => {
    setCurrentTabName("tools");
  }, [setCurrentTabName]);

  return (
    <ProjectTabGuard>
      {Platform.OS === "ios" ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: bottomContentPad,
          }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={maybeRefreshControl}
        >
          <View
            style={{
              borderRadius: 16,
              overflow: "hidden",
              minHeight: 500,
            }}
          >
            <ToolsTab projectId={project?.id as string} />
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: bottomContentPad,
          }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={maybeRefreshControl}
        >
          <View
            style={{
              borderRadius: 16,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: panelBorder,
              backgroundColor: panelBackground,
              minHeight: 500,
            }}
          >
            <ToolsTab projectId={project?.id as string} />
          </View>
        </ScrollView>
      )}
    </ProjectTabGuard>
  );
}

/**
 * Wheeler Stratigraphic Notation screen.
 *
 * Lazy-loads the platform-specific WheelerDiagram component
 * and renders it inside a project tab guard.
 */
export function ProjectWheelerScreen({
  noHeaderPad = false,
}: {
  noHeaderPad?: boolean;
}) {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const screenBackground = isDarkMode ? "#111111" : "#F6F6F6";
  const panelBorder = isDarkMode ? "#2A2A2A" : "#D9D9D9";
  const panelBackground = isDarkMode ? "#0A0A0A" : "#FFFFFF";

  const { project, iosHeaderPad, setCurrentTabName } = useProjectDetail();

  const [WheelerComponent, setWheelerComponent] =
    React.useState<React.ComponentType<{
      projectId: string;
      canEdit?: boolean;
    }> | null>(null);

  useEffect(() => {
    setCurrentTabName("wheeler");
  }, [setCurrentTabName]);

  useEffect(() => {
    if (Platform.OS === "web") {
      import("@/components/matrix/WheelerDiagram.web")
        .then((mod) => setWheelerComponent(() => mod.default))
        .catch(() => {
          /* WheelerDiagram web not available */
        });
    } else {
      import("@/components/matrix/WheelerDiagram.native")
        .then((mod) => setWheelerComponent(() => mod.default))
        .catch(() => {
          /* WheelerDiagram native not available */
        });
    }
  }, []);

  return (
    <ProjectTabGuard>
      <View
        style={{
          flex: 1,
          backgroundColor: screenBackground,
          paddingTop: noHeaderPad ? 0 : iosHeaderPad,
          paddingBottom: Platform.OS === "android" ? 84 : 0,
        }}
      >
        <View
          style={
            Platform.OS === "web"
              ? ({
                  flex: 1,
                  minHeight: 0,
                  borderRadius: 12,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: panelBorder,
                  backgroundColor: panelBackground,
                } as any)
              : {
                  flex: 1,
                  backgroundColor: panelBackground,
                }
          }
        >
          {Platform.OS === "web" ? (
            <div
              style={{
                height: "100%",
                width: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {WheelerComponent &&
                React.createElement(WheelerComponent, {
                  projectId: project?.id as string,
                  canEdit: true,
                })}
            </div>
          ) : (
            <View style={{ flex: 1, width: "100%" }}>
              {WheelerComponent &&
                React.createElement(WheelerComponent, {
                  projectId: project?.id as string,
                  canEdit: false,
                })}
            </View>
          )}
        </View>
      </View>
    </ProjectTabGuard>
  );
}

// ---------------------------------------------------------------------------
// More Hub Screen (iOS)
// ---------------------------------------------------------------------------
const MORE_ITEMS: {
  key: "gallery" | "gps" | "history" | "tools";
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: "gallery",
    label: "Gallery",
    subtitle: "Browse project photos & files",
    icon: "images",
  },
  {
    key: "gps",
    label: "GPS Map",
    subtitle: "View and edit site locations",
    icon: "map",
  },
  {
    key: "history",
    label: "Time Machine",
    subtitle: "Browse file version history",
    icon: "time",
  },
  {
    key: "tools",
    label: "Tools",
    subtitle: "Compass, GPS coordinates & more",
    icon: "construct",
  },
];

export function ProjectMoreScreen({
  onNavigate,
}: {
  onNavigate: (screen: "gallery" | "gps" | "history" | "tools") => void;
}) {
  const styles = useProjectDetailStyles();
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const moreStyles = useMemo(() => createMoreStyles(isDarkMode), [isDarkMode]);

  const { setCurrentTabName, bottomContentPad } = useProjectDetail();

  useEffect(() => {
    setCurrentTabName("gallery");
  }, [setCurrentTabName]);

  const handlePress = (key: "gallery" | "gps" | "history" | "tools") => {
    onNavigate(key);
  };

  return (
    <ProjectTabGuard>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: bottomContentPad,
        }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text style={moreStyles.title}>More</Text>
        <Text style={moreStyles.subtitle}>Additional project tools and views</Text>

        <View style={moreStyles.grid}>
          {MORE_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={moreStyles.card}
              activeOpacity={0.7}
              onPress={() => handlePress(item.key)}
            >
              <View style={moreStyles.iconCircle}>
                <Ionicons name={item.icon} size={28} color="#FF2A2A" />
              </View>
              <Text style={moreStyles.cardLabel}>{item.label}</Text>
              <Text style={moreStyles.cardSub}>{item.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ProjectTabGuard>
  );
}

const createMoreStyles = (isDarkMode: boolean) =>
  RNStyleSheet.create({
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 4,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 15,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginBottom: 24,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    card: {
      width: "47%",
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
      padding: 20,
      alignItems: "center",
      minHeight: 140,
      justifyContent: "center",
    },
    iconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "rgba(255, 42, 42, 0.12)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    cardLabel: {
      fontSize: 16,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 4,
      textAlign: "center",
    },
    cardSub: {
      fontSize: 12,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      textAlign: "center",
      lineHeight: 16,
    },
  });

const createOverviewLocalStyles = (isDarkMode: boolean) => {
  const surface = isDarkMode ? "#1A1A1A" : "#FFFFFF";
  const border = isDarkMode ? "#2A2A2A" : "#D9D9D9";
  const textPrimary = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const textSecondary = isDarkMode ? "#9A9A9A" : "#666666";
  const textBody = isDarkMode ? "#CFCFCF" : "#555555";
  const muted = isDarkMode ? "#2A2A2A" : "#E8E8E8";
  const aiCardBg = isDarkMode ? "#1A1A1A" : "#FFFFFF";
  const aiCardBorder = isDarkMode ? "rgba(255,42,42,0.35)" : "rgba(255,42,42,0.25)";

  return RNStyleSheet.create({
    pageContainer: {
      padding: 16,
      paddingBottom: 8,
    },

    /* Hero */
    heroBanner: {
      borderRadius: 18,
      overflow: "hidden",
      marginBottom: 16,
      borderWidth: 1,
      borderColor: border,
    },
    heroBannerImage: {
      width: "100%",
      aspectRatio: 16 / 6,
    },
    heroBannerGradient: {
      flex: 1,
      justifyContent: "flex-end",
      padding: 18,
    },
    heroFlat: {
      marginBottom: 16,
      paddingTop: 4,
    },
    heroTitle: {
      fontSize: 30,
      fontWeight: "800",
      color: textPrimary,
      marginBottom: 10,
      letterSpacing: -0.3,
    },

    /* Stats */
    statsRowA: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },
    statsRowB: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: surface,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 10,
      alignItems: "center",
      borderWidth: 1,
      borderColor: border,
    },
    statIcon: {
      marginBottom: 6,
    },
    statValue: {
      fontSize: 26,
      fontWeight: "800",
      color: "#FF2A2A",
      marginBottom: 3,
      letterSpacing: -0.5,
    },
    statValueSm: {
      fontSize: 15,
      fontWeight: "700",
      color: "#FF2A2A",
      marginBottom: 3,
      letterSpacing: 0.1,
      textAlign: "center",
    },
    statLabel: {
      fontSize: 11,
      color: textSecondary,
      fontWeight: "500",
      letterSpacing: 0.2,
      textAlign: "center",
    },

    /* AI Card */
    aiCard: {
      backgroundColor: aiCardBg,
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1.5,
      borderColor: aiCardBorder,
    },
    aiCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    aiCardHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    aiCardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: textPrimary,
      letterSpacing: 0.2,
    },
    aiBtn: {
      backgroundColor: "#FF2A2A",
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
    },
    aiBtnDisabled: {
      opacity: 0.55,
    },
    aiBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    aiPrompt: {
      fontSize: 14,
      color: textSecondary,
      lineHeight: 20,
      fontStyle: "italic",
    },
    aiLoadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 6,
    },
    aiLoadingText: {
      fontSize: 14,
      color: textSecondary,
    },
    aiError: {
      fontSize: 13,
      color: "#FF4444",
      lineHeight: 18,
    },
    aiSummaryText: {
      fontSize: 14,
      color: textBody,
      lineHeight: 22,
      letterSpacing: 0.2,
    },
    aiFooter: {
      marginTop: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 4,
    },
    aiProviderText: {
      fontSize: 11,
      color: textSecondary,
      letterSpacing: 0.3,
      fontStyle: "italic",
    },
    aiChangesHint: {
      fontSize: 11,
      color: textSecondary,
      letterSpacing: 0.2,
      fontStyle: "italic",
    },

    /* Team Preview */
    memberScroll: {
      marginTop: 4,
    },
    memberChip: {
      alignItems: "center",
      marginRight: 14,
      width: 64,
    },
    memberAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginBottom: 6,
    },
    memberAvatarFallback: {
      backgroundColor: "#FF2A2A",
      justifyContent: "center",
      alignItems: "center",
    },
    memberAvatarInitial: {
      color: "#FFFFFF",
      fontSize: 18,
      fontWeight: "700",
    },
    memberName: {
      fontSize: 11,
      color: textPrimary,
      fontWeight: "600",
      textAlign: "center",
      width: 64,
    },
    memberRole: {
      fontSize: 10,
      color: textSecondary,
      textAlign: "center",
      marginTop: 1,
      textTransform: "capitalize",
    },
    memberChipMore: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: muted,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 0,
    },
    memberChipMoreText: {
      fontSize: 13,
      fontWeight: "700",
      color: textSecondary,
    },
  });
};

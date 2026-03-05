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
import React, { useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  Image,
  ImageBackground,
  Platform,
  TouchableOpacity,
  StyleSheet as RNStyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import NotesSection from "@/src/components/project/NotesSection";
import FileGallery from "@/src/components/project/FileGallery";
import ArtefactsTab from "@/src/components/project/ArtefactsTab";
import TimeMachineTab from "@/src/components/project/TimeMachineTab";
import ToolsTab from "@/src/components/project/ToolsTab";
import Timeline from "@/src/components/timeline/Timeline";
import MapEditor from "@/src/components/map/MapEditor";
import styles from "@/src/components/project/ProjectDetailStyles";
import {
  ProjectLoadingState,
  ProjectNotFoundState,
  useProjectDetail,
} from "@/src/contexts/ProjectDetailContext";

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
  const {
    project,
    members,
    notes,
    bottomContentPad,
    maybeRefreshControl,
    setCurrentTabName,
  } = useProjectDetail();

  useEffect(() => {
    setCurrentTabName("overview");
  }, [setCurrentTabName]);

  return (
    <ProjectTabGuard>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: bottomContentPad }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={maybeRefreshControl}
      >
        <View style={styles.overviewContainer}>
          {project?.cover_image_url ? (
            <View style={overviewLocalStyles.heroBanner}>
              <ImageBackground
                source={{ uri: project.cover_image_url }}
                style={overviewLocalStyles.heroBannerImage}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.75)"]}
                  style={overviewLocalStyles.heroBannerGradient}
                >
                  <Text style={styles.overviewTitle}>{project?.name}</Text>
                  {!!project?.ran_lmi_id && (
                    <View style={styles.overviewBadge}>
                      <Text style={styles.overviewBadgeText}>
                        RAN/LMI: {project?.ran_lmi_id}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </ImageBackground>
            </View>
          ) : (
            <View style={styles.overviewHero}>
              <Text style={styles.overviewTitle}>{project?.name}</Text>
              {!!project?.ran_lmi_id && (
                <View style={styles.overviewBadge}>
                  <Text style={styles.overviewBadgeText}>
                    RAN/LMI: {project?.ran_lmi_id}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.overviewStatsGrid}>
            <View style={styles.overviewStatCard}>
              <Text style={styles.overviewStatValue}>{members.length}</Text>
              <Text style={styles.overviewStatLabel}>Team Members</Text>
            </View>
            <View style={styles.overviewStatCard}>
              <Text style={styles.overviewStatValue}>{notes.length}</Text>
              <Text style={styles.overviewStatLabel}>Notes</Text>
            </View>
          </View>

          {!!project?.description && (
            <View style={styles.overviewCard}>
              <View style={styles.overviewCardHeader}>
                <View style={styles.overviewIconCircle}>
                  <Text style={styles.overviewIcon}>📝</Text>
                </View>
                <Text style={styles.overviewCardTitle}>About</Text>
              </View>
              <Text style={styles.overviewDescription}>{project?.description}</Text>
            </View>
          )}

          <View style={styles.overviewCard}>
            <View style={styles.overviewCardHeader}>
              <View style={styles.overviewIconCircle}>
                <Text style={styles.overviewIcon}>📅</Text>
              </View>
              <Text style={styles.overviewCardTitle}>Activity Timeline</Text>
            </View>
            <View style={{ height: 400, marginTop: 12 }}>
              <Timeline projectId={project?.id as string} maxHeight={400} />
            </View>
          </View>
        </View>
      </ScrollView>
    </ProjectTabGuard>
  );
}

export function ProjectNotesScreen() {
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
          backgroundColor: "#111111",
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
                  borderColor: "#2A2A2A",
                  backgroundColor: "#0A0A0A",
                } as any)
              : {
                  flex: 1,
                  backgroundColor: "#0A0A0A",
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

export function ProjectMapScreen() {
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
          backgroundColor: "#111111",
          paddingTop: iosHeaderPad,
          paddingBottom: Platform.OS === "android" ? 84 : 0,
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 12,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "#2A2A2A",
          }}
        >
          <MapEditor projectId={project?.id as string} canEdit={canEditMap} />
        </View>
      </View>
    </ProjectTabGuard>
  );
}

export function ProjectHistoryScreen() {
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
            backgroundColor: "#111111",
            paddingTop: iosHeaderPad,
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
            backgroundColor: "#111111",
            paddingTop: iosHeaderPad,
            paddingBottom: Platform.OS === "android" ? 84 : 0,
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: 16,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "#2A2A2A",
              backgroundColor: "#0A0A0A",
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
              borderColor: "#2A2A2A",
              backgroundColor: "#0A0A0A",
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
export function ProjectWheelerScreen() {
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
      import("@/src/components/matrix/WheelerDiagram.web")
        .then((mod) => setWheelerComponent(() => mod.default))
        .catch(() => {
          /* WheelerDiagram web not available */
        });
    } else {
      import("@/src/components/matrix/WheelerDiagram.native")
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
          backgroundColor: "#111111",
          paddingTop: iosHeaderPad,
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
                  borderColor: "#2A2A2A",
                  backgroundColor: "#0A0A0A",
                } as any)
              : {
                  flex: 1,
                  backgroundColor: "#0A0A0A",
                }
          }
        >
          {Platform.OS === "web" ? (
            <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
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

const moreStyles = RNStyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#F5F5F5",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#9A9A9A",
    marginBottom: 24,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    width: "47%",
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
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
    color: "#F5F5F5",
    marginBottom: 4,
    textAlign: "center",
  },
  cardSub: {
    fontSize: 12,
    color: "#9A9A9A",
    textAlign: "center",
    lineHeight: 16,
  },
});

const overviewLocalStyles = RNStyleSheet.create({
  heroBanner: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  heroBannerImage: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  heroBannerGradient: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
});

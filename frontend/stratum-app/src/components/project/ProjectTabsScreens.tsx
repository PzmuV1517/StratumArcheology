import React, { useEffect } from "react";
import { ScrollView, View, Text, Platform } from "react-native";
import { useRouter } from "expo-router";

import { LiquidGlassView, isLiquidGlassSupported } from "@/src/utils/liquidGlass";
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
  const { project, members, notes, bottomContentPad, maybeRefreshControl, setCurrentTabName } =
    useProjectDetail();

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
          <View style={styles.overviewHero}>
            <Text style={styles.overviewTitle}>{project?.name}</Text>
            {!!project?.ran_lmi_id &&
              (Platform.OS === "ios" && isLiquidGlassSupported ? (
                <LiquidGlassView style={styles.overviewBadgeGlass} effect="regular">
                  <Text style={styles.overviewBadgeText}>RAN/LMI: {project?.ran_lmi_id}</Text>
                </LiquidGlassView>
              ) : (
                <View style={styles.overviewBadge}>
                  <Text style={styles.overviewBadgeText}>RAN/LMI: {project?.ran_lmi_id}</Text>
                </View>
              ))}
          </View>

          <View style={styles.overviewStatsGrid}>
            {Platform.OS === "ios" && isLiquidGlassSupported ? (
              <>
                <LiquidGlassView style={styles.overviewStatCardGlass} effect="regular">
                  <Text style={styles.overviewStatValue}>{members.length}</Text>
                  <Text style={styles.overviewStatLabel}>Team Members</Text>
                </LiquidGlassView>
                <LiquidGlassView style={styles.overviewStatCardGlass} effect="regular">
                  <Text style={styles.overviewStatValue}>{notes.length}</Text>
                  <Text style={styles.overviewStatLabel}>Notes</Text>
                </LiquidGlassView>
              </>
            ) : (
              <>
                <View style={styles.overviewStatCard}>
                  <Text style={styles.overviewStatValue}>{members.length}</Text>
                  <Text style={styles.overviewStatLabel}>Team Members</Text>
                </View>
                <View style={styles.overviewStatCard}>
                  <Text style={styles.overviewStatValue}>{notes.length}</Text>
                  <Text style={styles.overviewStatLabel}>Notes</Text>
                </View>
              </>
            )}
          </View>

          {!!project?.description &&
            (Platform.OS === "ios" && isLiquidGlassSupported ? (
              <LiquidGlassView style={styles.overviewCardGlass} effect="regular">
                <View style={styles.overviewCardHeader}>
                  <View style={styles.overviewIconCircle}>
                    <Text style={styles.overviewIcon}>📝</Text>
                  </View>
                  <Text style={styles.overviewCardTitle}>About</Text>
                </View>
                <Text style={styles.overviewDescription}>{project?.description}</Text>
              </LiquidGlassView>
            ) : (
              <View style={styles.overviewCard}>
                <View style={styles.overviewCardHeader}>
                  <View style={styles.overviewIconCircle}>
                    <Text style={styles.overviewIcon}>📝</Text>
                  </View>
                  <Text style={styles.overviewCardTitle}>About</Text>
                </View>
                <Text style={styles.overviewDescription}>{project?.description}</Text>
              </View>
            ))}

          {Platform.OS === "ios" && isLiquidGlassSupported ? (
            <LiquidGlassView style={styles.overviewCardGlass} effect="regular">
              <View style={styles.overviewCardHeader}>
                <View style={styles.overviewIconCircle}>
                  <Text style={styles.overviewIcon}>📅</Text>
                </View>
                <Text style={styles.overviewCardTitle}>Activity Timeline</Text>
              </View>
              <View style={{ height: 400, marginTop: 12 }}>
                <Timeline projectId={project?.id as string} maxHeight={400} />
              </View>
            </LiquidGlassView>
          ) : (
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
          )}
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
  const { project, canEditFiles, bottomContentPad, maybeRefreshControl, setCurrentTabName } =
    useProjectDetail();

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
  const { project, HarrisMatrixComponent, canEditMatrix, iosHeaderPad, setCurrentTabName } =
    useProjectDetail();

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
                  height: "calc(100vh - 340px)",
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
  const { project, openGalleryItem, bottomContentPad, maybeRefreshControl, setCurrentTabName } =
    useProjectDetail();

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
        <FileGallery projectId={project?.id as string} onOpenItem={openGalleryItem} />
      </ScrollView>
    </ProjectTabGuard>
  );
}

export function ProjectMapScreen() {
  const { project, canEditMap, iosHeaderPad, setCurrentTabName } = useProjectDetail();

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
      {Platform.OS === "ios" && isLiquidGlassSupported ? (
        <View
          style={{
            flex: 1,
            backgroundColor: "#111111",
            paddingTop: iosHeaderPad,
            paddingBottom: 0,
          }}
        >
          <LiquidGlassView
            style={{
              flex: 1,
              borderRadius: 16,
              overflow: "hidden",
              margin: 16,
            }}
            effect="regular"
          >
            <TimeMachineTab projectId={project?.id as string} />
          </LiquidGlassView>
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
  const { project, bottomContentPad, maybeRefreshControl, setCurrentTabName } = useProjectDetail();

  useEffect(() => {
    setCurrentTabName("tools");
  }, [setCurrentTabName]);

  return (
    <ProjectTabGuard>
      {Platform.OS === "ios" && isLiquidGlassSupported ? (
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
          <LiquidGlassView
            style={{
              borderRadius: 16,
              overflow: "hidden",
              minHeight: 500,
            }}
            effect="regular"
          >
            <ToolsTab projectId={project?.id as string} />
          </LiquidGlassView>
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

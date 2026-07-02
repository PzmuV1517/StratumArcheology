/**
 * @file
 * Home tab screen.
 *
 * Displays the user's project dashboard with recent
 * projects and quick actions.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { ProjectListSkeleton } from "@/components/common/Skeleton";
import { useRouter, useFocusEffect } from "expo-router";
import { projectService } from "@/services/projectService";
import { activityService } from "@/services/activityService";
import { ProjectActionModal } from "@/components/project/modals/ProjectActionModal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/contexts/AuthContext";
import {
  useOnboarding,
  DEV_ALWAYS_SHOW_ONBOARDING,
} from "@/contexts/OnboardingContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Project } from "@/services/projectService.types";
import type { ProjectActivity } from "@/services/activityService.types";

type MyActivity = ProjectActivity & {
  project_name?: string;
};

export default function ProjectsScreen() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<MyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const showSkeleton = useDelayedLoading(loading);
  const [showActionModal, setShowActionModal] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"projects" | "mystuff">(
    "projects",
  );
  const router = useRouter();
  const { user } = useAuth();
  const { triggerPrompt, showPrompt, showOnboarding } = useOnboarding();
  const hasTriggeredPrompt = useRef(false);
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const pageBackground = isDarkMode ? "#111111" : "#F7F7F7";
  const surfaceBackground = isDarkMode ? "#1A1A1A" : "#FFFFFF";
  const borderColor = isDarkMode ? "#2A2A2A" : "#D9D9D9";
  const textPrimary = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const textSecondary = isDarkMode ? "#9A9A9A" : "#666666";
  const coverGradient = isDarkMode
    ? [
        "#1A1A1A",
        "rgba(26,26,26,0.92)",
        "rgba(26,26,26,0.5)",
        "rgba(26,26,26,0.15)",
        "transparent",
      ]
    : [
        "#FFFFFF",
        "rgba(255,255,255,0.9)",
        "rgba(255,255,255,0.55)",
        "rgba(255,255,255,0.2)",
        "transparent",
      ];

  // Show onboarding prompt once for new users (or always in dev mode)
  useEffect(() => {
    if (!user) return;
    // Don't retrigger if already triggered this session (unless dev mode forces it)
    if (!DEV_ALWAYS_SHOW_ONBOARDING && hasTriggeredPrompt.current) return;
    // Don't retrigger if prompt/onboarding is already showing
    if (showPrompt || showOnboarding) return;

    if (DEV_ALWAYS_SHOW_ONBOARDING || !user.has_completed_onboarding) {
      hasTriggeredPrompt.current = true;
      const timer = setTimeout(() => triggerPrompt(), 600);
      return () => clearTimeout(timer);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProjects = useCallback(async () => {
    try {
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (error) {
      // Silent fail - user can see offline icon if they're offline
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMyActivities = useCallback(async () => {
    try {
      // Use the dedicated endpoint for personal activities
      const myActivities = await activityService.getMyActivities(50);
      setActivities(myActivities);
    } catch (error) {
      console.error("Failed to load activities:", error);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Reload projects when screen comes back into focus (after creating a project)
  useFocusEffect(
    useCallback(() => {
      loadProjects();
      if (activeSubTab === "mystuff") {
        loadMyActivities();
      }
    }, [loadProjects, loadMyActivities, activeSubTab]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadProjects();
    if (activeSubTab === "mystuff") {
      loadMyActivities();
    }
  };

  const handleSubTabChange = (tab: "projects" | "mystuff") => {
    setActiveSubTab(tab);
    if (tab === "mystuff" && activities.length === 0) {
      loadMyActivities();
    }
  };

  const renderProject = ({ item, index: _index }: any) => {
    // During onboarding, tag the demo project card (or first card as fallback)
    return (
      <TouchableOpacity
        style={[
          styles.projectCard,
          { backgroundColor: surfaceBackground, borderColor },
        ]}
        onPress={() =>
          router.push({
            pathname: "/project/[id]",
            params: { id: String(item.id) },
          })
        }
      >
        {item.cover_image_url && (
          <View style={styles.coverImageWrapper}>
            <Image
              source={{ uri: item.cover_image_url }}
              style={styles.coverImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={coverGradient}
              locations={[0, 0.2, 0.35, 0.45, 0.6]}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        )}
        <View
          style={[
            styles.cardTextContent,
            {
              backgroundColor: item.cover_image_url
                ? "transparent"
                : surfaceBackground,
            },
          ]}
        >
          <Text style={[styles.projectName, { color: textPrimary }]}>
            {item.name}
          </Text>
          <Text style={[styles.projectDescription, { color: textSecondary }]}>
            {item.description || "No description"}
          </Text>
          <View style={styles.projectMeta}>
            <Text style={[styles.dateText, { color: textSecondary }]}>
              Created: {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderActivity = ({ item }: { item: MyActivity }) => (
    <TouchableOpacity
      style={[
        styles.activityCard,
        { backgroundColor: surfaceBackground, borderColor },
      ]}
      onPress={() =>
        router.push({
          pathname: "/project/[id]",
          params: { id: String(item.project_id) },
        })
      }
    >
      <View style={styles.activityHeader}>
        <Text style={styles.activityProjectName}>
          {item.project_name || "Project"}
        </Text>
        <Text style={[styles.activityDate, { color: textSecondary }]}>
          {activityService.formatTimestamp(item.created_at)}
        </Text>
      </View>
      <Text style={[styles.activityDescription, { color: textPrimary }]}>
        {activityService.getActivityDescription(item)}
      </Text>
      {item.user_name && (
        <Text style={[styles.activityUser, { color: textSecondary }]}>
          by {item.user_name}
        </Text>
      )}
    </TouchableOpacity>
  );

  if (showSkeleton) {
    return (
      <View style={[styles.container, { backgroundColor: pageBackground }]}>
        <View style={[styles.header, { backgroundColor: pageBackground }]}>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Projects</Text>
          <Text style={[styles.headerSubtitle, { color: textSecondary }]}>
            Manage your excavation projects
          </Text>
        </View>
        <ProjectListSkeleton count={4} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      <View style={[styles.header, { backgroundColor: pageBackground }]}>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Projects</Text>
        <Text style={[styles.headerSubtitle, { color: textSecondary }]}>
          Manage your excavation projects
        </Text>
      </View>

      {/* Sub-tab selector */}
      <View style={[styles.subTabContainer, { backgroundColor: pageBackground }]}>
        <TouchableOpacity
          style={[
            styles.subTab,
            { backgroundColor: surfaceBackground, borderColor },
            activeSubTab === "projects" && styles.subTabActive,
          ]}
          onPress={() => handleSubTabChange("projects")}
        >
          <Text
            style={[
              styles.subTabText,
              { color: textSecondary },
              activeSubTab === "projects" && styles.subTabTextActive,
            ]}
          >
            All Projects
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.subTab,
            { backgroundColor: surfaceBackground, borderColor },
            activeSubTab === "mystuff" && styles.subTabActive,
          ]}
          onPress={() => handleSubTabChange("mystuff")}
        >
          <Text
            style={[
              styles.subTabText,
              { color: textSecondary },
              activeSubTab === "mystuff" && styles.subTabTextActive,
            ]}
          >
            My Stuff
          </Text>
        </TouchableOpacity>
      </View>

      {activeSubTab === "projects" ? (
        <>
          {projects.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: textPrimary }]}>
                No projects yet
              </Text>
              <Text style={[styles.emptySubtext, { color: textSecondary }]}>
                Create your first project to get started
              </Text>
            </View>
          ) : (
            <FlatList
              data={projects}
              renderItem={renderProject}
              keyExtractor={(item: any) => item.id}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              contentContainerStyle={styles.listContainer}
            />
          )}
        </>
      ) : (
        <ScrollView
          style={styles.myStuffContainer}
          contentContainerStyle={styles.myStuffContent}
        >
          {/* My Folder quick access - shows folders from all projects */}
          <View style={styles.myFolderSection}>
            <Text style={[styles.myFolderSectionTitle, { color: textPrimary }]}>
              My Folders
            </Text>
            <Text style={[styles.myFolderSectionSubtitle, { color: textSecondary }]}>
              Access your private folders from each project
            </Text>
            {projects.length === 0 ? (
              <View
                style={[
                  styles.emptyTimeline,
                  { backgroundColor: surfaceBackground, borderColor },
                ]}
              >
                <Text style={[styles.emptyTimelineText, { color: textPrimary }]}>
                  No projects yet
                </Text>
                <Text
                  style={[styles.emptyTimelineSubtext, { color: textSecondary }]}
                >
                  Join or create a project to get your personal folder
                </Text>
              </View>
            ) : (
              projects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={[
                    styles.myFolderButton,
                    { backgroundColor: surfaceBackground, borderColor },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/project/[id]",
                      params: { id: String(project.id), openFiles: "myFolder" },
                    })
                  }
                >
                  <Text style={styles.myFolderIcon}>📁</Text>
                  <View style={styles.myFolderInfo}>
                    <Text style={[styles.myFolderTitle, { color: textPrimary }]}>
                      {project.name}
                    </Text>
                    <Text
                      style={[styles.myFolderSubtitle, { color: textSecondary }]}
                    >
                      Open your private folder
                    </Text>
                  </View>
                  <Text style={styles.myFolderArrow}>→</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Activity timeline */}
          <View style={styles.timelineSection}>
            <Text style={[styles.timelineSectionTitle, { color: textPrimary }]}>
              Recent Activity
            </Text>
            {activities.length === 0 ? (
              <View
                style={[
                  styles.emptyTimeline,
                  { backgroundColor: surfaceBackground, borderColor },
                ]}
              >
                <Text style={[styles.emptyTimelineText, { color: textPrimary }]}>
                  No recent activity
                </Text>
                <Text
                  style={[styles.emptyTimelineSubtext, { color: textSecondary }]}
                >
                  Your actions across all projects will appear here
                </Text>
              </View>
            ) : (
              <FlatList
                data={activities}
                renderItem={renderActivity}
                keyExtractor={(item) => String(item.id)}
                scrollEnabled={false}
              />
            )}
          </View>
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowActionModal(true)}>
        <IconSymbol name="plus" size={28} color={textPrimary} />
      </TouchableOpacity>

      <ProjectActionModal
        visible={showActionModal}
        onClose={() => setShowActionModal(false)}
        onCreateProject={() => router.push("/modal")}
        onJoinProject={() => router.push("/join-project")}
      />
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: Platform.OS === "web" ? 8 : 60,
      paddingBottom: 16,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      letterSpacing: 0.5,
    },
    headerSubtitle: {
      fontSize: 15,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginTop: 6,
    },
    // Sub-tab styles
    subTabContainer: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    subTab: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    subTabActive: {
      backgroundColor: "#FF2A2A",
      borderColor: "#FF2A2A",
    },
    subTabText: {
      fontSize: 14,
      fontWeight: "600",
      color: isDarkMode ? "#9A9A9A" : "#666666",
      letterSpacing: 0.3,
    },
    subTabTextActive: {
      color: "#F5F5F5",
    },

    listContainer: { padding: 16 },
    projectCard: {
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDarkMode ? 0.4 : 0.14,
      shadowRadius: 20,
      elevation: 8,
      overflow: "hidden",
    },
    coverImageWrapper: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
      alignItems: "flex-end",
    },
    coverImage: {
      width: "100%",
      height: "100%",
      position: "absolute",
      right: 0,
      top: 0,
    },
    cardTextContent: {
      padding: 16,
    },
    projectName: {
      fontSize: 18,
      fontWeight: "600",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 8,
      letterSpacing: 0.5,
    },
    projectDescription: {
      fontSize: 14,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginBottom: 12,
      lineHeight: 20,
    },
    projectMeta: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: 8,
    },
    roleText: {
      fontSize: 12,
      color: "#FF2A2A",
      fontWeight: "600",
      letterSpacing: 0.5,
    },
    dateText: {
      fontSize: 12,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      letterSpacing: 0.5,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
    },
    emptyText: {
      fontSize: 18,
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 10,
      fontWeight: "600",
      letterSpacing: 0.5,
    },
    emptySubtext: {
      fontSize: 14,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      textAlign: "center",
      letterSpacing: 0.5,
    },
    fab: {
      position: "absolute",
      right: 24,
      bottom: Platform.OS === "android" ? 110 : 100,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "#FF2A2A",
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#FF2A2A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 12,
      zIndex: 999,
    },

    // My Stuff styles
    myStuffContainer: {
      flex: 1,
    },
    myStuffContent: {
      padding: 16,
      paddingBottom: 100,
    },
    myFolderButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    myFolderIcon: {
      fontSize: 24,
      marginRight: 16,
    },
    myFolderInfo: {
      flex: 1,
    },
    myFolderTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 2,
      letterSpacing: 0.5,
    },
    myFolderSubtitle: {
      fontSize: 13,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      letterSpacing: 0.3,
    },
    myFolderArrow: {
      fontSize: 18,
      color: "#FF2A2A",
      fontWeight: "600",
    },
    myFolderSection: {
      marginBottom: 24,
    },
    myFolderSectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    myFolderSectionSubtitle: {
      fontSize: 13,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginBottom: 16,
      letterSpacing: 0.3,
    },
    timelineSection: {
      marginBottom: 16,
    },
    timelineSectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 16,
      letterSpacing: 0.5,
    },
    emptyTimeline: {
      alignItems: "center",
      paddingVertical: 32,
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    emptyTimelineText: {
      fontSize: 16,
      fontWeight: "600",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 8,
    },
    emptyTimelineSubtext: {
      fontSize: 14,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      textAlign: "center",
    },
    activityCard: {
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    activityHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    activityProjectName: {
      fontSize: 14,
      fontWeight: "700",
      color: "#FF2A2A",
      letterSpacing: 0.3,
    },
    activityDate: {
      fontSize: 12,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      letterSpacing: 0.3,
    },
    activityDescription: {
      fontSize: 15,
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      lineHeight: 22,
      letterSpacing: 0.3,
    },
    activityUser: {
      fontSize: 12,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginTop: 8,
      letterSpacing: 0.3,
    },
  });

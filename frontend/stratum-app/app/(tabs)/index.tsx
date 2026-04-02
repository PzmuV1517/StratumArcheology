/**
 * @file
 * Overview tab screen.
 *
 * Displays a high-level overview of all projects
 * and recent activity.
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
import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { OverviewSkeleton, Skeleton } from "@/components/common/Skeleton";
import { useRouter, useFocusEffect } from "expo-router";
import { projectService } from "@/services/projectService";
import { activityService } from "@/services/activityService";
import { useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Project } from "@/services/projectService.types";

interface Activity {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
  user_id?: string;
  project_id: string;
}

/**
 * Overview Tab - Main landing page showing:
 * - User welcome
 * - Top 3 recent projects with interactive timelines
 */
export default function OverviewScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const pageBackground = isDarkMode ? "#111111" : "#F7F7F7";
  const surfaceBackground = isDarkMode ? "#1A1A1A" : "#FFFFFF";
  const borderColor = isDarkMode ? "#2A2A2A" : "#D9D9D9";
  const textPrimary = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const textSecondary = isDarkMode ? "#9A9A9A" : "#666666";
  const timelineTextColor = isDarkMode ? "#CFCFCF" : "#4F4F4F";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [projectActivities, setProjectActivities] = useState<
    Record<string, Activity[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const showSkeleton = useDelayedLoading(loading);
  const showActivitiesSkeleton = useDelayedLoading(activitiesLoading);

  const loadRecentProjects = useCallback(async () => {
    try {
      setLoading(true);
      const projects = await projectService.getProjects();

      // Sort by updated_at/created_at and get top 3
      const sorted = projects.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at).getTime();
        const dateB = new Date(b.updated_at || b.created_at).getTime();
        return dateB - dateA;
      });

      const top3 = sorted.slice(0, 3);
      setRecentProjects(top3);

      // Load activities for each project
      if (top3.length > 0) {
        loadProjectActivities(top3);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load projects on mount and focus
  useFocusEffect(
    useCallback(() => {
      loadRecentProjects();
    }, [loadRecentProjects]),
  );

  const loadProjectActivities = async (projects: Project[]) => {
    setActivitiesLoading(true);
    const activitiesMap: Record<string, Activity[]> = {};

    try {
      // Load activities in parallel using activityService
      await Promise.all(
        projects.map(async (project) => {
          try {
            const activities = await activityService.getActivities(project.id, 5, 0);
            activitiesMap[project.id] = activities as unknown as Activity[];
          } catch (err) {
            console.error(
              `Failed to load activities for project ${project.id}:`,
              err,
            );
            activitiesMap[project.id] = [];
          }
        }),
      );

      setProjectActivities(activitiesMap);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Use the comprehensive icon mapping from activityService
  const getActivityIcon = (type: string): string => {
    return activityService.getActivityIcon(type);
  };

  const renderProjectCard = (project: Project) => {
    const activities = projectActivities[project.id] || [];

    return (
      <TouchableOpacity
        key={project.id}
        style={[
          styles.projectCard,
          { backgroundColor: surfaceBackground, borderColor },
        ]}
        onPress={() => router.push(`/project/${project.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.projectHeader}>
          <Text
            style={[styles.projectName, { color: textPrimary }]}
            numberOfLines={1}
          >
            {project.name}
          </Text>
          <Text style={[styles.projectDate, { color: textSecondary }]}>
            {formatTimeAgo(project.updated_at || project.created_at)}
          </Text>
        </View>

        {project.description && (
          <Text
            style={[styles.projectDescription, { color: textSecondary }]}
            numberOfLines={2}
          >
            {project.description}
          </Text>
        )}

        {/* Interactive Timeline */}
        <View style={[styles.timelineContainer, { borderTopColor: borderColor }]}>
          <Text style={[styles.timelineTitle, { color: textSecondary }]}>
            Recent Activity
          </Text>
          {showActivitiesSkeleton ? (
            <View style={{ flexDirection: "row", gap: 8, marginVertical: 4 }}>
              <Skeleton width={100} height={60} borderRadius={10} />
              <Skeleton width={100} height={60} borderRadius={10} />
              <Skeleton width={100} height={60} borderRadius={10} />
            </View>
          ) : activities.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.timelineScroll}
              contentContainerStyle={styles.timelineContent}
            >
              {activities.map((activity, index) => (
                <View
                  key={activity.id || index}
                  style={[
                    styles.timelineItem,
                    { backgroundColor: surfaceBackground },
                  ]}
                >
                  <Text style={styles.timelineIcon}>
                    {getActivityIcon(activity.activity_type)}
                  </Text>
                  <Text
                    style={[styles.timelineText, { color: timelineTextColor }]}
                    numberOfLines={2}
                  >
                    {activity.description}
                  </Text>
                  <Text style={[styles.timelineTime, { color: textSecondary }]}>
                    {formatTimeAgo(activity.created_at)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={[styles.noActivityText, { color: textSecondary }]}>
              No recent activity
            </Text>
          )}
        </View>

        <View style={[styles.projectFooter, { borderTopColor: borderColor }]}>
          <Text style={styles.viewProjectText}>View Project →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (showSkeleton) {
    return <OverviewSkeleton />;
  }

  return (
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: pageBackground }]}>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Overview</Text>
        <Text style={[styles.headerSubtitle, { color: textSecondary }]}>
          Welcome back
          {user?.display_name ? `,${user.display_name.split(" ")[0]}` : ""}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Recent Projects Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>
              Recent Projects
            </Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)")}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {recentProjects.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: surfaceBackground, borderColor },
              ]}
            >
              <Text style={styles.emptyStateEmoji}>📁</Text>
              <Text style={[styles.emptyStateTitle, { color: textPrimary }]}>
                No projects yet
              </Text>
              <Text style={[styles.emptyStateSubtitle, { color: textSecondary }]}>
                Create your first project to get started
              </Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => router.push("/modal")}
              >
                <Text style={styles.createButtonText}>Create Project</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.projectsGrid}>
              {recentProjects.map(renderProjectCard)}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
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
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 120,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    loadingText: {
      marginTop: 16,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontSize: 14,
    },
    welcomeSection: {
      padding: 24,
      paddingTop: Platform.OS === "ios" ? 120 : 100,
      paddingBottom: 8,
    },
    welcomeText: {
      fontSize: 28,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      letterSpacing: 0.5,
    },
    subtitleText: {
      fontSize: 16,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginTop: 8,
    },
    section: {
      paddingHorizontal: 24,
      marginBottom: 32,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      letterSpacing: 0.5,
    },
    seeAllText: {
      fontSize: 14,
      color: "#FF2A2A",
      fontWeight: "500",
    },
    projectsGrid: {
      gap: 16,
    },
    projectCard: {
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    projectHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    projectName: {
      fontSize: 18,
      fontWeight: "600",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      flex: 1,
      marginRight: 12,
    },
    projectDate: {
      fontSize: 12,
      color: isDarkMode ? "#9A9A9A" : "#666666",
    },
    projectDescription: {
      fontSize: 14,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginBottom: 12,
      lineHeight: 20,
    },
    timelineContainer: {
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    timelineTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    timelineScroll: {
      marginHorizontal: -4,
    },
    timelineContent: {
      paddingHorizontal: 4,
    },
    timelineItem: {
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 12,
      padding: 12,
      marginRight: 12,
      width: 140,
      minHeight: 80,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#E4E4E4",
    },
    timelineIcon: {
      fontSize: 16,
      marginBottom: 6,
    },
    timelineText: {
      fontSize: 12,
      color: isDarkMode ? "#CFCFCF" : "#4F4F4F",
      lineHeight: 16,
      marginBottom: 6,
    },
    timelineTime: {
      fontSize: 10,
      color: isDarkMode ? "#9A9A9A" : "#666666",
    },
    noActivityText: {
      fontSize: 12,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontStyle: "italic",
    },
    projectFooter: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
      alignItems: "flex-end",
    },
    viewProjectText: {
      fontSize: 14,
      color: "#FF2A2A",
      fontWeight: "500",
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 40,
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    emptyStateEmoji: {
      fontSize: 48,
      marginBottom: 16,
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 8,
    },
    emptyStateSubtitle: {
      fontSize: 14,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      textAlign: "center",
      marginBottom: 24,
    },
    createButton: {
      backgroundColor: "#FF2A2A",
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    createButtonText: {
      color: "#F5F5F5",
      fontSize: 16,
      fontWeight: "600",
    },
  });

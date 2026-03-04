/**
 * @file
 * Home tab screen.
 *
 * Displays the user's project dashboard with recent
 * projects and quick actions.
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
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { useDelayedLoading } from "../../src/hooks/useDelayedLoading";
import { ProjectListSkeleton } from "../../src/components/common/Skeleton";
import { useRouter, useFocusEffect } from "expo-router";
import { projectService } from "../../src/services/projectService";
import { activityService } from "../../src/services/activityService";
import { ProjectActionModal } from "../../src/components/project/modals/ProjectActionModal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "../../src/contexts/AuthContext";
import {
  useOnboarding,
  DEV_ALWAYS_SHOW_ONBOARDING,
} from "../../src/contexts/OnboardingContext";
import type { Project } from "../../src/services/projectService.types";
import type { ProjectActivity } from "../../src/services/activityService.types";

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
        style={styles.projectCard}
        onPress={() =>
          router.push({
            pathname: "/project/[id]",
            params: { id: String(item.id) },
          })
        }
      >
        <Text style={styles.projectName}>{item.name}</Text>
        <Text style={styles.projectDescription}>
          {item.description || "No description"}
        </Text>
        <View style={styles.projectMeta}>
          <Text style={styles.dateText}>
            Created: {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderActivity = ({ item }: { item: MyActivity }) => (
    <TouchableOpacity
      style={styles.activityCard}
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
        <Text style={styles.activityDate}>
          {activityService.formatTimestamp(item.created_at)}
        </Text>
      </View>
      <Text style={styles.activityDescription}>
        {activityService.getActivityDescription(item)}
      </Text>
      {item.user_name && (
        <Text style={styles.activityUser}>by {item.user_name}</Text>
      )}
    </TouchableOpacity>
  );

  if (showSkeleton) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Projects</Text>
          <Text style={styles.headerSubtitle}>Manage your excavation projects</Text>
        </View>
        <ProjectListSkeleton count={4} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Projects</Text>
        <Text style={styles.headerSubtitle}>Manage your excavation projects</Text>
      </View>

      {/* Sub-tab selector */}
      <View style={styles.subTabContainer}>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === "projects" && styles.subTabActive]}
          onPress={() => handleSubTabChange("projects")}
        >
          <Text
            style={[
              styles.subTabText,
              activeSubTab === "projects" && styles.subTabTextActive,
            ]}
          >
            All Projects
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === "mystuff" && styles.subTabActive]}
          onPress={() => handleSubTabChange("mystuff")}
        >
          <Text
            style={[
              styles.subTabText,
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
              <Text style={styles.emptyText}>No projects yet</Text>
              <Text style={styles.emptySubtext}>
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
            <Text style={styles.myFolderSectionTitle}>My Folders</Text>
            <Text style={styles.myFolderSectionSubtitle}>
              Access your private folders from each project
            </Text>
            {projects.length === 0 ? (
              <View style={styles.emptyTimeline}>
                <Text style={styles.emptyTimelineText}>No projects yet</Text>
                <Text style={styles.emptyTimelineSubtext}>
                  Join or create a project to get your personal folder
                </Text>
              </View>
            ) : (
              projects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={styles.myFolderButton}
                  onPress={() =>
                    router.push({
                      pathname: "/project/[id]",
                      params: { id: String(project.id), openFiles: "myFolder" },
                    })
                  }
                >
                  <Text style={styles.myFolderIcon}>📁</Text>
                  <View style={styles.myFolderInfo}>
                    <Text style={styles.myFolderTitle}>{project.name}</Text>
                    <Text style={styles.myFolderSubtitle}>
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
            <Text style={styles.timelineSectionTitle}>Recent Activity</Text>
            {activities.length === 0 ? (
              <View style={styles.emptyTimeline}>
                <Text style={styles.emptyTimelineText}>No recent activity</Text>
                <Text style={styles.emptyTimelineSubtext}>
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
        <IconSymbol name="plus" size={28} color="#F5F5F5" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111111" },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111111",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "web" ? 8 : 60,
    paddingBottom: 16,
    backgroundColor: "#111111",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#F5F5F5",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: "#9A9A9A",
    marginTop: 6,
  },
  // Sub-tab styles
  subTabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: "#111111",
  },
  subTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  subTabActive: {
    backgroundColor: "#FF2A2A",
    borderColor: "#FF2A2A",
  },
  subTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9A9A9A",
    letterSpacing: 0.3,
  },
  subTabTextActive: {
    color: "#F5F5F5",
  },

  listContainer: { padding: 16 },
  projectCard: {
    backgroundColor: "#1A1A1A",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  projectName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  projectDescription: {
    fontSize: 14,
    color: "#9A9A9A",
    marginBottom: 12,
    lineHeight: 20,
  },
  projectMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
  },
  roleText: {
    fontSize: 12,
    color: "#FF2A2A",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  dateText: { fontSize: 12, color: "#9A9A9A", letterSpacing: 0.5 },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: "#F5F5F5",
    marginBottom: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9A9A9A",
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
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
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
    color: "#F5F5F5",
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  myFolderSubtitle: {
    fontSize: 13,
    color: "#9A9A9A",
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
    color: "#F5F5F5",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  myFolderSectionSubtitle: {
    fontSize: 13,
    color: "#9A9A9A",
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  timelineSection: {
    marginBottom: 16,
  },
  timelineSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  emptyTimeline: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  emptyTimelineText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 8,
  },
  emptyTimelineSubtext: {
    fontSize: 14,
    color: "#9A9A9A",
    textAlign: "center",
  },
  activityCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
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
    color: "#9A9A9A",
    letterSpacing: 0.3,
  },
  activityDescription: {
    fontSize: 15,
    color: "#F5F5F5",
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  activityUser: {
    fontSize: 12,
    color: "#9A9A9A",
    marginTop: 8,
    letterSpacing: 0.3,
  },
});

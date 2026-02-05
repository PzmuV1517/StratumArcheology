import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { projectService } from "../../src/services/projectService";
import { activityService } from "../../src/services/activityService";
import { useAuth } from "../../src/contexts/AuthContext";
import type { Project } from "../../src/services/projectService.types";

interface Activity {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
  user_id?: string;
  project_id: string;
}

// All available quick actions
interface QuickAction {
  id: string;
  icon: string;
  label: string;
  route: string;
}

const ALL_QUICK_ACTIONS: QuickAction[] = [
  { id: "new-project", icon: "➕", label: "New Project", route: "/modal" },
  { id: "join-project", icon: "🔗", label: "Join Project", route: "/join-project" },
  { id: "settings", icon: "⚙️", label: "Settings", route: "/settings" },
  { id: "projects", icon: "📁", label: "All Projects", route: "/(tabs)/projects" },
  { id: "voice-note", icon: "🎙️", label: "Voice Note", route: "/create-note?voice=true" },
  { id: "new-note", icon: "📝", label: "New Note", route: "/create-note" },
];

const DEFAULT_ACTIONS = ["new-project", "join-project", "settings"];
const QUICK_ACTIONS_KEY = "overview_quick_actions";

/**
 * Overview Tab - Main landing page showing:
 * - User welcome
 * - Top 3 recent projects with interactive timelines
 * - Quick actions
 */
export default function OverviewScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [projectActivities, setProjectActivities] = useState<
    Record<string, Activity[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  
  // Quick actions customization
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>(DEFAULT_ACTIONS);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);

  // Load saved quick actions on mount
  useEffect(() => {
    AsyncStorage.getItem(QUICK_ACTIONS_KEY).then((saved) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSelectedActionIds(parsed);
          }
        } catch {
          // Use default
        }
      }
    });
  }, []);

  const openModifyModal = () => {
    setTempSelectedIds([...selectedActionIds]);
    setShowModifyModal(true);
  };

  const toggleAction = (actionId: string) => {
    setTempSelectedIds((prev) => {
      if (prev.includes(actionId)) {
        // Don't allow less than 1 action
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== actionId);
      } else {
        // Max 4 actions
        if (prev.length >= 4) return prev;
        return [...prev, actionId];
      }
    });
  };

  const saveQuickActions = async () => {
    setSelectedActionIds(tempSelectedIds);
    await AsyncStorage.setItem(QUICK_ACTIONS_KEY, JSON.stringify(tempSelectedIds));
    setShowModifyModal(false);
  };

  const getSelectedActions = (): QuickAction[] => {
    return selectedActionIds
      .map((id) => ALL_QUICK_ACTIONS.find((a) => a.id === id))
      .filter(Boolean) as QuickAction[];
  };

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
            activitiesMap[project.id] = activities as Activity[];
          } catch (err) {
            console.error(`Failed to load activities for project ${project.id}:`, err);
            activitiesMap[project.id] = [];
          }
        })
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

  const getActivityIcon = (type: string): string => {
    switch (type) {
      case "project_created":
      case "PROJECT_CREATED":
        return "🎉";
      case "file_uploaded":
      case "FILE_UPLOADED":
        return "📄";
      case "note_created":
      case "NOTE_CREATED":
        return "📝";
      case "member_joined":
      case "MEMBER_JOINED":
        return "👤";
      case "folder_created":
      case "FOLDER_CREATED":
        return "📁";
      default:
        return "•";
    }
  };

  const renderProjectCard = (project: Project) => {
    const activities = projectActivities[project.id] || [];

    return (
      <TouchableOpacity
        key={project.id}
        style={styles.projectCard}
        onPress={() => router.push(`/project/${project.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.projectHeader}>
          <Text style={styles.projectName} numberOfLines={1}>
            {project.name}
          </Text>
          <Text style={styles.projectDate}>
            {formatTimeAgo(project.updated_at || project.created_at)}
          </Text>
        </View>

        {project.description && (
          <Text style={styles.projectDescription} numberOfLines={2}>
            {project.description}
          </Text>
        )}

        {/* Interactive Timeline */}
        <View style={styles.timelineContainer}>
          <Text style={styles.timelineTitle}>Recent Activity</Text>
          {activitiesLoading ? (
            <ActivityIndicator
              size="small"
              color="#FF2A2A"
              style={{ marginVertical: 8 }}
            />
          ) : activities.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.timelineScroll}
              contentContainerStyle={styles.timelineContent}
            >
              {activities.map((activity, index) => (
                <View key={activity.id || index} style={styles.timelineItem}>
                  <Text style={styles.timelineIcon}>
                    {getActivityIcon(activity.activity_type)}
                  </Text>
                  <Text style={styles.timelineText} numberOfLines={2}>
                    {activity.description}
                  </Text>
                  <Text style={styles.timelineTime}>
                    {formatTimeAgo(activity.created_at)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noActivityText}>No recent activity</Text>
          )}
        </View>

        <View style={styles.projectFooter}>
          <Text style={styles.viewProjectText}>View Project →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF2A2A" />
        <Text style={styles.loadingText}>Loading your workspace...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>
          Welcome back
          {user?.display_name ? `, ${user.display_name.split(" ")[0]}` : ""}
        </Text>
        <Text style={styles.subtitleText}>
          {"Here's what's happening in your projects"}
        </Text>
      </View>

      {/* Recent Projects Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Projects</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)")}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {recentProjects.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>📁</Text>
            <Text style={styles.emptyStateTitle}>No projects yet</Text>
            <Text style={styles.emptyStateSubtitle}>
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

      {/* Quick Actions Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
            Quick Actions
          </Text>
          <TouchableOpacity
            style={styles.modifyButton}
            onPress={openModifyModal}
          >
            <Text style={styles.modifyButtonText}>Modify</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.quickActions}>
          {getSelectedActions().map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.quickActionButton}
              onPress={() => router.push(action.route as any)}
            >
              <Text style={styles.quickActionIcon}>{action.icon}</Text>
              <Text style={styles.quickActionText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Modify Quick Actions Modal */}
      <Modal
        visible={showModifyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModifyModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Customize Quick Actions</Text>
            <Text style={styles.modalSubtitle}>
              Select 1-4 actions to show on your overview
            </Text>
            
            <View style={styles.actionsList}>
              {ALL_QUICK_ACTIONS.map((action) => {
                const isSelected = tempSelectedIds.includes(action.id);
                return (
                  <TouchableOpacity
                    key={action.id}
                    style={[
                      styles.actionItem,
                      isSelected && styles.actionItemSelected,
                    ]}
                    onPress={() => toggleAction(action.id)}
                  >
                    <Text style={styles.actionItemIcon}>{action.icon}</Text>
                    <Text style={[
                      styles.actionItemLabel,
                      isSelected && styles.actionItemLabelSelected,
                    ]}>
                      {action.label}
                    </Text>
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowModifyModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveQuickActions}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  contentContainer: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111111",
  },
  loadingText: {
    marginTop: 16,
    color: "#9A9A9A",
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
    color: "#F5F5F5",
    letterSpacing: 0.5,
  },
  subtitleText: {
    fontSize: 16,
    color: "#9A9A9A",
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
    color: "#F5F5F5",
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
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
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
    color: "#F5F5F5",
    flex: 1,
    marginRight: 12,
  },
  projectDate: {
    fontSize: 12,
    color: "#666",
  },
  projectDescription: {
    fontSize: 14,
    color: "#9A9A9A",
    marginBottom: 12,
    lineHeight: 20,
  },
  timelineContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
  },
  timelineTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
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
    backgroundColor: "#0E0E0E",
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 140,
    minHeight: 80,
  },
  timelineIcon: {
    fontSize: 16,
    marginBottom: 6,
  },
  timelineText: {
    fontSize: 12,
    color: "#EAEAEA",
    lineHeight: 16,
    marginBottom: 6,
  },
  timelineTime: {
    fontSize: 10,
    color: "#666",
  },
  noActivityText: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
  projectFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
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
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: "#9A9A9A",
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
  modifyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#2A2A2A",
  },
  modifyButtonText: {
    color: "#9A9A9A",
    fontSize: 12,
    fontWeight: "500",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: "#F5F5F5",
    fontWeight: "500",
    textAlign: "center",
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#9A9A9A",
    marginBottom: 24,
    textAlign: "center",
  },
  actionsList: {
    gap: 12,
    marginBottom: 24,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#111111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  actionItemSelected: {
    borderColor: "#FF2A2A",
    backgroundColor: "rgba(255, 42, 42, 0.1)",
  },
  actionItemIcon: {
    fontSize: 22,
    marginRight: 14,
  },
  actionItemLabel: {
    flex: 1,
    fontSize: 15,
    color: "#9A9A9A",
    fontWeight: "500",
  },
  actionItemLabelSelected: {
    color: "#F5F5F5",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#3A3A3A",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: "#FF2A2A",
    borderColor: "#FF2A2A",
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#9A9A9A",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#FF2A2A",
    alignItems: "center",
  },
  saveButtonText: {
    color: "#F5F5F5",
    fontSize: 16,
    fontWeight: "600",
  },
});

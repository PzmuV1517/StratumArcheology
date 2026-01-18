import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { projectService } from '../../src/services/projectService';
import { useAuth } from '../../src/contexts/AuthContext';
import type { Project } from '../../src/services/projectService.types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../../src/config/config';

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
 * - Quick actions
 */
export default function OverviewScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [projectActivities, setProjectActivities] = useState<Record<string, Activity[]>>({});
  const [loading, setLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

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
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load projects on mount and focus
  useFocusEffect(loadRecentProjects);

  const loadProjectActivities = async (projects: Project[]) => {
    setActivitiesLoading(true);
    const activitiesMap: Record<string, Activity[]> = {};
    
    try {
      const token = await AsyncStorage.getItem('authToken');
      const apiBaseUrl = config.apiBaseUrl.replace('/api', '') || 'http://localhost:8000';
      
      for (const project of projects) {
        try {
          const response = await fetch(`${apiBaseUrl}/api/activities/project/${project.id}?limit=5`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (response.ok) {
            const activities = await response.json();
            activitiesMap[project.id] = activities;
          }
        } catch (err) {
          console.error(`Failed to load activities for project ${project.id}:`, err);
          activitiesMap[project.id] = [];
        }
      }
      
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

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getActivityIcon = (type: string): string => {
    switch (type) {
      case 'project_created':
      case 'PROJECT_CREATED':
        return '🎉';
      case 'file_uploaded':
      case 'FILE_UPLOADED':
        return '📄';
      case 'note_created':
      case 'NOTE_CREATED':
        return '📝';
      case 'member_joined':
      case 'MEMBER_JOINED':
        return '👤';
      case 'folder_created':
      case 'FOLDER_CREATED':
        return '📁';
      default:
        return '•';
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
            <ActivityIndicator size="small" color="#FF2A2A" style={{ marginVertical: 8 }} />
          ) : activities.length > 0 ? (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.timelineScroll}
              contentContainerStyle={styles.timelineContent}
            >
              {activities.map((activity, index) => (
                <View key={activity.id || index} style={styles.timelineItem}>
                  <Text style={styles.timelineIcon}>{getActivityIcon(activity.activity_type)}</Text>
                  <Text style={styles.timelineText} numberOfLines={2}>
                    {activity.description}
                  </Text>
                  <Text style={styles.timelineTime}>{formatTimeAgo(activity.created_at)}</Text>
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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>
          Welcome back{user?.display_name ? `, ${user.display_name.split(' ')[0]}` : ''}
        </Text>
        <Text style={styles.subtitleText}>
          {"Here's what's happening in your projects"}
        </Text>
      </View>

      {/* Recent Projects Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Projects</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)')}>
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
              onPress={() => router.push('/modal')}
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
        <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/modal')}
          >
            <Text style={styles.quickActionIcon}>➕</Text>
            <Text style={styles.quickActionText}>New Project</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/join-project')}
          >
            <Text style={styles.quickActionIcon}>🔗</Text>
            <Text style={styles.quickActionText}>Join Project</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.quickActionIcon}>⚙️</Text>
            <Text style={styles.quickActionText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111111',
  },
  loadingText: {
    marginTop: 16,
    color: '#9A9A9A',
    fontSize: 14,
  },
  welcomeSection: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 8,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F5F5F5',
    letterSpacing: 0.5,
  },
  subtitleText: {
    fontSize: 16,
    color: '#9A9A9A',
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F5F5F5',
    letterSpacing: 0.5,
  },
  seeAllText: {
    fontSize: 14,
    color: '#FF2A2A',
    fontWeight: '500',
  },
  projectsGrid: {
    gap: 16,
  },
  projectCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F5F5F5',
    flex: 1,
    marginRight: 12,
  },
  projectDate: {
    fontSize: 12,
    color: '#666',
  },
  projectDescription: {
    fontSize: 14,
    color: '#9A9A9A',
    marginBottom: 12,
    lineHeight: 20,
  },
  timelineContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  timelineTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timelineScroll: {
    marginHorizontal: -4,
  },
  timelineContent: {
    paddingHorizontal: 4,
  },
  timelineItem: {
    backgroundColor: '#0E0E0E',
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
    color: '#EAEAEA',
    lineHeight: 16,
    marginBottom: 6,
  },
  timelineTime: {
    fontSize: 10,
    color: '#666',
  },
  noActivityText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  projectFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    alignItems: 'flex-end',
  },
  viewProjectText: {
    fontSize: 14,
    color: '#FF2A2A',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F5F5F5',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#9A9A9A',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#FF2A2A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#F5F5F5',
    fontSize: 16,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#F5F5F5',
    fontWeight: '500',
    textAlign: 'center',
  },
});

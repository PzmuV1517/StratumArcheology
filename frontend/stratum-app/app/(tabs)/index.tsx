import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { projectService } from '../../src/services/projectService';
import { activityService } from '../../src/services/activityService';
import { ProjectActionModal } from '../../src/components/project/modals/ProjectActionModal';
import type { Project } from '../../src/services/projectService.types';

interface Activity {
  id: string;
  description: string;
  created_at: string;
  project_id: string;
  project_name?: string;
  user_name?: string;
}

export default function ProjectsScreen() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'projects' | 'mystuff'>('projects');
  const router = useRouter();

  const loadProjects = useCallback(async () => {
    try {
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load projects');
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
      console.error('Failed to load activities:', error);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Reload projects when screen comes back into focus (after creating a project)
  useFocusEffect(
    useCallback(() => {
      loadProjects();
      if (activeSubTab === 'mystuff') {
        loadMyActivities();
      }
    }, [loadProjects, loadMyActivities, activeSubTab])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadProjects();
    if (activeSubTab === 'mystuff') {
      loadMyActivities();
    }
  };

  const handleSubTabChange = (tab: 'projects' | 'mystuff') => {
    setActiveSubTab(tab);
    if (tab === 'mystuff' && activities.length === 0) {
      loadMyActivities();
    }
  };

  const renderProject = ({ item }: any) => (
    <TouchableOpacity style={styles.projectCard} onPress={() => router.push(`/project/${item.id}`)}>
      <Text style={styles.projectName}>{item.name}</Text>
      <Text style={styles.projectDescription}>{item.description || 'No description'}</Text>
      <View style={styles.projectMeta}>
        <Text style={styles.dateText}>Created: {new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderActivity = ({ item }: { item: Activity }) => (
    <TouchableOpacity 
      style={styles.activityCard} 
      onPress={() => router.push(`/project/${item.project_id}`)}
    >
      <View style={styles.activityHeader}>
        <Text style={styles.activityProjectName}>{item.project_name}</Text>
        <Text style={styles.activityDate}>
          {new Date(item.created_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <Text style={styles.activityDescription}>{item.description}</Text>
      {item.user_name && (
        <Text style={styles.activityUser}>by {item.user_name}</Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Projects</Text>
      </View>

      {/* Sub-tab selector */}
      <View style={styles.subTabContainer}>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'projects' && styles.subTabActive]}
          onPress={() => handleSubTabChange('projects')}
        >
          <Text style={[styles.subTabText, activeSubTab === 'projects' && styles.subTabTextActive]}>
            All Projects
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'mystuff' && styles.subTabActive]}
          onPress={() => handleSubTabChange('mystuff')}
        >
          <Text style={[styles.subTabText, activeSubTab === 'mystuff' && styles.subTabTextActive]}>
            My Stuff
          </Text>
        </TouchableOpacity>
      </View>

      {activeSubTab === 'projects' ? (
        <>
          {projects.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No projects yet</Text>
              <Text style={styles.emptySubtext}>Create your first project to get started</Text>
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
        <ScrollView style={styles.myStuffContainer} contentContainerStyle={styles.myStuffContent}>
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
                  onPress={() => router.push({ pathname: `/project/${project.id}`, params: { openFiles: 'myFolder' } })}
                >
                  <Text style={styles.myFolderIcon}>📁</Text>
                  <View style={styles.myFolderInfo}>
                    <Text style={styles.myFolderTitle}>{project.name}</Text>
                    <Text style={styles.myFolderSubtitle}>Open your private folder</Text>
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
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            )}
          </View>
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowActionModal(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <ProjectActionModal
        visible={showActionModal}
        onClose={() => setShowActionModal(false)}
        onCreateProject={() => router.push('/modal')}
        onJoinProject={() => router.push('/join-project')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111111' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 24, 
    paddingTop: 60, 
    backgroundColor: '#111111',
    borderBottomWidth: 1, 
    borderBottomColor: '#2A2A2A' 
  },
  headerTitle: { fontSize: 32, fontWeight: '700', color: '#F5F5F5', letterSpacing: 0.5 },
  
  // Sub-tab styles
  subTabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#111111',
  },
  subTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  subTabActive: {
    backgroundColor: '#FF2A2A',
    borderColor: '#FF2A2A',
  },
  subTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9A9A9A',
    letterSpacing: 0.3,
  },
  subTabTextActive: {
    color: '#F5F5F5',
  },
  
  listContainer: { padding: 16 },
  projectCard: { 
    backgroundColor: '#1A1A1A', 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 16, 
    borderWidth: 1,
    borderColor: '#2A2A2A',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.4, 
    shadowRadius: 20, 
    elevation: 8 
  },
  projectName: { fontSize: 18, fontWeight: '600', color: '#F5F5F5', marginBottom: 8, letterSpacing: 0.5 },
  projectDescription: { fontSize: 14, color: '#9A9A9A', marginBottom: 12, lineHeight: 20 },
  projectMeta: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#2A2A2A' },
  roleText: { fontSize: 12, color: '#FF2A2A', fontWeight: '600', letterSpacing: 0.5 },
  dateText: { fontSize: 12, color: '#9A9A9A', letterSpacing: 0.5 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 18, color: '#F5F5F5', marginBottom: 10, fontWeight: '600', letterSpacing: 0.5 },
  emptySubtext: { fontSize: 14, color: '#9A9A9A', textAlign: 'center', letterSpacing: 0.5 },
  fab: { 
    position: 'absolute', 
    right: 24, 
    bottom: Platform.OS === 'ios' ? 100 : 24, 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: '#FF2A2A', 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#FF2A2A', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.4, 
    shadowRadius: 20, 
    elevation: 8 
  },
  fabText: { fontSize: 32, color: '#F5F5F5', lineHeight: 36, fontWeight: '300' },
  
  // My Stuff styles
  myStuffContainer: {
    flex: 1,
  },
  myStuffContent: {
    padding: 16,
    paddingBottom: 100,
  },
  myFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
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
    fontWeight: '600',
    color: '#F5F5F5',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  myFolderSubtitle: {
    fontSize: 13,
    color: '#9A9A9A',
    letterSpacing: 0.3,
  },
  myFolderArrow: {
    fontSize: 18,
    color: '#FF2A2A',
    fontWeight: '600',
  },
  myFolderSection: {
    marginBottom: 24,
  },
  myFolderSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F5F5F5',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  myFolderSectionSubtitle: {
    fontSize: 13,
    color: '#9A9A9A',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  timelineSection: {
    marginBottom: 16,
  },
  timelineSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F5F5F5',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  emptyTimeline: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  emptyTimelineText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5F5F5',
    marginBottom: 8,
  },
  emptyTimelineSubtext: {
    fontSize: 14,
    color: '#9A9A9A',
    textAlign: 'center',
  },
  activityCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityProjectName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF2A2A',
    letterSpacing: 0.3,
  },
  activityDate: {
    fontSize: 12,
    color: '#9A9A9A',
    letterSpacing: 0.3,
  },
  activityDescription: {
    fontSize: 15,
    color: '#F5F5F5',
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  activityUser: {
    fontSize: 12,
    color: '#9A9A9A',
    marginTop: 8,
    letterSpacing: 0.3,
  },
});

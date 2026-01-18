import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { projectService, activityService } from '../../src/services/projectService';
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

  useEffect(() => {
    loadProjects();
  }, []);

  // Reload projects when screen comes back into focus (after creating a project)
  useFocusEffect(
    React.useCallback(() => {
      loadProjects();
      if (activeSubTab === 'mystuff') {
        loadMyActivities();
      }
    }, [activeSubTab])
  );

  const loadProjects = async () => {
    try {
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load projects');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMyActivities = async () => {
    try {
      // Get activities from all projects
      const allActivities: Activity[] = [];
      for (const project of projects) {
        try {
          const projectActivities = await activityService.getProjectActivities(project.id);
          // Add project name to each activity
          const withProjectName = projectActivities.map((a: Activity) => ({
            ...a,
            project_name: project.name,
          }));
          allActivities.push(...withProjectName);
        } catch {
          // ignore errors for individual projects
        }
      }
      // Sort by created_at descending
      allActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(allActivities.slice(0, 50)); // Limit to 50 most recent
    } catch (error) {
      console.error('Failed to load activities:', error);
    }
  };

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
          {/* My Folder quick access */}
          <TouchableOpacity 
            style={styles.myFolderButton}
            onPress={() => {
              // TODO: Navigate to My Folder view when implemented
              Alert.alert('Coming Soon', 'My Folder feature is coming soon!');
            }}
          >
            <Text style={styles.myFolderIcon}>📁</Text>
            <View style={styles.myFolderInfo}>
              <Text style={styles.myFolderTitle}>My Folder</Text>
              <Text style={styles.myFolderSubtitle}>Your private files across all projects</Text>
            </View>
            <Text style={styles.myFolderArrow}>→</Text>
          </TouchableOpacity>

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
    bottom: 24, 
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
  fabText: { fontSize: 32, color: '#F5F5F5', lineHeight: 36, fontWeight: '300' }
});

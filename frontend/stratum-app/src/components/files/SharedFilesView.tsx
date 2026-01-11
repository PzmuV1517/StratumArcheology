/**
 * SharedFilesView Component
 * 
 * Displays files that have been shared with the user ("Shared with me")
 * and files the user has shared with others ("Shared by me").
 * 
 * Uses the backend endpoints:
 * - GET /files/project/{projectId}/shared-with-me
 * - GET /files/project/{projectId}/shared-by-me
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import api from '../../services/api';

interface SharedFile {
  id: string;
  name: string;
  type: 'file' | 'folder';
  mime_type?: string;
  size?: number;
  owner_id?: string;
  privacy: 'private' | 'shared' | 'project' | 'public';
  shared_with?: string[];
  owner_name?: string;
  updated_at?: string;
}

interface SharedFilesViewProps {
  projectId: string;
  onFilePress?: (file: SharedFile) => void;
  onClose?: () => void;
}

export default function SharedFilesView({ projectId, onFilePress, onClose }: SharedFilesViewProps) {
  const [activeTab, setActiveTab] = useState<'with-me' | 'by-me'>('with-me');
  const [sharedWithMe, setSharedWithMe] = useState<SharedFile[]>([]);
  const [sharedByMe, setSharedByMe] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSharedFiles = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError(null);

      const [withMeResponse, byMeResponse] = await Promise.all([
        api.get(`/files/project/${projectId}/shared-with-me`),
        api.get(`/files/project/${projectId}/shared-by-me`),
      ]);

      setSharedWithMe(withMeResponse.data.files || []);
      setSharedByMe(byMeResponse.data.files || []);
    } catch (err: any) {
      console.error('[SharedFilesView] Failed to load shared files:', err);
      setError(err.message || 'Failed to load shared files');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadSharedFiles();
  }, [loadSharedFiles]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadSharedFiles(false);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  const getFileIcon = (file: SharedFile) => {
    if (file.type === 'folder') return '📁';
    if (file.mime_type?.startsWith('image/')) return '🖼️';
    if (file.mime_type?.startsWith('video/')) return '🎬';
    if (file.mime_type?.startsWith('audio/')) return '🎵';
    if (file.mime_type?.includes('pdf')) return '📄';
    if (file.mime_type?.includes('document') || file.mime_type?.includes('word')) return '📝';
    if (file.mime_type?.includes('spreadsheet') || file.mime_type?.includes('excel')) return '📊';
    return '📎';
  };

  const renderFileItem = (file: SharedFile, showOwner = false) => (
    <TouchableOpacity
      key={file.id}
      style={styles.fileItem}
      onPress={() => onFilePress?.(file)}
    >
      <Text style={styles.fileIcon}>{getFileIcon(file)}</Text>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
        <View style={styles.fileMeta}>
          {showOwner && file.owner_name && (
            <Text style={styles.ownerText}>From: {file.owner_name}</Text>
          )}
          {!showOwner && file.shared_with && file.shared_with.length > 0 && (
            <Text style={styles.sharedWithText}>
              Shared with {file.shared_with.length} user(s)
            </Text>
          )}
          {file.size && <Text style={styles.sizeText}>{formatFileSize(file.size)}</Text>}
          {file.updated_at && <Text style={styles.dateText}>{formatDate(file.updated_at)}</Text>}
        </View>
      </View>
      <View style={[styles.privacyBadge, getPrivacyBadgeStyle(file.privacy)]}>
        <Text style={styles.privacyText}>{file.privacy}</Text>
      </View>
    </TouchableOpacity>
  );

  const getPrivacyBadgeStyle = (privacy: string) => {
    switch (privacy) {
      case 'private':
        return { backgroundColor: '#6c757d' };
      case 'shared':
        return { backgroundColor: '#007bff' };
      case 'project':
        return { backgroundColor: '#28a745' };
      case 'public':
        return { backgroundColor: '#ffc107' };
      default:
        return { backgroundColor: '#6c757d' };
    }
  };

  const currentFiles = activeTab === 'with-me' ? sharedWithMe : sharedByMe;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF2A2A" />
        <Text style={styles.loadingText}>Loading shared files...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Shared Files</Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'with-me' && styles.activeTab]}
          onPress={() => setActiveTab('with-me')}
        >
          <Text style={[styles.tabText, activeTab === 'with-me' && styles.activeTabText]}>
            Shared with me
          </Text>
          {sharedWithMe.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{sharedWithMe.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'by-me' && styles.activeTab]}
          onPress={() => setActiveTab('by-me')}
        >
          <Text style={[styles.tabText, activeTab === 'by-me' && styles.activeTabText]}>
            Shared by me
          </Text>
          {sharedByMe.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{sharedByMe.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Error state */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadSharedFiles()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* File list */}
      <ScrollView
        style={styles.fileList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FF2A2A"
          />
        }
      >
        {currentFiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>
              {activeTab === 'with-me' ? '📥' : '📤'}
            </Text>
            <Text style={styles.emptyTitle}>
              {activeTab === 'with-me'
                ? 'No files shared with you'
                : 'You haven\'t shared any files'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'with-me'
                ? 'Files shared with you by project members will appear here'
                : 'Share files with team members to see them here'}
            </Text>
          </View>
        ) : (
          currentFiles.map((file) => renderFileItem(file, activeTab === 'with-me'))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111111',
  },
  loadingText: {
    color: '#9A9A9A',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  closeButton: {
    padding: 8,
    marginRight: 8,
  },
  closeText: {
    color: '#9A9A9A',
    fontSize: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F5F5F5',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF2A2A',
  },
  tabText: {
    fontSize: 14,
    color: '#9A9A9A',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#F5F5F5',
  },
  countBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    color: '#9A9A9A',
    fontSize: 11,
    fontWeight: '600',
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#FF4444',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#FF2A2A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: '#F5F5F5',
    fontWeight: '600',
  },
  fileList: {
    flex: 1,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  fileIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    color: '#F5F5F5',
    fontWeight: '500',
    marginBottom: 4,
  },
  fileMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ownerText: {
    fontSize: 12,
    color: '#9A9A9A',
  },
  sharedWithText: {
    fontSize: 12,
    color: '#007bff',
  },
  sizeText: {
    fontSize: 12,
    color: '#666',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  privacyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  privacyText: {
    fontSize: 10,
    color: '#F5F5F5',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F5F5F5',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9A9A9A',
    textAlign: 'center',
    lineHeight: 20,
  },
});

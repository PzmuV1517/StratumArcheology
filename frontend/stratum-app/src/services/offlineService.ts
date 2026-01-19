/**
 * STRATUM Offline Service
 *
 * Manages offline data caching:
 * - Automatically caches last 3 accessed projects
 * - Allows users to manually save files for offline viewing
 * - Provides offline data access when no network available
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { OfflineFile, RecentProject } from '../db/schema';

// Storage keys for web fallback
const RECENT_PROJECTS_KEY = '@stratum_recent_projects';
const OFFLINE_FILES_KEY = '@stratum_offline_files';
const MAX_RECENT_PROJECTS = 3;

// Get document directory for offline files - fallback to cache if needed
const getDocumentDir = (): string => {
  if (Platform.OS === 'web') {
    return 'offline_files'; // Virtual path for web
  }
  // For offline files, prefer documentDirectory as it persists between app updates
  // Fall back to cacheDirectory if not available
  const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!dir) {
    console.warn('[OfflineService] No document or cache directory available');
    return '';
  }
  return dir;
};

// Get offline files directory
const getOfflineFilesDir = async (): Promise<string> => {
  if (Platform.OS === 'web') {
    return 'offline_files'; // Virtual path for web
  }
  const docDir = getDocumentDir();
  if (!docDir) {
    throw new Error('Document directory not available');
  }
  const dir = `${docDir}offline_files/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
};

/**
 * Recent Projects Cache (Last 3 accessed)
 */
export const recentProjectsCache = {
  /**
   * Save a project to recent cache (called when user opens a project)
   */
  saveRecentProject: async (
    projectId: string,
    projectData: any,
    notesData: any[],
    membersData: any[]
  ): Promise<void> => {
    try {
      const recentProjects = await recentProjectsCache.getRecentProjects();

      // Remove if already exists
      const filtered = recentProjects.filter((p) => p.project_id !== projectId);

      // Add to front
      const newEntry: RecentProject = {
        id: `recent_${projectId}`,
        project_id: projectId,
        project_data: JSON.stringify(projectData),
        notes_data: JSON.stringify(notesData),
        members_data: JSON.stringify(membersData),
        accessed_at: new Date().toISOString(),
      };

      filtered.unshift(newEntry);

      // Keep only last MAX_RECENT_PROJECTS
      const trimmed = filtered.slice(0, MAX_RECENT_PROJECTS);

      await AsyncStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(trimmed));
      console.log(
        `[OfflineService] Cached project ${projectId} (${trimmed.length} recent projects)`
      );
    } catch (error) {
      console.error('[OfflineService] Failed to save recent project:', error);
    }
  },

  /**
   * Get all recent projects
   */
  getRecentProjects: async (): Promise<RecentProject[]> => {
    try {
      const data = await AsyncStorage.getItem(RECENT_PROJECTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[OfflineService] Failed to get recent projects:', error);
      return [];
    }
  },

  /**
   * Get a specific cached project
   */
  getCachedProject: async (
    projectId: string
  ): Promise<{
    project: any;
    notes: any[];
    members: any[];
  } | null> => {
    try {
      const recentProjects = await recentProjectsCache.getRecentProjects();
      const cached = recentProjects.find((p) => p.project_id === projectId);

      if (!cached) return null;

      return {
        project: JSON.parse(cached.project_data),
        notes: JSON.parse(cached.notes_data),
        members: JSON.parse(cached.members_data),
      };
    } catch (error) {
      console.error('[OfflineService] Failed to get cached project:', error);
      return null;
    }
  },

  /**
   * Check if a project is cached
   */
  isProjectCached: async (projectId: string): Promise<boolean> => {
    const recentProjects = await recentProjectsCache.getRecentProjects();
    return recentProjects.some((p) => p.project_id === projectId);
  },

  /**
   * Remove a specific project from the cache
   */
  removeProject: async (projectId: string): Promise<void> => {
    try {
      const recentProjects = await recentProjectsCache.getRecentProjects();
      const filtered = recentProjects.filter((p) => p.project_id !== projectId);
      await AsyncStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(filtered));
      console.log(`[OfflineService] Removed project ${projectId} from cache`);
    } catch (error) {
      console.error('[OfflineService] Failed to remove project from cache:', error);
    }
  },

  /**
   * Clear all recent projects cache
   */
  clearCache: async (): Promise<void> => {
    await AsyncStorage.removeItem(RECENT_PROJECTS_KEY);
  },
};

/**
 * Offline Files Storage (Save for Offline feature)
 */
export const offlineFilesStorage = {
  /**
   * Save files for offline access
   */
  saveFilesForOffline: async (
    projectId: string,
    files: {
      id: string;
      name: string;
      mime_type?: string;
      size?: number;
      parent_id?: string | null;
      downloadUrl: string;
      updated_at?: string; // Remote updated_at for sync tracking
    }[],
    onProgress?: (current: number, total: number, fileName: string) => void
  ): Promise<{ success: number; failed: number; errors: string[] }> => {
    const results = { success: 0, failed: 0, errors: [] as string[] };

    if (Platform.OS === 'web') {
      // Web: Store metadata only (actual files use browser cache)
      try {
        const existingData = await AsyncStorage.getItem(OFFLINE_FILES_KEY);
        const offlineFiles: OfflineFile[] = existingData ? JSON.parse(existingData) : [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          onProgress?.(i + 1, files.length, file.name);

          const existingIndex = offlineFiles.findIndex((f) => f.node_id === file.id);
          const newEntry: OfflineFile = {
            id: `offline_${file.id}`,
            project_id: projectId,
            node_id: file.id,
            name: file.name,
            mime_type: file.mime_type || 'application/octet-stream',
            size: file.size || 0,
            local_path: file.downloadUrl, // On web, store the URL
            parent_id: file.parent_id || null,
            created_at: new Date().toISOString(),
            downloaded_at: new Date().toISOString(),
            last_accessed_at: new Date().toISOString(),
            remote_updated_at: file.updated_at || new Date().toISOString(),
          };

          if (existingIndex >= 0) {
            offlineFiles[existingIndex] = newEntry;
          } else {
            offlineFiles.push(newEntry);
          }
          results.success++;
        }

        await AsyncStorage.setItem(OFFLINE_FILES_KEY, JSON.stringify(offlineFiles));
      } catch (error: any) {
        results.errors.push(`Web storage error: ${error.message}`);
        results.failed = files.length;
      }
      return results;
    }

    // Native: Download files to local storage
    const offlineDir = await getOfflineFilesDir();
    const existingData = await AsyncStorage.getItem(OFFLINE_FILES_KEY);
    const offlineFiles: OfflineFile[] = existingData ? JSON.parse(existingData) : [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      onProgress?.(i + 1, files.length, file.name);

      try {
        const localPath = `${offlineDir}${projectId}/${file.id}_${file.name}`;
        const localDir = `${offlineDir}${projectId}/`;

        // Create project subdirectory
        const dirInfo = await FileSystem.getInfoAsync(localDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(localDir, { intermediates: true });
        }

        // Download the file
        const downloadResult = await FileSystem.downloadAsync(file.downloadUrl, localPath);

        if (downloadResult.status === 200) {
          const existingIndex = offlineFiles.findIndex((f) => f.node_id === file.id);
          const newEntry: OfflineFile = {
            id: `offline_${file.id}`,
            project_id: projectId,
            node_id: file.id,
            name: file.name,
            mime_type: file.mime_type || 'application/octet-stream',
            size: file.size || 0,
            local_path: localPath,
            parent_id: file.parent_id || null,
            created_at: new Date().toISOString(),
            downloaded_at: new Date().toISOString(),
            last_accessed_at: new Date().toISOString(),
            remote_updated_at: file.updated_at || new Date().toISOString(),
          };

          if (existingIndex >= 0) {
            offlineFiles[existingIndex] = newEntry;
          } else {
            offlineFiles.push(newEntry);
          }
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`${file.name}: Download failed (${downloadResult.status})`);
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${file.name}: ${error.message}`);
      }
    }

    await AsyncStorage.setItem(OFFLINE_FILES_KEY, JSON.stringify(offlineFiles));
    console.log(
      `[OfflineService] Saved ${results.success} files for offline, ${results.failed} failed`
    );
    return results;
  },

  /**
   * Get all offline files for a project
   */
  getOfflineFiles: async (projectId?: string): Promise<OfflineFile[]> => {
    try {
      const data = await AsyncStorage.getItem(OFFLINE_FILES_KEY);
      const files: OfflineFile[] = data ? JSON.parse(data) : [];

      if (projectId) {
        return files.filter((f) => f.project_id === projectId);
      }
      return files;
    } catch (error) {
      console.error('[OfflineService] Failed to get offline files:', error);
      return [];
    }
  },

  /**
   * Check if a file is saved offline
   */
  isFileSavedOffline: async (nodeId: string): Promise<boolean> => {
    const files = await offlineFilesStorage.getOfflineFiles();
    return files.some((f) => f.node_id === nodeId);
  },

  /**
   * Get offline file by node ID
   */
  getOfflineFile: async (nodeId: string): Promise<OfflineFile | null> => {
    const files = await offlineFilesStorage.getOfflineFiles();
    return files.find((f) => f.node_id === nodeId) || null;
  },

  /**
   * Remove a file from offline storage
   */
  removeOfflineFile: async (nodeId: string): Promise<void> => {
    try {
      const files = await offlineFilesStorage.getOfflineFiles();
      const file = files.find((f) => f.node_id === nodeId);

      if (file && Platform.OS !== 'web') {
        // Delete local file
        const fileInfo = await FileSystem.getInfoAsync(file.local_path);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(file.local_path);
        }
      }

      // Update storage
      const remaining = files.filter((f) => f.node_id !== nodeId);
      await AsyncStorage.setItem(OFFLINE_FILES_KEY, JSON.stringify(remaining));
    } catch (error) {
      console.error('[OfflineService] Failed to remove offline file:', error);
    }
  },

  /**
   * Clear all offline files
   */
  clearAllOfflineFiles: async (): Promise<void> => {
    try {
      if (Platform.OS !== 'web') {
        const offlineDir = await getOfflineFilesDir();
        const dirInfo = await FileSystem.getInfoAsync(offlineDir);
        if (dirInfo.exists) {
          await FileSystem.deleteAsync(offlineDir, { idempotent: true });
        }
      }
      await AsyncStorage.removeItem(OFFLINE_FILES_KEY);
    } catch (error) {
      console.error('[OfflineService] Failed to clear offline files:', error);
    }
  },

  /**
   * Get total offline storage size
   */
  getOfflineStorageSize: async (): Promise<number> => {
    const files = await offlineFilesStorage.getOfflineFiles();
    return files.reduce((total, f) => total + (f.size || 0), 0);
  },

  /**
   * Sync offline files with remote - re-downloads files that have been updated on server
   * @param projectId - Project ID to sync (optional, syncs all if not provided)
   * @param getRemoteFileInfo - Function to fetch remote file info (node_id, updated_at)
   * @param getDownloadUrl - Function to get download URL for a file
   * @param onProgress - Progress callback
   * @returns Sync results
   */
  syncOfflineFiles: async (
    projectId: string | undefined,
    getRemoteFileInfo: (
      nodeIds: string[]
    ) => Promise<
      { id: string; updated_at: string; name: string; mime_type?: string; size?: number }[]
    >,
    getDownloadUrl: (nodeId: string) => Promise<string>,
    onProgress?: (
      current: number,
      total: number,
      fileName: string,
      status: 'checking' | 'downloading' | 'up-to-date'
    ) => void
  ): Promise<{ updated: number; upToDate: number; failed: number; errors: string[] }> => {
    const results = { updated: 0, upToDate: 0, failed: 0, errors: [] as string[] };

    try {
      // Get offline files to check
      const offlineFiles = await offlineFilesStorage.getOfflineFiles(projectId);

      if (offlineFiles.length === 0) {
        console.log('[OfflineService] No offline files to sync');
        return results;
      }

      // Get remote file info in batch
      const nodeIds = offlineFiles.map((f) => f.node_id);
      const remoteFiles = await getRemoteFileInfo(nodeIds);
      const remoteMap = new Map(remoteFiles.map((f) => [f.id, f]));

      const existingData = await AsyncStorage.getItem(OFFLINE_FILES_KEY);
      const allOfflineFiles: OfflineFile[] = existingData ? JSON.parse(existingData) : [];

      for (let i = 0; i < offlineFiles.length; i++) {
        const localFile = offlineFiles[i];
        const remoteFile = remoteMap.get(localFile.node_id);

        onProgress?.(i + 1, offlineFiles.length, localFile.name, 'checking');

        if (!remoteFile) {
          // File no longer exists on server - mark as failed/orphaned
          results.failed++;
          results.errors.push(`${localFile.name}: File not found on server`);
          continue;
        }

        // Compare timestamps
        const localUpdatedAt = localFile.remote_updated_at
          ? new Date(localFile.remote_updated_at).getTime()
          : 0;
        const remoteUpdatedAt = new Date(remoteFile.updated_at).getTime();

        if (remoteUpdatedAt > localUpdatedAt) {
          // File has been updated on server - re-download
          onProgress?.(i + 1, offlineFiles.length, localFile.name, 'downloading');

          try {
            const downloadUrl = await getDownloadUrl(localFile.node_id);

            if (Platform.OS !== 'web') {
              // Native: download to local path
              const downloadResult = await FileSystem.downloadAsync(
                downloadUrl,
                localFile.local_path
              );

              if (downloadResult.status !== 200) {
                throw new Error(`Download failed with status ${downloadResult.status}`);
              }
            }

            // Update the offline file record
            const fileIndex = allOfflineFiles.findIndex((f) => f.node_id === localFile.node_id);
            if (fileIndex >= 0) {
              allOfflineFiles[fileIndex] = {
                ...allOfflineFiles[fileIndex],
                name: remoteFile.name,
                mime_type: remoteFile.mime_type || localFile.mime_type,
                size: remoteFile.size || localFile.size,
                downloaded_at: new Date().toISOString(),
                remote_updated_at: remoteFile.updated_at,
                local_path: Platform.OS === 'web' ? downloadUrl : localFile.local_path,
              };
            }

            results.updated++;
            console.log(`[OfflineService] Updated: ${localFile.name}`);
          } catch (error: any) {
            results.failed++;
            results.errors.push(`${localFile.name}: ${error.message}`);
          }
        } else {
          // File is up to date
          onProgress?.(i + 1, offlineFiles.length, localFile.name, 'up-to-date');
          results.upToDate++;
        }
      }

      // Save updated offline files
      await AsyncStorage.setItem(OFFLINE_FILES_KEY, JSON.stringify(allOfflineFiles));

      console.log(
        `[OfflineService] Sync complete: ${results.updated} updated, ${results.upToDate} up-to-date, ${results.failed} failed`
      );
      return results;
    } catch (error: any) {
      console.error('[OfflineService] Sync failed:', error);
      results.errors.push(`Sync error: ${error.message}`);
      return results;
    }
  },
};

export default {
  recentProjectsCache,
  offlineFilesStorage,
};

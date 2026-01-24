/**
 * STRATUM Offline Queue Service
 *
 * Comprehensive offline queue system for:
 * - Queueing API requests when offline
 * - Auto-syncing when connection restored
 * - File upload/download management
 * - Conflict detection and resolution
 * - Version tracking for files and notes
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import NetInfo from "@react-native-community/netinfo";

// Simple UUID generator for React Native
const generateUUID = (): string => {
  // Use timestamp + random for uniqueness
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomPart}-${randomPart2}`;
};

// Storage keys
const QUEUE_KEY = "@stratum_offline_queue";
const FILE_VERSIONS_KEY = "@stratum_file_versions";
// Reserved for future use
// const PENDING_UPLOADS_KEY = "@stratum_pending_uploads";
const PENDING_EDITS_KEY = "@stratum_pending_edits";
const CONFLICTS_KEY = "@stratum_conflicts";

// Types
export type QueueActionType =
  | "CREATE_NOTE"
  | "UPDATE_NOTE"
  | "DELETE_NOTE"
  | "UPLOAD_FILE"
  | "UPDATE_FILE"
  | "DELETE_FILE"
  | "CREATE_FOLDER"
  | "MOVE_FILE"
  | "RENAME_FILE"
  | "UPDATE_PROFILE";

export interface QueuedAction {
  id: string;
  type: QueueActionType;
  projectId: string;
  entityId?: string; // File/Note ID
  data: any;
  localPath?: string; // For file uploads
  createdAt: string;
  retryCount: number;
  lastError?: string;
  status: "pending" | "processing" | "failed" | "conflict";
  userId: string;
  priority: number; // Lower = higher priority
}

export interface FileVersion {
  nodeId: string;
  projectId: string;
  name: string;
  localVersion: number;
  remoteVersion: number;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  localChecksum?: string;
  hasLocalEdits: boolean;
  localEditPath?: string; // Path to local edited version
}

export interface PendingFileEdit {
  id: string;
  nodeId: string;
  projectId: string;
  fileName: string;
  originalPath: string;
  editedPath: string;
  mimeType: string;
  editedAt: string;
  userId: string;
  isDraft: boolean;
}

export interface FileConflict {
  id: string;
  nodeId: string;
  projectId: string;
  fileName: string;
  localVersion: FileVersion;
  remoteVersion: {
    version: number;
    updatedAt: string;
    updatedBy?: string;
  };
  localEditPath: string;
  createdAt: string;
  resolved: boolean;
  resolution?: "keep_local" | "keep_remote" | "keep_both";
}

// Get the STRATUM offline directory (inside app container)
export const getStratumOfflineDir = async (): Promise<string> => {
  if (Platform.OS === "web") {
    return "stratum_offline"; // Virtual path for web
  }

  // Use cacheDirectory for iOS/Android - this is inside the app container
  // and doesn't require additional permissions
  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error("No storage directory available");
  }

  const stratumDir = `${baseDir}stratum_offline/`;
  const dirInfo = await FileSystem.getInfoAsync(stratumDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(stratumDir, { intermediates: true });
    console.log("[OfflineQueue] Created STRATUM offline directory:", stratumDir);
  }
  return stratumDir;
};

// Get subdirectories for different content types
export const getOfflineSubDir = async (
  subDir: "files" | "edits" | "uploads" | "cache",
): Promise<string> => {
  const baseDir = await getStratumOfflineDir();
  const fullPath = `${baseDir}${subDir}/`;

  if (Platform.OS !== "web") {
    const dirInfo = await FileSystem.getInfoAsync(fullPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(fullPath, { intermediates: true });
    }
  }

  return fullPath;
};

/**
 * Offline Queue Manager
 */
export const offlineQueue = {
  /**
   * Add an action to the offline queue
   */
  enqueue: async (
    type: QueueActionType,
    projectId: string,
    data: any,
    userId: string,
    options?: {
      entityId?: string;
      localPath?: string;
      priority?: number;
    },
  ): Promise<string> => {
    const queue = await offlineQueue.getQueue();

    const action: QueuedAction = {
      id: generateUUID(),
      type,
      projectId,
      entityId: options?.entityId,
      data,
      localPath: options?.localPath,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: "pending",
      userId,
      priority: options?.priority ?? 10,
    };

    queue.push(action);
    queue.sort((a, b) => a.priority - b.priority);

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log(`[OfflineQueue] Enqueued ${type} for project ${projectId}`);

    return action.id;
  },

  /**
   * Get all queued actions
   */
  getQueue: async (): Promise<QueuedAction[]> => {
    try {
      const data = await AsyncStorage.getItem(QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("[OfflineQueue] Failed to get queue:", error);
      return [];
    }
  },

  /**
   * Get queue for a specific project
   */
  getProjectQueue: async (projectId: string): Promise<QueuedAction[]> => {
    const queue = await offlineQueue.getQueue();
    return queue.filter((a) => a.projectId === projectId);
  },

  /**
   * Get pending actions count
   */
  getPendingCount: async (): Promise<number> => {
    const queue = await offlineQueue.getQueue();
    return queue.filter((a) => a.status === "pending" || a.status === "failed")
      .length;
  },

  /**
   * Update action status
   */
  updateActionStatus: async (
    actionId: string,
    status: QueuedAction["status"],
    error?: string,
  ): Promise<void> => {
    const queue = await offlineQueue.getQueue();
    const actionIndex = queue.findIndex((a) => a.id === actionId);

    if (actionIndex >= 0) {
      queue[actionIndex].status = status;
      if (error) {
        queue[actionIndex].lastError = error;
        queue[actionIndex].retryCount++;
      }
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  },

  /**
   * Remove action from queue
   */
  dequeue: async (actionId: string): Promise<void> => {
    const queue = await offlineQueue.getQueue();
    const filtered = queue.filter((a) => a.id !== actionId);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  },

  /**
   * Clear all failed actions
   */
  clearFailed: async (): Promise<void> => {
    const queue = await offlineQueue.getQueue();
    const filtered = queue.filter((a) => a.status !== "failed");
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  },

  /**
   * Clear entire queue
   */
  clearQueue: async (): Promise<void> => {
    await AsyncStorage.removeItem(QUEUE_KEY);
  },
};

/**
 * File Version Tracker
 */
export const fileVersions = {
  /**
   * Track file version info
   */
  setVersion: async (version: FileVersion): Promise<void> => {
    const versions = await fileVersions.getAllVersions();
    const existingIndex = versions.findIndex((v) => v.nodeId === version.nodeId);

    if (existingIndex >= 0) {
      versions[existingIndex] = version;
    } else {
      versions.push(version);
    }

    await AsyncStorage.setItem(FILE_VERSIONS_KEY, JSON.stringify(versions));
  },

  /**
   * Get version info for a file
   */
  getVersion: async (nodeId: string): Promise<FileVersion | null> => {
    const versions = await fileVersions.getAllVersions();
    return versions.find((v) => v.nodeId === nodeId) || null;
  },

  /**
   * Get all tracked versions
   */
  getAllVersions: async (): Promise<FileVersion[]> => {
    try {
      const data = await AsyncStorage.getItem(FILE_VERSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("[OfflineQueue] Failed to get file versions:", error);
      return [];
    }
  },

  /**
   * Check if file has local edits
   */
  hasLocalEdits: async (nodeId: string): Promise<boolean> => {
    const version = await fileVersions.getVersion(nodeId);
    return version?.hasLocalEdits ?? false;
  },

  /**
   * Mark file as having local edits
   */
  markAsEdited: async (nodeId: string, editPath: string): Promise<void> => {
    const version = await fileVersions.getVersion(nodeId);
    if (version) {
      version.hasLocalEdits = true;
      version.localEditPath = editPath;
      version.localUpdatedAt = new Date().toISOString();
      version.localVersion++;
      await fileVersions.setVersion(version);
    }
  },

  /**
   * Clear version tracking for a file
   */
  clearVersion: async (nodeId: string): Promise<void> => {
    const versions = await fileVersions.getAllVersions();
    const filtered = versions.filter((v) => v.nodeId !== nodeId);
    await AsyncStorage.setItem(FILE_VERSIONS_KEY, JSON.stringify(filtered));
  },
};

/**
 * Pending File Edits Manager
 */
export const pendingEdits = {
  /**
   * Save a pending file edit
   */
  saveEdit: async (edit: Omit<PendingFileEdit, "id">): Promise<string> => {
    const edits = await pendingEdits.getAllEdits();
    const newEdit: PendingFileEdit = {
      id: generateUUID(),
      ...edit,
    };

    // Replace existing edit for same file
    const existingIndex = edits.findIndex((e) => e.nodeId === edit.nodeId);
    if (existingIndex >= 0) {
      newEdit.id = edits[existingIndex].id;
      edits[existingIndex] = newEdit;
    } else {
      edits.push(newEdit);
    }

    await AsyncStorage.setItem(PENDING_EDITS_KEY, JSON.stringify(edits));
    console.log(`[OfflineQueue] Saved pending edit for ${edit.fileName}`);

    return newEdit.id;
  },

  /**
   * Get pending edit for a file
   */
  getEdit: async (nodeId: string): Promise<PendingFileEdit | null> => {
    const edits = await pendingEdits.getAllEdits();
    return edits.find((e) => e.nodeId === nodeId) || null;
  },

  /**
   * Get all pending edits
   */
  getAllEdits: async (): Promise<PendingFileEdit[]> => {
    try {
      const data = await AsyncStorage.getItem(PENDING_EDITS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("[OfflineQueue] Failed to get pending edits:", error);
      return [];
    }
  },

  /**
   * Get pending edits for a project
   */
  getProjectEdits: async (projectId: string): Promise<PendingFileEdit[]> => {
    const edits = await pendingEdits.getAllEdits();
    return edits.filter((e) => e.projectId === projectId);
  },

  /**
   * Check if there are any drafts for a project
   */
  hasDrafts: async (projectId: string): Promise<boolean> => {
    const edits = await pendingEdits.getProjectEdits(projectId);
    return edits.some((e) => e.isDraft);
  },

  /**
   * Remove a pending edit
   */
  removeEdit: async (nodeId: string): Promise<void> => {
    const edits = await pendingEdits.getAllEdits();
    const edit = edits.find((e) => e.nodeId === nodeId);

    // Delete the edited file if it exists
    if (edit && Platform.OS !== "web") {
      try {
        const fileInfo = await FileSystem.getInfoAsync(edit.editedPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(edit.editedPath);
        }
      } catch (error) {
        console.warn("[OfflineQueue] Failed to delete edited file:", error);
      }
    }

    const filtered = edits.filter((e) => e.nodeId !== nodeId);
    await AsyncStorage.setItem(PENDING_EDITS_KEY, JSON.stringify(filtered));
  },

  /**
   * Clear all pending edits
   */
  clearAllEdits: async (): Promise<void> => {
    if (Platform.OS !== "web") {
      try {
        const editsDir = await getOfflineSubDir("edits");
        const dirInfo = await FileSystem.getInfoAsync(editsDir);
        if (dirInfo.exists) {
          await FileSystem.deleteAsync(editsDir, { idempotent: true });
          await FileSystem.makeDirectoryAsync(editsDir, { intermediates: true });
        }
      } catch (error) {
        console.warn("[OfflineQueue] Failed to clear edits directory:", error);
      }
    }
    await AsyncStorage.removeItem(PENDING_EDITS_KEY);
  },
};

/**
 * Conflict Manager
 */
export const conflicts = {
  /**
   * Record a conflict
   */
  addConflict: async (
    conflict: Omit<FileConflict, "id" | "createdAt" | "resolved">,
  ): Promise<string> => {
    const allConflicts = await conflicts.getAllConflicts();

    // Check if conflict already exists for this file
    const existingIndex = allConflicts.findIndex(
      (c) => c.nodeId === conflict.nodeId && !c.resolved,
    );

    const newConflict: FileConflict = {
      id: generateUUID(),
      ...conflict,
      createdAt: new Date().toISOString(),
      resolved: false,
    };

    if (existingIndex >= 0) {
      newConflict.id = allConflicts[existingIndex].id;
      allConflicts[existingIndex] = newConflict;
    } else {
      allConflicts.push(newConflict);
    }

    await AsyncStorage.setItem(CONFLICTS_KEY, JSON.stringify(allConflicts));
    console.log(`[OfflineQueue] Recorded conflict for ${conflict.fileName}`);

    return newConflict.id;
  },

  /**
   * Get all unresolved conflicts
   */
  getUnresolvedConflicts: async (): Promise<FileConflict[]> => {
    const allConflicts = await conflicts.getAllConflicts();
    return allConflicts.filter((c) => !c.resolved);
  },

  /**
   * Get conflicts for a project
   */
  getProjectConflicts: async (projectId: string): Promise<FileConflict[]> => {
    const allConflicts = await conflicts.getAllConflicts();
    return allConflicts.filter((c) => c.projectId === projectId && !c.resolved);
  },

  /**
   * Get all conflicts
   */
  getAllConflicts: async (): Promise<FileConflict[]> => {
    try {
      const data = await AsyncStorage.getItem(CONFLICTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("[OfflineQueue] Failed to get conflicts:", error);
      return [];
    }
  },

  /**
   * Resolve a conflict
   */
  resolveConflict: async (
    conflictId: string,
    resolution: "keep_local" | "keep_remote" | "keep_both",
  ): Promise<void> => {
    const allConflicts = await conflicts.getAllConflicts();
    const conflictIndex = allConflicts.findIndex((c) => c.id === conflictId);

    if (conflictIndex >= 0) {
      allConflicts[conflictIndex].resolved = true;
      allConflicts[conflictIndex].resolution = resolution;
      await AsyncStorage.setItem(CONFLICTS_KEY, JSON.stringify(allConflicts));
      console.log(
        `[OfflineQueue] Resolved conflict ${conflictId} with ${resolution}`,
      );
    }
  },

  /**
   * Clear resolved conflicts
   */
  clearResolved: async (): Promise<void> => {
    const allConflicts = await conflicts.getAllConflicts();
    const unresolved = allConflicts.filter((c) => !c.resolved);
    await AsyncStorage.setItem(CONFLICTS_KEY, JSON.stringify(unresolved));
  },

  /**
   * Get conflict count
   */
  getConflictCount: async (): Promise<number> => {
    const unresolved = await conflicts.getUnresolvedConflicts();
    return unresolved.length;
  },
};

/**
 * Check network connectivity
 */
export const checkConnectivity = async (): Promise<boolean> => {
  if (Platform.OS === "web") {
    return navigator.onLine;
  }

  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch (error) {
    console.error("[OfflineQueue] Failed to check connectivity:", error);
    return false;
  }
};

/**
 * Storage stats type for offline queue data
 */
export interface OfflineStorageStats {
  totalSize: number; // KB
  queueSize: number; // KB
  versionsSize: number; // KB
  pendingEditsSize: number; // KB
  conflictsSize: number; // KB
  filesBytes: number;
  editsBytes: number;
  cacheBytes: number;
  totalBytes: number;
}

/**
 * Calculate storage usage for STRATUM offline data
 */
export const getOfflineStorageStats = async (): Promise<OfflineStorageStats> => {
  const stats: OfflineStorageStats = {
    totalSize: 0,
    queueSize: 0,
    versionsSize: 0,
    pendingEditsSize: 0,
    conflictsSize: 0,
    totalBytes: 0,
    filesBytes: 0,
    editsBytes: 0,
    cacheBytes: 0,
  };

  if (Platform.OS === "web") {
    return stats;
  }

  try {
    // Calculate AsyncStorage sizes (in KB)
    const queueData = await AsyncStorage.getItem(QUEUE_KEY);
    stats.queueSize = Math.round((queueData?.length || 0) / 1024);

    const versionsData = await AsyncStorage.getItem(FILE_VERSIONS_KEY);
    stats.versionsSize = Math.round((versionsData?.length || 0) / 1024);

    const editsData = await AsyncStorage.getItem(PENDING_EDITS_KEY);
    stats.pendingEditsSize = Math.round((editsData?.length || 0) / 1024);

    const conflictsData = await AsyncStorage.getItem(CONFLICTS_KEY);
    stats.conflictsSize = Math.round((conflictsData?.length || 0) / 1024);

    stats.totalSize =
      stats.queueSize +
      stats.versionsSize +
      stats.pendingEditsSize +
      stats.conflictsSize;

    // Calculate file system sizes
    const baseDir = await getStratumOfflineDir();

    const calculateDirSize = async (dirPath: string): Promise<number> => {
      try {
        const dirInfo = await FileSystem.getInfoAsync(dirPath);
        if (!dirInfo.exists) return 0;

        const contents = await FileSystem.readDirectoryAsync(dirPath);
        let size = 0;

        for (const item of contents) {
          const itemPath = `${dirPath}${item}`;
          const itemInfo = await FileSystem.getInfoAsync(itemPath);

          if (itemInfo.exists) {
            if (itemInfo.isDirectory) {
              size += await calculateDirSize(`${itemPath}/`);
            } else {
              size += (itemInfo as any).size || 0;
            }
          }
        }

        return size;
      } catch {
        return 0;
      }
    };

    stats.filesBytes = await calculateDirSize(`${baseDir}files/`);
    stats.editsBytes = await calculateDirSize(`${baseDir}edits/`);
    stats.cacheBytes = await calculateDirSize(`${baseDir}cache/`);
    stats.totalBytes = stats.filesBytes + stats.editsBytes + stats.cacheBytes;
  } catch (error) {
    console.error("[OfflineQueue] Failed to calculate storage stats:", error);
  }

  return stats;
};

export default {
  offlineQueue,
  fileVersions,
  pendingEdits,
  conflicts,
  checkConnectivity,
  getStratumOfflineDir,
  getOfflineSubDir,
  getOfflineStorageStats,
};

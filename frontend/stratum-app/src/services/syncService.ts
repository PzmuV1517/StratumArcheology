/**
 * @file
 * Data synchronization service.
 *
 * Handles syncing local data with the backend, managing conflicts,
 * and maintaining data consistency across sessions.
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
import { Platform } from "react-native";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import api from "../services/api";
import {
  initDatabase,
  getUnsyncedNotes,
  getUnsyncedProjects,
  getPendingRequests,
  removeFromQueue,
  updateRequestStatus,
  recordConflict,
  saveLocalNote,
  saveLocalProject,
  getQueueStats,
  QueuedRequest,
  LocalNote,
  LocalProject,
} from "../db";
import { offlineQueue, QueuedAction, conflicts } from "./offlineQueueService";

// Maximum number of retries for failed requests
const MAX_RETRIES = 3;

// Delay between retries (exponential backoff)
const getRetryDelay = (retryCount: number): number => {
  return Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
};

/**
 * Sync status for UI updates
 */
export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingCount: number;
  failedCount: number;
  error: string | null;
}

// Callbacks for sync status updates
type SyncStatusCallback = (status: SyncStatus) => void;
const statusCallbacks: SyncStatusCallback[] = [];

let currentStatus: SyncStatus = {
  isSyncing: false,
  lastSyncTime: null,
  pendingCount: 0,
  failedCount: 0,
  error: null,
};

/**
 * Subscribe to sync status updates
 */
export function subscribeSyncStatus(callback: SyncStatusCallback): () => void {
  statusCallbacks.push(callback);
  // Immediately call with current status
  callback(currentStatus);
  // Return unsubscribe function
  return () => {
    const index = statusCallbacks.indexOf(callback);
    if (index >= 0) statusCallbacks.splice(index, 1);
  };
}

/**
 * Update and broadcast sync status
 */
function updateSyncStatus(updates: Partial<SyncStatus>): void {
  currentStatus = { ...currentStatus, ...updates };
  statusCallbacks.forEach((cb) => cb(currentStatus));
}

// Network listener cleanup
let networkUnsubscribe: (() => void) | null = null;
let wasOffline = false;

/**
 * Setup auto-sync on network restoration
 * This runs in the background and syncs when connectivity is restored
 */
function setupNetworkListener(): void {
  if (networkUnsubscribe) {
    networkUnsubscribe();
  }

  networkUnsubscribe = NetInfo.addEventListener(async (state: NetInfoState) => {
    const isOnline = state.isConnected && state.isInternetReachable;

    console.log(
      `[SyncService] Network state changed: connected=${state.isConnected}, reachable=${state.isInternetReachable}`,
    );

    if (isOnline && wasOffline) {
      // Connection restored - trigger auto-sync
      console.log("[SyncService] Connection restored - triggering auto-sync");
      wasOffline = false;

      // Small delay to let network stabilize
      setTimeout(async () => {
        try {
          await processOfflineQueue();
          await syncLocalChanges();
        } catch (error) {
          console.error("[SyncService] Auto-sync failed:", error);
        }
      }, 1000);
    } else if (!isOnline) {
      wasOffline = true;
    }
  });
}

/**
 * Process the offline queue (from offlineQueueService)
 * This handles file uploads, notes, etc. that were queued while offline
 */
export async function processOfflineQueue(): Promise<void> {
  if (Platform.OS === "web") return;

  if (currentStatus.isSyncing) {
    console.log("[SyncService] Already syncing, skipping offline queue");
    return;
  }

  try {
    const queue = await offlineQueue.getQueue();
    const pendingActions = queue.filter((a) => a.status === "pending");

    if (pendingActions.length === 0) {
      console.log("[SyncService] No pending offline actions");
      return;
    }

    console.log(
      `[SyncService] Processing ${pendingActions.length} offline actions...`,
    );
    updateSyncStatus({ isSyncing: true, error: null });

    for (const action of pendingActions) {
      await processOfflineAction(action);
    }

    // Update pending count
    const updatedQueue = await offlineQueue.getQueue();
    const stillPending = updatedQueue.filter((a) => a.status === "pending").length;
    const failed = updatedQueue.filter((a) => a.status === "failed").length;

    updateSyncStatus({
      isSyncing: false,
      pendingCount: stillPending,
      failedCount: failed,
      lastSyncTime: new Date(),
    });

    console.log("[SyncService] Offline queue processing complete");
  } catch (error: any) {
    console.error("[SyncService] Offline queue processing failed:", error);
    updateSyncStatus({
      isSyncing: false,
      error: error.message || "Sync failed",
    });
  }
}

/**
 * Process a single offline queued action
 */
async function processOfflineAction(action: QueuedAction): Promise<void> {
  console.log(
    `[SyncService] Processing action: ${action.type} for ${action.entityId || "new entity"}`,
  );

  await offlineQueue.updateActionStatus(action.id, "processing");

  try {
    switch (action.type) {
      case "CREATE_NOTE":
        await handleCreateNote(action);
        break;
      case "UPDATE_NOTE":
        await handleUpdateNote(action);
        break;
      case "DELETE_NOTE":
        await handleDeleteNote(action);
        break;
      case "UPLOAD_FILE":
        await handleUploadFile(action);
        break;
      case "UPDATE_FILE":
        await handleUpdateFile(action);
        break;
      case "DELETE_FILE":
        await handleDeleteFile(action);
        break;
      case "CREATE_FOLDER":
        await handleCreateFolder(action);
        break;
      case "MOVE_FILE":
        await handleMoveFile(action);
        break;
      case "RENAME_FILE":
        await handleRenameFile(action);
        break;
      case "UPDATE_PROFILE":
        await handleUpdateProfile(action);
        break;
      default:
        console.warn(`[SyncService] Unknown action type: ${action.type}`);
    }

    // Success - remove from queue
    await offlineQueue.removeFromQueue(action.id);
    console.log(`[SyncService] Action ${action.id} completed successfully`);
  } catch (error: any) {
    const errorMessage =
      error.response?.data?.detail || error.message || "Unknown error";
    console.error(`[SyncService] Action ${action.id} failed:`, errorMessage);

    // Check for conflicts (409)
    if (error.response?.status === 409) {
      await offlineQueue.updateActionStatus(action.id, "conflict", errorMessage);
      // Record the conflict for user resolution
      await conflicts.addConflict({
        actionId: action.id,
        entityType: action.type.includes("NOTE") ? "note" : "file",
        entityId: action.entityId || "",
        localVersion: action.data,
        serverVersion: error.response?.data?.serverVersion,
        localTimestamp: action.createdAt,
        serverTimestamp: new Date().toISOString(),
      });
    } else if (action.retryCount < MAX_RETRIES && isRetryableError(error)) {
      // Retry later
      await offlineQueue.updateActionStatus(action.id, "pending", errorMessage);
    } else {
      // Mark as failed
      await offlineQueue.updateActionStatus(action.id, "failed", errorMessage);
    }
  }
}

// Action handlers
async function handleCreateNote(action: QueuedAction): Promise<void> {
  const response = await api.post(
    `/projects/${action.projectId}/notes`,
    action.data,
  );
  console.log(`[SyncService] Created note: ${response.data.id}`);
}

async function handleUpdateNote(action: QueuedAction): Promise<void> {
  await api.put(`/notes/${action.entityId}`, action.data);
}

async function handleDeleteNote(action: QueuedAction): Promise<void> {
  await api.delete(`/notes/${action.entityId}`);
}

async function handleUploadFile(action: QueuedAction): Promise<void> {
  // File upload requires FormData
  const formData = new FormData();
  formData.append("file", {
    uri: action.localPath,
    type: action.data.mimeType || "application/octet-stream",
    name: action.data.name,
  } as any);

  if (action.data.parent_id) {
    formData.append("parent_id", action.data.parent_id);
  }

  await api.post(`/files/project/${action.projectId}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

async function handleUpdateFile(action: QueuedAction): Promise<void> {
  const formData = new FormData();
  formData.append("file", {
    uri: action.localPath,
    type: action.data.mimeType || "application/octet-stream",
    name: action.data.name,
  } as any);

  await api.put(`/files/${action.entityId}/content`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

async function handleDeleteFile(action: QueuedAction): Promise<void> {
  await api.delete(`/files/${action.entityId}`);
}

async function handleCreateFolder(action: QueuedAction): Promise<void> {
  await api.post(`/files/project/${action.projectId}/folder`, action.data);
}

async function handleMoveFile(action: QueuedAction): Promise<void> {
  await api.put(`/files/${action.entityId}/move`, action.data);
}

async function handleRenameFile(action: QueuedAction): Promise<void> {
  await api.put(`/files/${action.entityId}/rename`, action.data);
}

async function handleUpdateProfile(action: QueuedAction): Promise<void> {
  await api.patch("/auth/me", action.data);
}

/**
 * Initialize the sync service
 * Call this when the app starts
 *
 * Note: On web, sync service is minimal since web is online-only.
 * Full offline queue support is mobile-only.
 */
export async function initSyncService(): Promise<void> {
  try {
    await initDatabase();
    console.log("[SyncService] Database initialized");

    // On web, we don't use the offline queue - web is online-only
    if (Platform.OS === "web") {
      console.log("[SyncService] Web platform - offline queue disabled");
      return;
    }

    // Setup network listener for auto-sync
    setupNetworkListener();
    console.log("[SyncService] Network listener setup for auto-sync");

    // Check initial network state
    const netState = await NetInfo.fetch();
    wasOffline = !netState.isConnected || !netState.isInternetReachable;

    // Update initial status (mobile only)
    const stats = await getQueueStats();
    const offlineQueueItems = await offlineQueue.getQueue();
    const offlinePending = offlineQueueItems.filter(
      (a) => a.status === "pending",
    ).length;
    const offlineFailed = offlineQueueItems.filter(
      (a) => a.status === "failed",
    ).length;

    updateSyncStatus({
      pendingCount: stats.pending + offlinePending,
      failedCount: stats.failed + offlineFailed,
    });

    // If we're online, sync any pending items
    if (!wasOffline) {
      console.log(
        "[SyncService] Online at startup - checking for pending sync items",
      );
      setTimeout(async () => {
        try {
          await processOfflineQueue();
        } catch (error) {
          console.error("[SyncService] Initial sync failed:", error);
        }
      }, 2000);
    }
  } catch (error) {
    console.error("[SyncService] Initialization failed:", error);
    throw error;
  }
}

/**
 * Process the request queue
 * Call this when network is restored or periodically
 *
 * Note: This is mobile-only. Web is always online and doesn't use offline queues.
 */
export async function processQueue(): Promise<void> {
  // Web is online-only - skip queue processing
  if (Platform.OS === "web") {
    console.log("[SyncService] Web platform - queue processing skipped");
    return;
  }

  // Prevent concurrent syncs
  if (currentStatus.isSyncing) {
    console.log("[SyncService] Sync already in progress");
    return;
  }

  updateSyncStatus({ isSyncing: true, error: null });
  console.log("[SyncService] Processing queue...");

  try {
    const requests = await getPendingRequests();
    console.log(`[SyncService] Found ${requests.length} pending requests`);

    for (const request of requests) {
      await processRequest(request);
    }

    // Update status
    const stats = await getQueueStats();
    updateSyncStatus({
      isSyncing: false,
      lastSyncTime: new Date(),
      pendingCount: stats.pending,
      failedCount: stats.failed,
    });

    console.log("[SyncService] Queue processing complete");
  } catch (error: any) {
    console.error("[SyncService] Queue processing failed:", error);
    updateSyncStatus({
      isSyncing: false,
      error: error.message || "Sync failed",
    });
  }
}

/**
 * Process a single queued request
 */
async function processRequest(request: QueuedRequest): Promise<void> {
  try {
    // Mark as processing
    await updateRequestStatus(request.id, "processing");

    // Parse stored data
    const headers = JSON.parse(request.headers);
    const data = request.data ? JSON.parse(request.data) : undefined;

    // Execute the request
    const response = await api.request({
      method: request.method,
      url: request.url,
      data,
      headers,
    });

    // Success - remove from queue
    await removeFromQueue(request.id);
    console.log(`[SyncService] Request ${request.id} completed successfully`);
  } catch (error: any) {
    const errorMessage =
      error.response?.data?.message || error.message || "Unknown error";
    console.error(`[SyncService] Request ${request.id} failed:`, errorMessage);

    // Check if we should retry
    if (request.retry_count < MAX_RETRIES && isRetryableError(error)) {
      // Schedule retry with exponential backoff
      await updateRequestStatus(request.id, "pending", errorMessage);
      const delay = getRetryDelay(request.retry_count);
      console.log(`[SyncService] Will retry in ${delay}ms`);
    } else {
      // Mark as failed - needs manual intervention
      await updateRequestStatus(request.id, "failed", errorMessage);
    }
  }
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (!error.response) return true;

  // Server errors (5xx) are retryable
  const status = error.response?.status;
  if (status >= 500 && status < 600) return true;

  // 429 Too Many Requests is retryable
  if (status === 429) return true;

  // 408 Request Timeout is retryable
  if (status === 408) return true;

  // Client errors (4xx) are generally not retryable
  return false;
}

/**
 * Sync local changes to server
 * Handles conflict detection with timestamp comparison
 */
export async function syncLocalChanges(): Promise<void> {
  if (currentStatus.isSyncing) return;

  updateSyncStatus({ isSyncing: true, error: null });

  try {
    // Sync unsynced notes
    const unsyncedNotes = await getUnsyncedNotes();
    for (const note of unsyncedNotes) {
      await syncNote(note);
    }

    // Sync unsynced projects
    const unsyncedProjects = await getUnsyncedProjects();
    for (const project of unsyncedProjects) {
      await syncProject(project);
    }

    // Also process the request queue
    await processQueue();
  } catch (error: any) {
    console.error("[SyncService] Sync failed:", error);
    updateSyncStatus({
      isSyncing: false,
      error: error.message || "Sync failed",
    });
  }
}

/**
 * Sync a single note to server with conflict detection
 */
async function syncNote(localNote: LocalNote): Promise<void> {
  try {
    // Check if this is a new note or update
    const isNew = localNote.id.startsWith("local_");

    if (localNote.pending_delete) {
      // Handle deletion
      if (!isNew) {
        await api.delete(`/notes/${localNote.id}`);
      }
      // Remove from local database would be done here
      return;
    }

    if (isNew) {
      // Create new note on server
      const response = await api.post("/notes", {
        title: localNote.title,
        content: localNote.content,
        project_id: localNote.project_id,
      });

      // Update local note with server ID
      const serverNote = response.data;
      await saveLocalNote({
        ...localNote,
        id: serverNote.id,
        is_synced: true,
        updated_at: serverNote.updated_at,
      });
    } else {
      // Fetch server version for conflict check
      try {
        const response = await api.get(`/notes/${localNote.id}`);
        const serverNote = response.data;

        // Compare timestamps
        const localTime = new Date(localNote.local_updated_at).getTime();
        const serverTime = new Date(serverNote.updated_at).getTime();

        if (serverTime > localTime) {
          // Server has newer version - conflict!
          await recordConflict({
            entity_type: "note",
            entity_id: localNote.id,
            local_data: JSON.stringify(localNote),
            server_data: JSON.stringify(serverNote),
            local_updated_at: localNote.local_updated_at,
            server_updated_at: serverNote.updated_at,
          });
          console.log(`[SyncService] Conflict detected for note ${localNote.id}`);
        } else {
          // Local is newer - push to server
          await api.put(`/notes/${localNote.id}`, {
            title: localNote.title,
            content: localNote.content,
          });

          // Mark as synced
          await saveLocalNote({
            ...localNote,
            is_synced: true,
          });
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          // Note doesn't exist on server, create it
          const response = await api.post("/notes", {
            title: localNote.title,
            content: localNote.content,
            project_id: localNote.project_id,
          });

          await saveLocalNote({
            ...localNote,
            id: response.data.id,
            is_synced: true,
          });
        } else {
          throw error;
        }
      }
    }
  } catch (error: any) {
    console.error(`[SyncService] Failed to sync note ${localNote.id}:`, error);

    // Update note with sync error
    await saveLocalNote({
      ...localNote,
      sync_error: error.message || "Sync failed",
    });
  }
}

/**
 * Sync a single project to server with conflict detection
 */
async function syncProject(localProject: LocalProject): Promise<void> {
  try {
    // Similar to syncNote but for projects
    const isNew = localProject.id.startsWith("local_");

    if (isNew) {
      const response = await api.post("/projects", {
        name: localProject.name,
        description: localProject.description,
      });

      await saveLocalProject({
        ...localProject,
        id: response.data.id,
        is_synced: true,
      });
    } else {
      try {
        const response = await api.get(`/projects/${localProject.id}`);
        const serverProject = response.data;

        const localTime = new Date(localProject.local_updated_at).getTime();
        const serverTime = new Date(serverProject.updated_at).getTime();

        if (serverTime > localTime) {
          await recordConflict({
            entity_type: "project",
            entity_id: localProject.id,
            local_data: JSON.stringify(localProject),
            server_data: JSON.stringify(serverProject),
            local_updated_at: localProject.local_updated_at,
            server_updated_at: serverProject.updated_at,
          });
        } else {
          await api.put(`/projects/${localProject.id}`, {
            name: localProject.name,
            description: localProject.description,
          });

          await saveLocalProject({
            ...localProject,
            is_synced: true,
          });
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          const response = await api.post("/projects", {
            name: localProject.name,
            description: localProject.description,
          });

          await saveLocalProject({
            ...localProject,
            id: response.data.id,
            is_synced: true,
          });
        } else {
          throw error;
        }
      }
    }
  } catch (error: any) {
    console.error(`[SyncService] Failed to sync project ${localProject.id}:`, error);

    await saveLocalProject({
      ...localProject,
      sync_error: error.message || "Sync failed",
    });
  }
}

/**
 * Force sync all data
 */
export async function forceSync(): Promise<void> {
  console.log("[SyncService] Force sync requested");
  await processOfflineQueue();
  await syncLocalChanges();
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return { ...currentStatus };
}

/**
 * Cleanup sync service (call when app is closing)
 */
export function cleanupSyncService(): void {
  if (networkUnsubscribe) {
    networkUnsubscribe();
    networkUnsubscribe = null;
  }
  console.log("[SyncService] Cleaned up");
}

/**
 * Check if there are pending items to sync
 */
export async function hasPendingSync(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  const stats = await getQueueStats();
  const offlineQueueItems = await offlineQueue.getQueue();
  const offlinePending = offlineQueueItems.filter(
    (a) => a.status === "pending",
  ).length;

  return stats.pending > 0 || offlinePending > 0;
}

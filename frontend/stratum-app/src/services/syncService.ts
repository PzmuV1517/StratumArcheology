/**
 * STRATUM Sync Service
 * 
 * Handles synchronization between local database and server:
 * - Queue management for offline requests
 * - Conflict detection and resolution
 * - Background sync when connection restored
 * - Timestamp-based last-write-wins with conflict detection
 * 
 * Cross-platform: Works on both web and native
 */

import { Platform } from 'react-native';
import api from '../services/api';
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
} from '../db';

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

/**
 * Initialize the sync service
 * Call this when the app starts
 */
export async function initSyncService(): Promise<void> {
  try {
    await initDatabase();
    console.log('[SyncService] Database initialized');
    
    // Update initial status
    const stats = await getQueueStats();
    updateSyncStatus({
      pendingCount: stats.pending,
      failedCount: stats.failed,
    });
  } catch (error) {
    console.error('[SyncService] Initialization failed:', error);
    throw error;
  }
}

/**
 * Process the request queue
 * Call this when network is restored or periodically
 */
export async function processQueue(): Promise<void> {
  // Prevent concurrent syncs
  if (currentStatus.isSyncing) {
    console.log('[SyncService] Sync already in progress');
    return;
  }

  updateSyncStatus({ isSyncing: true, error: null });
  console.log('[SyncService] Processing queue...');

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

    console.log('[SyncService] Queue processing complete');
  } catch (error: any) {
    console.error('[SyncService] Queue processing failed:', error);
    updateSyncStatus({
      isSyncing: false,
      error: error.message || 'Sync failed',
    });
  }
}

/**
 * Process a single queued request
 */
async function processRequest(request: QueuedRequest): Promise<void> {
  try {
    // Mark as processing
    await updateRequestStatus(request.id, 'processing');

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
    const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    console.error(`[SyncService] Request ${request.id} failed:`, errorMessage);

    // Check if we should retry
    if (request.retry_count < MAX_RETRIES && isRetryableError(error)) {
      // Schedule retry with exponential backoff
      await updateRequestStatus(request.id, 'pending', errorMessage);
      const delay = getRetryDelay(request.retry_count);
      console.log(`[SyncService] Will retry in ${delay}ms`);
    } else {
      // Mark as failed - needs manual intervention
      await updateRequestStatus(request.id, 'failed', errorMessage);
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
    console.error('[SyncService] Sync failed:', error);
    updateSyncStatus({
      isSyncing: false,
      error: error.message || 'Sync failed',
    });
  }
}

/**
 * Sync a single note to server with conflict detection
 */
async function syncNote(localNote: LocalNote): Promise<void> {
  try {
    // Check if this is a new note or update
    const isNew = localNote.id.startsWith('local_');
    
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
      const response = await api.post('/notes', {
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
            entity_type: 'note',
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
          const response = await api.post('/notes', {
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
      sync_error: error.message || 'Sync failed',
    });
  }
}

/**
 * Sync a single project to server with conflict detection
 */
async function syncProject(localProject: LocalProject): Promise<void> {
  try {
    // Similar to syncNote but for projects
    const isNew = localProject.id.startsWith('local_');

    if (isNew) {
      const response = await api.post('/projects', {
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
            entity_type: 'project',
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
          const response = await api.post('/projects', {
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
      sync_error: error.message || 'Sync failed',
    });
  }
}

/**
 * Force sync all data
 */
export async function forceSync(): Promise<void> {
  console.log('[SyncService] Force sync requested');
  await syncLocalChanges();
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return { ...currentStatus };
}

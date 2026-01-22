/**
 * STRATUM Offline Database Service
 *
 * Cross-platform database abstraction layer:
 * - Native (iOS/Android): Uses expo-sqlite
 * - Web: Uses localStorage with in-memory cache
 *
 * Provides unified API for local data storage regardless of platform.
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DB_NAME,
  CREATE_TABLES_SQL,
  INIT_METADATA_SQL,
  LocalProject,
  LocalNote,
  QueuedRequest,
  SyncConflict,
} from "./schema";

// Lazy load expo-sqlite only on native platforms
let SQLite: any = null;
let db: any = null;

/**
 * Initialize the database connection.
 * Must be called before any database operations.
 */
export async function initDatabase(): Promise<void> {
  if (Platform.OS === "web") {
    // Web uses AsyncStorage
    console.log("[OfflineDB] Using AsyncStorage for web platform");
    await initWebStorage();
  } else {
    // Native uses SQLite
    console.log("[OfflineDB] Using SQLite for native platform");
    await initSQLite();
  }
}

/**
 * Initialize SQLite database for native platforms
 */
async function initSQLite(): Promise<void> {
  try {
    SQLite = require("expo-sqlite");
    db = await SQLite.openDatabaseAsync(DB_NAME);

    // Execute table creation as a transaction
    await db.execAsync(CREATE_TABLES_SQL);
    await db.execAsync(INIT_METADATA_SQL);

    console.log("[OfflineDB] SQLite database initialized successfully");
  } catch (error) {
    console.error("[OfflineDB] SQLite initialization failed:", error);
    throw error;
  }
}

/**
 * Initialize web storage with IndexedDB-like structure in AsyncStorage
 */
async function initWebStorage(): Promise<void> {
  try {
    // Check if already initialized
    const initialized = await AsyncStorage.getItem("@stratum_db_initialized");
    if (!initialized) {
      // Initialize empty collections
      await AsyncStorage.setItem("@stratum_projects", JSON.stringify([]));
      await AsyncStorage.setItem("@stratum_notes", JSON.stringify([]));
      await AsyncStorage.setItem("@stratum_queue", JSON.stringify([]));
      await AsyncStorage.setItem("@stratum_conflicts", JSON.stringify([]));
      await AsyncStorage.setItem("@stratum_db_initialized", "true");
      console.log("[OfflineDB] Web storage initialized");
    }
  } catch (error) {
    console.error("[OfflineDB] Web storage initialization failed:", error);
    throw error;
  }
}

// =============================================================================
// Project Operations
// =============================================================================

/**
 * Save or update a project in local storage
 */
export async function saveLocalProject(project: LocalProject): Promise<void> {
  if (Platform.OS === "web") {
    const projects = await getLocalProjects();
    const index = projects.findIndex((p) => p.id === project.id);
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.push(project);
    }
    await AsyncStorage.setItem("@stratum_projects", JSON.stringify(projects));
  } else {
    await db.runAsync(
      `INSERT OR REPLACE INTO local_projects 
       (id, name, description, owner_id, created_at, updated_at, is_active, local_updated_at, is_synced, sync_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        project.name,
        project.description,
        project.owner_id,
        project.created_at,
        project.updated_at,
        project.is_active ? 1 : 0,
        project.local_updated_at,
        project.is_synced ? 1 : 0,
        project.sync_error,
      ],
    );
  }
}

/**
 * Get all local projects
 */
export async function getLocalProjects(): Promise<LocalProject[]> {
  if (Platform.OS === "web") {
    const data = await AsyncStorage.getItem("@stratum_projects");
    return data ? JSON.parse(data) : [];
  } else {
    const result = await db.getAllAsync(
      "SELECT * FROM local_projects WHERE is_active = 1",
    );
    return result.map((row: any) => ({
      ...row,
      is_active: Boolean(row.is_active),
      is_synced: Boolean(row.is_synced),
    }));
  }
}

/**
 * Get a single project by ID
 */
export async function getLocalProject(id: string): Promise<LocalProject | null> {
  if (Platform.OS === "web") {
    const projects = await getLocalProjects();
    return projects.find((p) => p.id === id) || null;
  } else {
    const result = await db.getFirstAsync(
      "SELECT * FROM local_projects WHERE id = ?",
      [id],
    );
    if (result) {
      return {
        ...result,
        is_active: Boolean(result.is_active),
        is_synced: Boolean(result.is_synced),
      };
    }
    return null;
  }
}

/**
 * Get unsynced projects
 */
export async function getUnsyncedProjects(): Promise<LocalProject[]> {
  if (Platform.OS === "web") {
    const projects = await getLocalProjects();
    return projects.filter((p) => !p.is_synced);
  } else {
    const result = await db.getAllAsync(
      "SELECT * FROM local_projects WHERE is_synced = 0",
    );
    return result.map((row: any) => ({
      ...row,
      is_active: Boolean(row.is_active),
      is_synced: Boolean(row.is_synced),
    }));
  }
}

// =============================================================================
// Note Operations
// =============================================================================

/**
 * Save or update a note in local storage
 */
export async function saveLocalNote(note: LocalNote): Promise<void> {
  if (Platform.OS === "web") {
    const notes = await getLocalNotes(note.project_id);
    const allNotes = await getAllLocalNotes();
    const index = allNotes.findIndex((n) => n.id === note.id);
    if (index >= 0) {
      allNotes[index] = note;
    } else {
      allNotes.push(note);
    }
    await AsyncStorage.setItem("@stratum_notes", JSON.stringify(allNotes));
  } else {
    await db.runAsync(
      `INSERT OR REPLACE INTO local_notes 
       (id, title, content, project_id, author_id, created_at, updated_at, local_updated_at, is_synced, pending_delete, sync_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        note.id,
        note.title,
        note.content,
        note.project_id,
        note.author_id,
        note.created_at,
        note.updated_at,
        note.local_updated_at,
        note.is_synced ? 1 : 0,
        note.pending_delete ? 1 : 0,
        note.sync_error,
      ],
    );
  }
}

/**
 * Get all notes (internal use)
 */
async function getAllLocalNotes(): Promise<LocalNote[]> {
  if (Platform.OS === "web") {
    const data = await AsyncStorage.getItem("@stratum_notes");
    return data ? JSON.parse(data) : [];
  } else {
    const result = await db.getAllAsync("SELECT * FROM local_notes");
    return result.map((row: any) => ({
      ...row,
      is_synced: Boolean(row.is_synced),
      pending_delete: Boolean(row.pending_delete),
    }));
  }
}

/**
 * Get notes for a specific project
 */
export async function getLocalNotes(projectId: string): Promise<LocalNote[]> {
  if (Platform.OS === "web") {
    const allNotes = await getAllLocalNotes();
    return allNotes.filter((n) => n.project_id === projectId && !n.pending_delete);
  } else {
    const result = await db.getAllAsync(
      "SELECT * FROM local_notes WHERE project_id = ? AND pending_delete = 0",
      [projectId],
    );
    return result.map((row: any) => ({
      ...row,
      is_synced: Boolean(row.is_synced),
      pending_delete: Boolean(row.pending_delete),
    }));
  }
}

/**
 * Get a single note by ID
 */
export async function getLocalNote(id: string): Promise<LocalNote | null> {
  if (Platform.OS === "web") {
    const notes = await getAllLocalNotes();
    return notes.find((n) => n.id === id) || null;
  } else {
    const result = await db.getFirstAsync("SELECT * FROM local_notes WHERE id = ?", [
      id,
    ]);
    if (result) {
      return {
        ...result,
        is_synced: Boolean(result.is_synced),
        pending_delete: Boolean(result.pending_delete),
      };
    }
    return null;
  }
}

/**
 * Get unsynced notes
 */
export async function getUnsyncedNotes(): Promise<LocalNote[]> {
  if (Platform.OS === "web") {
    const notes = await getAllLocalNotes();
    return notes.filter((n) => !n.is_synced);
  } else {
    const result = await db.getAllAsync(
      "SELECT * FROM local_notes WHERE is_synced = 0",
    );
    return result.map((row: any) => ({
      ...row,
      is_synced: Boolean(row.is_synced),
      pending_delete: Boolean(row.pending_delete),
    }));
  }
}

/**
 * Mark a note for deletion (soft delete)
 */
export async function markNoteForDeletion(id: string): Promise<void> {
  if (Platform.OS === "web") {
    const notes = await getAllLocalNotes();
    const index = notes.findIndex((n) => n.id === id);
    if (index >= 0) {
      notes[index].pending_delete = true;
      notes[index].is_synced = false;
      notes[index].local_updated_at = new Date().toISOString();
      await AsyncStorage.setItem("@stratum_notes", JSON.stringify(notes));
    }
  } else {
    await db.runAsync(
      "UPDATE local_notes SET pending_delete = 1, is_synced = 0, local_updated_at = ? WHERE id = ?",
      [new Date().toISOString(), id],
    );
  }
}

// =============================================================================
// Request Queue Operations
// =============================================================================

/**
 * Add a request to the offline queue
 */
export async function queueRequest(
  request: Omit<
    QueuedRequest,
    "id" | "created_at" | "retry_count" | "last_error" | "status"
  >,
): Promise<string> {
  const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const queuedRequest: QueuedRequest = {
    id,
    ...request,
    created_at: new Date().toISOString(),
    retry_count: 0,
    last_error: null,
    status: "pending",
  };

  if (Platform.OS === "web") {
    const queue = await getRequestQueue();
    queue.push(queuedRequest);
    await AsyncStorage.setItem("@stratum_queue", JSON.stringify(queue));
  } else {
    await db.runAsync(
      `INSERT INTO request_queue (id, method, url, data, headers, created_at, retry_count, last_error, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        queuedRequest.id,
        queuedRequest.method,
        queuedRequest.url,
        queuedRequest.data,
        queuedRequest.headers,
        queuedRequest.created_at,
        queuedRequest.retry_count,
        queuedRequest.last_error,
        queuedRequest.status,
      ],
    );
  }

  return id;
}

/**
 * Get all pending requests in the queue
 */
export async function getRequestQueue(): Promise<QueuedRequest[]> {
  if (Platform.OS === "web") {
    const data = await AsyncStorage.getItem("@stratum_queue");
    return data ? JSON.parse(data) : [];
  } else {
    return await db.getAllAsync(
      "SELECT * FROM request_queue ORDER BY created_at ASC",
    );
  }
}

/**
 * Get pending requests (not failed)
 */
export async function getPendingRequests(): Promise<QueuedRequest[]> {
  if (Platform.OS === "web") {
    const queue = await getRequestQueue();
    return queue.filter((r) => r.status === "pending");
  } else {
    return await db.getAllAsync(
      "SELECT * FROM request_queue WHERE status = 'pending' ORDER BY created_at ASC",
    );
  }
}

/**
 * Update request status after processing attempt
 */
export async function updateRequestStatus(
  id: string,
  status: QueuedRequest["status"],
  error?: string,
): Promise<void> {
  if (Platform.OS === "web") {
    const queue = await getRequestQueue();
    const index = queue.findIndex((r) => r.id === id);
    if (index >= 0) {
      queue[index].status = status;
      queue[index].retry_count += 1;
      if (error) queue[index].last_error = error;
      await AsyncStorage.setItem("@stratum_queue", JSON.stringify(queue));
    }
  } else {
    await db.runAsync(
      "UPDATE request_queue SET status = ?, retry_count = retry_count + 1, last_error = ? WHERE id = ?",
      [status, error || null, id],
    );
  }
}

/**
 * Remove a request from the queue (after successful processing)
 */
export async function removeFromQueue(id: string): Promise<void> {
  if (Platform.OS === "web") {
    const queue = await getRequestQueue();
    const filtered = queue.filter((r) => r.id !== id);
    await AsyncStorage.setItem("@stratum_queue", JSON.stringify(filtered));
  } else {
    await db.runAsync("DELETE FROM request_queue WHERE id = ?", [id]);
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  failed: number;
  total: number;
}> {
  const queue = await getRequestQueue();
  return {
    pending: queue.filter((r) => r.status === "pending").length,
    failed: queue.filter((r) => r.status === "failed").length,
    total: queue.length,
  };
}

// =============================================================================
// Conflict Operations
// =============================================================================

/**
 * Record a sync conflict for manual resolution
 */
export async function recordConflict(
  conflict: Omit<SyncConflict, "id" | "created_at" | "resolved" | "resolution">,
): Promise<string> {
  const id = `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const fullConflict: SyncConflict = {
    id,
    ...conflict,
    created_at: new Date().toISOString(),
    resolved: false,
    resolution: null,
  };

  if (Platform.OS === "web") {
    const data = await AsyncStorage.getItem("@stratum_conflicts");
    const conflicts: SyncConflict[] = data ? JSON.parse(data) : [];
    conflicts.push(fullConflict);
    await AsyncStorage.setItem("@stratum_conflicts", JSON.stringify(conflicts));
  } else {
    await db.runAsync(
      `INSERT INTO sync_conflicts 
       (id, entity_type, entity_id, local_data, server_data, local_updated_at, server_updated_at, created_at, resolved, resolution)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fullConflict.id,
        fullConflict.entity_type,
        fullConflict.entity_id,
        fullConflict.local_data,
        fullConflict.server_data,
        fullConflict.local_updated_at,
        fullConflict.server_updated_at,
        fullConflict.created_at,
        0,
        null,
      ],
    );
  }

  return id;
}

/**
 * Get unresolved conflicts
 */
export async function getUnresolvedConflicts(): Promise<SyncConflict[]> {
  if (Platform.OS === "web") {
    const data = await AsyncStorage.getItem("@stratum_conflicts");
    const conflicts: SyncConflict[] = data ? JSON.parse(data) : [];
    return conflicts.filter((c) => !c.resolved);
  } else {
    const result = await db.getAllAsync(
      "SELECT * FROM sync_conflicts WHERE resolved = 0",
    );
    return result.map((row: any) => ({
      ...row,
      resolved: Boolean(row.resolved),
    }));
  }
}

/**
 * Resolve a conflict
 */
export async function resolveConflict(
  id: string,
  resolution: "local" | "server" | "merged",
): Promise<void> {
  if (Platform.OS === "web") {
    const data = await AsyncStorage.getItem("@stratum_conflicts");
    const conflicts: SyncConflict[] = data ? JSON.parse(data) : [];
    const index = conflicts.findIndex((c) => c.id === id);
    if (index >= 0) {
      conflicts[index].resolved = true;
      conflicts[index].resolution = resolution;
      await AsyncStorage.setItem("@stratum_conflicts", JSON.stringify(conflicts));
    }
  } else {
    await db.runAsync(
      "UPDATE sync_conflicts SET resolved = 1, resolution = ? WHERE id = ?",
      [resolution, id],
    );
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Clear all local data (use with caution!)
 */
export async function clearAllLocalData(): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.multiRemove([
      "@stratum_projects",
      "@stratum_notes",
      "@stratum_queue",
      "@stratum_conflicts",
      "@stratum_db_initialized",
    ]);
    await initWebStorage();
  } else {
    await db.execAsync(`
      DELETE FROM local_projects;
      DELETE FROM local_notes;
      DELETE FROM request_queue;
      DELETE FROM sync_conflicts;
    `);
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  projects: number;
  notes: number;
  queuedRequests: number;
  unresolvedConflicts: number;
}> {
  const projects = await getLocalProjects();
  const notes = await getAllLocalNotes();
  const queue = await getRequestQueue();
  const conflicts = await getUnresolvedConflicts();

  return {
    projects: projects.length,
    notes: notes.length,
    queuedRequests: queue.length,
    unresolvedConflicts: conflicts.length,
  };
}

/**
 * @file
 * Local database schema definitions.
 *
 * Defines table schemas for local offline data storage.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */

// Types for database records
export interface LocalProject {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  // Sync metadata
  local_updated_at: string;
  is_synced: boolean;
  sync_error: string | null;
}

export interface LocalNote {
  id: string;
  title: string;
  content: string | null;
  project_id: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  // Sync metadata
  local_updated_at: string;
  is_synced: boolean;
  pending_delete: boolean;
  sync_error: string | null;
}

export interface QueuedRequest {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  data: string | null; // JSON stringified
  headers: string; // JSON stringified
  created_at: string;
  retry_count: number;
  last_error: string | null;
  status: "pending" | "processing" | "failed";
}

export interface SyncConflict {
  id: string;
  entity_type: "project" | "note" | "file";
  entity_id: string;
  local_data: string; // JSON stringified
  server_data: string; // JSON stringified
  local_updated_at: string;
  server_updated_at: string;
  created_at: string;
  resolved: boolean;
  resolution: "local" | "server" | "merged" | null;
}

// Offline file metadata for "Save for Offline" feature
export interface OfflineFile {
  id: string;
  project_id: string;
  node_id: string; // File node ID from server
  name: string;
  mime_type: string;
  size: number;
  local_path: string; // Path in app's document directory
  parent_id: string | null;
  created_at: string;
  downloaded_at: string;
  last_accessed_at: string;
  remote_updated_at?: string; // Server's updated_at for sync detection
}

// Recently accessed projects for offline caching (last 3)
export interface RecentProject {
  id: string;
  project_id: string;
  project_data: string; // JSON stringified full project
  notes_data: string; // JSON stringified notes array
  members_data: string; // JSON stringified members array
  accessed_at: string;
}

// Database schema version for migrations
export const DB_VERSION = 1;
export const DB_NAME = "stratum_offline.db";

// Table creation SQL statements
export const CREATE_TABLES_SQL = `
-- Local projects cache
CREATE TABLE IF NOT EXISTS local_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  local_updated_at TEXT NOT NULL,
  is_synced INTEGER DEFAULT 1,
  sync_error TEXT
);

-- Local notes cache
CREATE TABLE IF NOT EXISTS local_notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  project_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  local_updated_at TEXT NOT NULL,
  is_synced INTEGER DEFAULT 1,
  pending_delete INTEGER DEFAULT 0,
  sync_error TEXT,
  FOREIGN KEY (project_id) REFERENCES local_projects(id)
);

-- Request queue for offline API calls
CREATE TABLE IF NOT EXISTS request_queue (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  data TEXT,
  headers TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  status TEXT DEFAULT 'pending'
);

-- Sync conflicts for manual resolution
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  local_data TEXT NOT NULL,
  server_data TEXT NOT NULL,
  local_updated_at TEXT NOT NULL,
  server_updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved INTEGER DEFAULT 0,
  resolution TEXT
);

-- Metadata table for version tracking
CREATE TABLE IF NOT EXISTS db_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notes_project ON local_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON request_queue(status);
CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved ON sync_conflicts(resolved);

-- Offline files cache (Save for Offline feature)
CREATE TABLE IF NOT EXISTS offline_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER DEFAULT 0,
  local_path TEXT NOT NULL,
  parent_id TEXT,
  created_at TEXT NOT NULL,
  downloaded_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL
);

-- Recent projects cache (last 3 accessed for offline viewing)
CREATE TABLE IF NOT EXISTS recent_projects (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  project_data TEXT NOT NULL,
  notes_data TEXT DEFAULT '[]',
  members_data TEXT DEFAULT '[]',
  accessed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_offline_files_project ON offline_files(project_id);
CREATE INDEX IF NOT EXISTS idx_offline_files_node ON offline_files(node_id);
CREATE INDEX IF NOT EXISTS idx_recent_projects_accessed ON recent_projects(accessed_at);
`;

export const INIT_METADATA_SQL = `
INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('version', '${DB_VERSION}');
INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('initialized_at', datetime('now'));
`;

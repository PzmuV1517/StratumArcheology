/**
 * @file
 * Core file management business logic.
 *
 * Provides shared functions for uploading, downloading, listing, and
 * deleting project files via the backend API and MinIO storage.
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
// Shared file service types and API calls
import api from "./api";

/** A file or folder node in the project file tree. */
export interface FileNode {
  id: string;
  name: string;
  type: "folder" | "file";
  parent_id: string | null;
  project_id: string;
  size?: string;
  mime_type?: string;
  is_locked?: boolean;
  owner_id?: string | null;
  is_acl_root?: boolean;
  acl_root_id?: string | null;
  effective_access?: EffectiveAccess | null;
  storage_path?: string;
  created_at: string;
  updated_at: string;
}

export interface EffectiveAccess {
  can_read: boolean;
  can_write: boolean;
  is_acl_root: boolean;
  acl_root_id?: string | null;
  acl_root_name?: string | null;
  is_owner_override?: boolean;
  is_admin_override?: boolean;
  is_project_default?: boolean;
  is_acl_root_owner?: boolean;
}

export interface ACLPrincipalEntry {
  user_id?: string | null;
  group_id?: string | null;
  can_read: boolean;
  can_write: boolean;
  inherited_from_node_id?: string | null;
  display_name?: string | null;
  photo_url?: string | null;
  role?: string | null;
}

export interface ACLState {
  file_node_id: string;
  is_acl_root: boolean;
  inherits_from?: string | null;
  entries: ACLPrincipalEntry[];
}

/** Result of a file download operation. */
export interface DownloadResult {
  blob?: Blob;
  uri?: string;
  contentLength: number;
  mimeType?: string;
}

// Shared API methods (work on both platforms)
/** Core file service providing CRUD and permission operations shared across platforms. */
export const fileServiceCore = {
  listRoot: async (projectId: string): Promise<FileNode[]> => {
    const res = await api.get(`/files/project/${projectId}`);
    return res.data;
  },

  listChildren: async (nodeId: string): Promise<FileNode[]> => {
    const res = await api.get(`/files/${nodeId}/children`);
    return res.data;
  },

  createFolder: async (
    projectId: string,
    name: string,
    parentId: string | null = null,
  ): Promise<FileNode> => {
    try {
      const res = await api.post(`/files/project/${projectId}/folders`, {
        name,
        parent_id: parentId,
      });
      return res.data;
    } catch (error: any) {
      // If offline or network error, queue the action
      if (
        error.code === "ERR_NETWORK" ||
        error.message?.includes("Network") ||
        !error.response
      ) {
        const { offlineQueue } = await import("./offlineQueueService");
        const { authService } = await import("./authService");
        const user = await authService.getCurrentUser();
        const tempId = `temp_folder_${Date.now()}`;

        if (user) {
          await offlineQueue.enqueue(
            "CREATE_FOLDER",
            projectId,
            { name, parent_id: parentId },
            user.id,
            { priority: 1 },
          );

          // Return temporary folder object
          return {
            id: tempId,
            name,
            type: "folder",
            parent_id: parentId,
            project_id: projectId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as FileNode;
        }
      }
      throw error;
    }
  },

  moveNode: async (
    nodeId: string,
    newParentId: string | null = null,
  ): Promise<FileNode> => {
    const res = await api.put(`/files/${nodeId}/move`, {
      new_parent_id: newParentId,
    });
    return res.data;
  },

  renameNode: async (nodeId: string, name: string): Promise<FileNode> => {
    const res = await api.put(`/files/${nodeId}/rename`, { name });
    return res.data;
  },

  deleteNode: async (nodeId: string): Promise<void> => {
    await api.delete(`/files/${nodeId}`);
  },

  getNodeInfo: async (nodeId: string): Promise<FileNode> => {
    const res = await api.get(`/files/info/${nodeId}`);
    return res.data;
  },

  // Users folder methods - access personal folder within a project
  getMyFolder: async (projectId: string): Promise<FileNode | null> => {
    try {
      const res = await api.get(`/files/project/${projectId}/my-folder`);
      // Backend returns null/empty when folder doesn't exist
      return res.data || null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  createMyFolder: async (projectId: string): Promise<FileNode> => {
    const res = await api.post(`/files/project/${projectId}/my-folder`);
    return res.data;
  },

  getMyFolderPermissions: async (
    projectId: string,
  ): Promise<{
    folder_id: string | null;
    default_can_view: boolean;
    default_can_edit: boolean;
    member_permissions: { user_id: string; can_view: boolean; can_edit: boolean }[];
  }> => {
    const res = await api.get(`/files/project/${projectId}/my-folder/permissions`);
    return res.data;
  },

  updateMyFolderPermissions: async (
    projectId: string,
    settings: {
      default_can_view: boolean;
      default_can_edit: boolean;
      member_permissions: {
        user_id: string;
        can_view: boolean;
        can_edit: boolean;
      }[];
    },
  ): Promise<{ message: string; folder_id: string }> => {
    const res = await api.put(
      `/files/project/${projectId}/my-folder/permissions`,
      settings,
    );
    return res.data;
  },

  getSharedWithMe: async (projectId: string): Promise<FileNode[]> => {
    const res = await api.get(`/files/project/${projectId}/shared-with-me`);
    return res.data;
  },

  getSharedByMe: async (projectId: string): Promise<FileNode[]> => {
    const res = await api.get(`/files/project/${projectId}/shared-by-me`);
    return res.data;
  },

  getAcl: async (nodeId: string): Promise<ACLState> => {
    const res = await api.get(`/acl/${nodeId}`);
    return res.data;
  },

  putAcl: async (
    nodeId: string,
    payload: { is_acl_root: boolean; entries: ACLPrincipalEntry[] },
  ): Promise<ACLState> => {
    const res = await api.put(`/acl/${nodeId}`, payload);
    return res.data;
  },
};

// ── History / Time Machine ────────────────────────────────────────────────────

export interface SnapshotEntry {
  id: string;
  project_id: string;
  node_id: string | null;
  kind: string;
  version: number;
  actor_id: string | null;
  actor_display_name: string | null;
  actor_photo_url: string | null;
  reason: string;
  summary: string | null;
  created_at: string;
  name_at_snapshot: string | null;
  path_at_snapshot: string | null;
  blob_sha256: string | null;
  is_revertible: boolean;
}

export interface HistoryTimeline {
  project_id: string;
  total: number;
  snapshots: SnapshotEntry[];
}

export interface DeletedNode {
  snapshot_id: string;
  node_id: string | null;
  name: string;
  type: string;
  parent_id_at_snapshot: string | null;
  path_at_snapshot: string | null;
  deleted_at: string;
  deleted_by_id: string | null;
  deleted_by_display_name: string | null;
  expires_at: string;
}

export const historyService = {
  getProjectTimeline: async (
    projectId: string,
    params?: { limit?: number; offset?: number; kind?: string; actor_id?: string },
  ): Promise<HistoryTimeline> => {
    const res = await api.get(`/history/project/${projectId}`, { params });
    return res.data;
  },

  getNodeTimeline: async (
    nodeId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<HistoryTimeline> => {
    const res = await api.get(`/history/node/${nodeId}`, { params });
    return res.data;
  },

  getDeletedNodes: async (projectId: string): Promise<DeletedNode[]> => {
    const res = await api.get(`/history/project/${projectId}/deleted`);
    return res.data;
  },

  restoreSnapshot: async (
    snapshotId: string,
    force = false,
  ): Promise<{ restored: boolean; message?: string }> => {
    const res = await api.post(`/history/restore/${snapshotId}`, { force });
    return res.data;
  },

  emptyBin: async (
    projectId: string,
  ): Promise<{ purged: number }> => {
    const res = await api.delete(`/history/project/${projectId}/bin`);
    return res.data;
  },
};

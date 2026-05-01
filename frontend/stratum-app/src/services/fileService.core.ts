/**
 * @file
 * Core file management business logic.
 *
 * Provides shared functions for uploading, downloading, listing, and
 * deleting project files via the backend API and MinIO storage.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
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
  storage_path?: string;
  created_at: string;
  updated_at: string;
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
};

// Shared file service types and API calls
import api from './api';

export interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parent_id: string | null;
  project_id: string;
  size?: string;
  mime_type?: string;
  is_locked?: boolean;
  storage_path?: string;
  created_at: string;
  updated_at: string;
}

export interface DownloadResult {
  blob?: Blob;
  uri?: string;
  contentLength: number;
  mimeType?: string;
}

// Shared API methods (work on both platforms)
export const fileServiceCore = {
  listRoot: async (projectId: string): Promise<FileNode[]> => {
    const res = await api.get(`/files/project/${projectId}`);
    return res.data;
  },

  listChildren: async (nodeId: string): Promise<FileNode[]> => {
    const res = await api.get(`/files/${nodeId}/children`);
    return res.data;
  },

  createFolder: async (projectId: string, name: string, parentId: string | null = null): Promise<FileNode> => {
    const res = await api.post(`/files/project/${projectId}/folders`, { name, parent_id: parentId });
    return res.data;
  },

  moveNode: async (nodeId: string, newParentId: string | null = null): Promise<FileNode> => {
    const res = await api.put(`/files/${nodeId}/move`, { new_parent_id: newParentId });
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
    const res = await api.get(`/files/${nodeId}`);
    return res.data;
  },

  // Users folder methods - access personal folder within a project
  getMyFolder: async (projectId: string): Promise<FileNode | null> => {
    try {
      const res = await api.get(`/files/project/${projectId}/my-folder`);
      return res.data;
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

  getSharedWithMe: async (projectId: string): Promise<FileNode[]> => {
    const res = await api.get(`/files/project/${projectId}/shared-with-me`);
    return res.data;
  },

  getSharedByMe: async (projectId: string): Promise<FileNode[]> => {
    const res = await api.get(`/files/project/${projectId}/shared-by-me`);
    return res.data;
  },
};

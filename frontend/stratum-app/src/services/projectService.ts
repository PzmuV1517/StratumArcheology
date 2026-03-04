/**
 * @file
 * Project management service.
 *
 * Provides functions for creating, reading, updating, and deleting
 * archaeological site projects, managing members, and handling
 * project-level operations via the backend API.
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
import api, { resolveBaseUrl } from "./api";
import {
  Project,
  ProjectMember,
  CreateProjectData,
  UpdateProjectData,
  InviteResponse,
  JoinResponse,
  GpsState,
} from "./projectService.types";

/**
 * Project service - works on both web and native
 * All methods use standard HTTP calls via axios
 */
export const projectService = {
  /**
   * Get all projects for the current user
   */
  getProjects: async (): Promise<Project[]> => {
    try {
      const response = await api.get("/projects");
      return response.data;
    } catch (error: any) {
      throw error.response?.data || error;
    }
  },

  /**
   * Get a single project by ID
   */
  getProject: async (projectId: string): Promise<Project> => {
    try {
      const response = await api.get(`/projects/${projectId}`);
      return response.data;
    } catch (error: any) {
      const err = error.response?.data || error;
      if (error.response?.status) {
        err.status = error.response.status;
      }
      throw err;
    }
  },

  /**
   * Create a new project
   */
  createProject: async (projectData: CreateProjectData): Promise<Project> => {
    try {
      const response = await api.post("/projects", projectData);
      return response.data;
    } catch (error: any) {
      throw error.response?.data || error;
    }
  },

  /**
   * Update a project
   */
  updateProject: async (
    projectId: string,
    projectData: UpdateProjectData,
  ): Promise<Project> => {
    try {
      const response = await api.put(`/projects/${projectId}`, projectData);
      return response.data;
    } catch (error: any) {
      throw error.response?.data || error;
    }
  },

  /**
   * Delete a project
   */
  deleteProject: async (projectId: string): Promise<void> => {
    try {
      await api.delete(`/projects/${projectId}`);
    } catch (error: any) {
      throw error.response?.data || error;
    }
  },

  /**
   * Invite a user to a project
   */
  createInvite: async (
    projectId: string,
    role: string,
    ttlHours: number = 336,
    maxUses: number | null = null,
  ): Promise<InviteResponse> => {
    try {
      const response = await api.post(`/projects/${projectId}/invites`, {
        role,
        ttl_hours: ttlHours,
        max_uses: maxUses,
      });
      return response.data;
    } catch (error: any) {
      throw error.response?.data || error;
    }
  },

  /**
   * Accept an invite by token
   */
  acceptInvite: async (token: string): Promise<JoinResponse> => {
    try {
      const response = await api.post(`/invites/accept`, { token });
      return response.data;
    } catch (error: any) {
      const err = error.response?.data || error;
      if (error.response?.status) {
        err.status = error.response.status;
      }
      throw err;
    }
  },

  /**
   * Join project by short code
   */
  joinByCode: async (code: string): Promise<JoinResponse> => {
    try {
      const response = await api.post(`/invites/join-by-code`, { code });
      return response.data;
    } catch (error: any) {
      const err = error.response?.data || error;
      if (error.response?.status) {
        err.status = error.response.status;
      }
      throw err;
    }
  },

  /**
   * Get project members
   */
  getProjectMembers: async (projectId: string): Promise<ProjectMember[]> => {
    const project = await projectService.getProject(projectId);
    return project.members || [];
  },

  /**
   * Remove a member from a project
   */
  removeMember: async (projectId: string, userId: string): Promise<void> => {
    try {
      await api.delete(`/projects/${projectId}/members/${userId}`);
    } catch (error: any) {
      throw error.response?.data || error;
    }
  },

  /**
   * Update member role
   */
  updateMemberRole: async (
    projectId: string,
    userId: string,
    role: string,
  ): Promise<ProjectMember> => {
    try {
      const response = await api.put(
        `/projects/${projectId}/members/${userId}/role`,
        { role },
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data || error;
    }
  },

  /**
   * Upload a cover image for a project.
   * Uses native fetch (not axios) so React Native can correctly serialise
   * the { uri, type, name } blob object into a real multipart part.
   * Axios may stringify the blob before RN's XHR layer sees it.
   */
  uploadCoverImage: async (
    projectId: string,
    asset: { uri: string; type?: string; name?: string },
  ): Promise<Project> => {
    // On native, use FileSystem.uploadAsync which correctly sends the file URI
    // as a real binary multipart part — bypassing FormData serialization issues.
    if (Platform.OS !== "web") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const FileSystem = require("expo-file-system/legacy");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AsyncStorage = require("@react-native-async-storage/async-storage").default;
        const [token, baseUrl] = await Promise.all([
          AsyncStorage.getItem("authToken") as Promise<string | null>,
          resolveBaseUrl(),
        ]);
        const result = await FileSystem.uploadAsync(
          `${baseUrl}/projects/${projectId}/cover-image`,
          asset.uri,
          {
            fieldName: "file",
            mimeType: asset.type || "image/jpeg",
            httpMethod: "POST",
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );
        if (result.status >= 400) {
          throw JSON.parse(result.body);
        }
        return JSON.parse(result.body) as Project;
      } catch (error: any) {
        throw error?.response?.data ?? error;
      }
    }

    // Web: fetch the blob URL to get a real Blob, then wrap in FormData
    try {
      const blob = await fetch(asset.uri).then((r) => r.blob());
      const file = new File([blob], asset.name || "cover.jpg", {
        type: asset.type || blob.type || "image/jpeg",
      });
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post(`/projects/${projectId}/cover-image`, formData);
      return response.data;
    } catch (error: any) {
      throw error?.response?.data ?? error;
    }
  },

  /**
   * Remove the cover image from a project
   */
  deleteCoverImage: async (projectId: string): Promise<Project> => {
    try {
      const response = await api.delete(`/projects/${projectId}/cover-image`);
      return response.data;
    } catch (error: any) {
      throw error.response?.data || error;
    }
  },

  /**
   * Transfer project ownership to another member
   */
  transferOwnership: async (
    projectId: string,
    newOwnerId: string,
  ): Promise<Project> => {
    try {
      const response = await api.post(
        `/projects/${projectId}/transfer-ownership?new_owner_id=${newOwnerId}`,
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data || error;
    }
  },

  /**
   * Get GPS state for a project
   */
  getGps: async (projectId: string): Promise<GpsState> => {
    const res = await api.get(`/projects/${projectId}/gps`);
    return res.data;
  },

  /**
   * Set GPS state for a project
   */
  setGps: async (projectId: string, state: GpsState): Promise<GpsState> => {
    const res = await api.put(`/projects/${projectId}/gps`, state);
    return res.data;
  },

  /**
   * Get publicly visible projects sorted by popularity (member count).
   * Optionally filter by a search query matching name or description.
   */
  getPublicProjects: async (query?: string): Promise<Project[]> => {
    const params: Record<string, string> = {};
    if (query) params.q = query;
    const res = await api.get("/projects/public", { params });
    return res.data;
  },

  /**
   * Toggle public visibility of a project (owner only)
   */
  togglePublicise: async (projectId: string): Promise<Project> => {
    const res = await api.patch(`/projects/${projectId}/publicise`);
    return res.data;
  },

  /**
   * Search users by name, email, or @username
   */
  searchUsers: async (
    query: string,
  ): Promise<
    { id: string; email: string; display_name: string | null; username: string | null; photo_url: string | null }[]
  > => {
    const res = await api.get("/auth/users/search", { params: { query } });
    return res.data;
  },
};

export type {
  Project,
  ProjectMember,
  CreateProjectData,
  UpdateProjectData,
  CoverImageAsset,
  InviteResponse,
  JoinResponse,
  GpsState,
} from "./projectService.types";

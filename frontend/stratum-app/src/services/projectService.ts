import api from './api';
import {
  Project,
  ProjectMember,
  CreateProjectData,
  UpdateProjectData,
  InviteResponse,
  JoinResponse,
  GpsState,
} from './projectService.types';

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
      const response = await api.get('/projects');
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
      const response = await api.post('/projects', projectData);
      return response.data;
    } catch (error: any) {
      throw error.response?.data || error;
    }
  },

  /**
   * Update a project
   */
  updateProject: async (projectId: string, projectData: UpdateProjectData): Promise<Project> => {
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
    ttlHours: number = 168
  ): Promise<InviteResponse> => {
    try {
      const response = await api.post(`/projects/${projectId}/invites`, {
        role,
        ttl_hours: ttlHours,
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
    role: string
  ): Promise<ProjectMember> => {
    try {
      const response = await api.put(`/projects/${projectId}/members/${userId}/role`, { role });
      return response.data;
    } catch (error: any) {
      throw error.response?.data || error;
    }
  },

  /**
   * Transfer project ownership to another member
   */
  transferOwnership: async (projectId: string, newOwnerId: string): Promise<Project> => {
    try {
      const response = await api.post(
        `/projects/${projectId}/transfer-ownership?new_owner_id=${newOwnerId}`
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
};

export type {
  Project,
  ProjectMember,
  CreateProjectData,
  UpdateProjectData,
  InviteResponse,
  JoinResponse,
  GpsState,
} from './projectService.types';

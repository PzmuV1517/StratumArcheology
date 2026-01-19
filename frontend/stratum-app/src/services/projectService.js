import api from './api';

export const projectService = {
  // Get all projects for the current user
  getProjects: async () => {
    try {
      const response = await api.get('/projects');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get a single project by ID
  getProject: async (projectId) => {
    try {
      const response = await api.get(`/projects/${projectId}`);
      return response.data;
    } catch (error) {
      // Preserve status code for access control checks
      const err = error.response?.data || error;
      if (error.response?.status) {
        err.status = error.response.status;
      }
      throw err;
    }
  },

  // Create a new project
  createProject: async (projectData) => {
    try {
      const response = await api.post('/projects', projectData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Update a project
  updateProject: async (projectId, projectData) => {
    try {
      const response = await api.put(`/projects/${projectId}`, projectData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Delete a project
  deleteProject: async (projectId) => {
    try {
      await api.delete(`/projects/${projectId}`);
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Invite a user to a project
  createInvite: async (projectId, role, ttlHours) => {
    try {
      const response = await api.post(`/projects/${projectId}/invites`, {
        role,
        ttl_hours: ttlHours,
      });
      return response.data; // { token, project_id, role, expires_at, accept_path }
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  acceptInvite: async (token) => {
    try {
      const response = await api.post(`/invites/accept`, { token });
      return response.data;
    } catch (error) {
      // Preserve status code for debugging
      const err = error.response?.data || error;
      if (error.response?.status) {
        err.status = error.response.status;
      }
      throw err;
    }
  },

  // Join project by short code
  joinByCode: async (code) => {
    try {
      const response = await api.post(`/invites/join-by-code`, { code });
      return response.data;
    } catch (error) {
      // Preserve status code for debugging
      const err = error.response?.data || error;
      if (error.response?.status) {
        err.status = error.response.status;
      }
      throw err;
    }
  },

  // Get project members: use getProject which includes members
  getProjectMembers: async (projectId) => {
    const project = await projectService.getProject(projectId);
    return project.members || [];
  },

  // Remove a member from a project
  removeMember: async (projectId, userId) => {
    try {
      await api.delete(`/projects/${projectId}/members/${userId}`);
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Update member role
  updateMemberRole: async (projectId, userId, role) => {
    try {
      const response = await api.put(`/projects/${projectId}/members/${userId}/role`, {
        role,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Transfer project ownership to another member
  transferOwnership: async (projectId, newOwnerId) => {
    try {
      const response = await api.post(
        `/projects/${projectId}/transfer-ownership?new_owner_id=${newOwnerId}`
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // GPS state
  getGps: async (projectId) => {
    const res = await api.get(`/projects/${projectId}/gps`);
    return res.data;
  },
  setGps: async (projectId, state) => {
    const res = await api.put(`/projects/${projectId}/gps`, state);
    return res.data;
  },
};

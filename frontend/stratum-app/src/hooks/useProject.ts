import { useState, useEffect, useCallback, useRef } from 'react';
import { projectService, Project } from '../services';
import { socketService } from '../services/socketService';

interface ProjectState {
  project: Project | null;
  projects: Project[];
  isLoading: boolean;
  error: string | null;
}

interface ProjectActions {
  loadProjects: () => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project | null>;
  updateProject: (projectId: string, data: { name?: string; description?: string }) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
  joinByCode: (code: string) => Promise<{ success: boolean; projectId?: string; error?: string }>;
  clearError: () => void;
}

export type UseProjectReturn = ProjectState & ProjectActions;

/**
 * Hook for project state and actions
 * Includes WebSocket integration for real-time updates
 */
export function useProject(projectId?: string): UseProjectReturn {
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Connect to WebSocket when projectId changes
  useEffect(() => {
    if (projectId) {
      socketService.connect(projectId);

      // Subscribe to project updates
      unsubscribeRef.current = socketService.on('project_updated', (data) => {
        if (data.project) {
          setProject(data.project);
        }
      });
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      socketService.disconnect();
    };
  }, [projectId]);

  // Load project when projectId changes
  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
  }, [projectId]);

  const loadProjects = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (e: any) {
      setError(e.detail || e.message || 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadProject = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await projectService.getProject(id);
      setProject(data);
    } catch (e: any) {
      setError(e.detail || e.message || 'Failed to load project');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProject = useCallback(
    async (name: string, description?: string): Promise<Project | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const newProject = await projectService.createProject({ name, description });
        setProjects((prev) => [...prev, newProject]);
        return newProject;
      } catch (e: any) {
        setError(e.detail || e.message || 'Failed to create project');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const updateProject = useCallback(
    async (id: string, data: { name?: string; description?: string }): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const updated = await projectService.updateProject(id, data);
        setProject(updated);
        setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
        return true;
      } catch (e: any) {
        setError(e.detail || e.message || 'Failed to update project');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const deleteProject = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await projectService.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (project?.id === id) {
        setProject(null);
      }
      return true;
    } catch (e: any) {
      setError(e.detail || e.message || 'Failed to delete project');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [project]);

  const joinByCode = useCallback(
    async (code: string): Promise<{ success: boolean; projectId?: string; error?: string }> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await projectService.joinByCode(code);
        // Refresh projects list
        await loadProjects();
        return { success: true, projectId: result.project_id };
      } catch (e: any) {
        const errorMsg = e.detail || e.message || 'Failed to join project';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [loadProjects]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    project,
    projects,
    isLoading,
    error,
    loadProjects,
    loadProject,
    createProject,
    updateProject,
    deleteProject,
    joinByCode,
    clearError,
  };
}

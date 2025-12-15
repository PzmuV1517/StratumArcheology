import { useState, useEffect, useCallback, useRef } from 'react';
import { activityService, ProjectActivity, socketService } from '../services';

interface ActivityState {
  activities: ProjectActivity[];
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
}

interface ActivityActions {
  loadActivities: (page?: number) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export type UseActivityReturn = ActivityState & ActivityActions;

/**
 * Hook for project activity/timeline
 * Includes real-time updates via WebSocket
 */
export function useActivity(projectId: number | undefined): UseActivityReturn {
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentPage = useRef(1);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to real-time activity updates
  useEffect(() => {
    if (!projectId) return;

    // Listen for new activities via WebSocket
    unsubscribeRef.current = socketService.on('activity', (data) => {
      if (data.activity) {
        setActivities((prev) => [data.activity, ...prev]);
      }
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [projectId]);

  // Load initial activities when projectId changes
  useEffect(() => {
    if (projectId) {
      loadActivities(1);
    }
  }, [projectId]);

  const loadActivities = useCallback(
    async (page: number = 1): Promise<void> => {
      if (!projectId) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await activityService.getActivities(projectId, page, 50);

        if (page === 1) {
          setActivities(response.activities);
        } else {
          setActivities((prev) => [...prev, ...response.activities]);
        }

        currentPage.current = page;
        setHasMore(response.has_more);
      } catch (e: any) {
        setError(e.message || 'Failed to load activities');
      } finally {
        setIsLoading(false);
      }
    },
    [projectId]
  );

  const loadMore = useCallback(async (): Promise<void> => {
    if (!hasMore || isLoading) return;
    await loadActivities(currentPage.current + 1);
  }, [hasMore, isLoading, loadActivities]);

  const refresh = useCallback(async (): Promise<void> => {
    currentPage.current = 1;
    await loadActivities(1);
  }, [loadActivities]);

  return {
    activities,
    isLoading,
    hasMore,
    error,
    loadActivities,
    loadMore,
    refresh,
  };
}

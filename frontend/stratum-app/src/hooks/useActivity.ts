import { useState, useEffect, useCallback, useRef } from 'react';
import { activityService, ProjectActivity, socketService } from '../services';

interface ActivityState {
  activities: ProjectActivity[];
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
}

interface ActivityActions {
  loadActivities: () => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export type UseActivityReturn = ActivityState & ActivityActions;

const ITEMS_PER_PAGE = 50;

/**
 * Hook for project activity/timeline
 * Includes real-time updates via WebSocket
 *
 * @param projectId - The project ID (string UUID)
 * @param personalOnly - If true, only show current user's activities
 */
export function useActivity(
  projectId: string | undefined,
  personalOnly: boolean = false
): UseActivityReturn {
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentOffset = useRef(0);
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

  // Load initial activities when projectId or personalOnly changes
  useEffect(() => {
    if (projectId) {
      loadActivities();
    }
  }, [projectId, personalOnly]);

  const loadActivities = useCallback(
    async (append: boolean = false): Promise<void> => {
      if (!projectId) return;

      setIsLoading(true);
      setError(null);

      try {
        const offset = append ? currentOffset.current : 0;

        let newActivities: ProjectActivity[];
        if (personalOnly) {
          // Get personal activities (from /activities/me) and filter by project
          const allMyActivities = await activityService.getMyActivities(200, 0);
          newActivities = allMyActivities.filter((a) => a.project_id === projectId);
          // Apply pagination manually
          newActivities = newActivities.slice(offset, offset + ITEMS_PER_PAGE);
        } else {
          newActivities = await activityService.getActivities(projectId, ITEMS_PER_PAGE, offset);
        }

        if (append) {
          setActivities((prev) => [...prev, ...newActivities]);
        } else {
          setActivities(newActivities);
        }

        currentOffset.current = offset + newActivities.length;
        setHasMore(newActivities.length === ITEMS_PER_PAGE);
      } catch (e: any) {
        setError(e.message || 'Failed to load activities');
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, personalOnly]
  );

  const loadMore = useCallback(async (): Promise<void> => {
    if (!hasMore || isLoading) return;
    await loadActivities(true);
  }, [hasMore, isLoading, loadActivities]);

  const refresh = useCallback(async (): Promise<void> => {
    currentOffset.current = 0;
    await loadActivities(false);
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

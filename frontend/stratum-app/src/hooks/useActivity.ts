/**
 * @file
 * Activity timeline hook.
 *
 * Provides project activity timeline data and refresh
 * capabilities for the activity feed.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { activityService, ProjectActivity, socketService } from "../services";

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

/** Combined activity state and action methods returned by {@link useActivity}. */
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
  personalOnly: boolean = false,
): UseActivityReturn {
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentOffset = useRef(0);

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
          newActivities = await activityService.getActivities(
            projectId,
            ITEMS_PER_PAGE,
            offset,
          );
        }

        if (append) {
          setActivities((prev) => [...prev, ...newActivities]);
        } else {
          setActivities(newActivities);
        }

        currentOffset.current = offset + newActivities.length;
        setHasMore(newActivities.length === ITEMS_PER_PAGE);
      } catch (e: any) {
        setError(e.message || "Failed to load activities");
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, personalOnly],
  );

  // Subscribe to real-time activity updates
  useEffect(() => {
    if (!projectId) return;

    // Listen for new activities via WebSocket
    const unsubscribeActivity = socketService.on("activity", (data) => {
      if (data.activity) {
        setActivities((prev) => [data.activity, ...prev]);
      }
    });

    // Also listen for timeline_updated events to refresh silently
    const unsubscribeTimeline = socketService.on("timeline_updated", (data) => {
      if (data.project_id === projectId) {
        // Silently refresh the timeline
        loadActivities();
      }
    });

    return () => {
      unsubscribeActivity();
      unsubscribeTimeline();
    };
  }, [projectId, loadActivities]);

  // Load initial activities when projectId or personalOnly changes
  useEffect(() => {
    if (projectId) {
      loadActivities();
    }
  }, [projectId, personalOnly, loadActivities]);

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

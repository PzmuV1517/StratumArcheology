/**
 * @file
 * useWheelerData hook.
 *
 * Manages loading, saving, and local state for the Wheeler
 * Space–Time diagram data associated with a project.
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
import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

/* ───────────────────────── Types ───────────────────────── */

/** Represents a trench column in the Wheeler diagram X-axis. */
export interface WheelerTrench {
  /** Unique trench identifier, e.g. "T1", "North Section". */
  id: string;
  /** Display label for this trench column. */
  label: string;
  /** Left-to-right column ordering index. */
  order: number;
}

/** Placement of a stratigraphic context within the Wheeler grid. */
export interface WheelerContextPlacement {
  /** The ID of the associated stratigraphic context. */
  contextId: string;
  /** Trench column IDs this context spans horizontally. */
  trenchIds: string[];
  /** Starting row on the Y-axis (0 = oldest / bottom). */
  rowStart: number;
  /** Ending row on the Y-axis (inclusive). */
  rowEnd: number;
}

/** Complete Wheeler diagram data for a project. */
export interface WheelerData {
  /** Trench columns displayed along the X-axis. */
  trenches: WheelerTrench[];
  /** Context placements within the grid. */
  placements: WheelerContextPlacement[];
}

/** Return type of the {@link useWheelerData} hook. */
export interface UseWheelerDataReturn {
  /** Current Wheeler diagram data state. */
  data: WheelerData;
  /** Whether data is currently being fetched. */
  loading: boolean;
  /** Error message from the last operation, if any. */
  error: string | null;
  /** Whether local data has unsaved changes. */
  dirty: boolean;
  /** Reload data from the API. */
  load: () => Promise<void>;
  /** Persist current data to the API. */
  save: () => Promise<void>;
  /** Add a new trench column. */
  addTrench: (trench: WheelerTrench) => void;
  /** Remove a trench column by ID. */
  removeTrench: (trenchId: string) => void;
  /** Add or update a context placement. */
  updatePlacement: (placement: WheelerContextPlacement) => void;
  /** Remove a placement by context ID. */
  removePlacement: (contextId: string) => void;
  /** Replace the full data state (e.g. after auto-layout). */
  setData: (data: WheelerData) => void;
}

/**
 * Hook for managing Wheeler Space–Time diagram data.
 *
 * Handles loading from and saving to the backend API, as well
 * as local mutations (adding trenches, updating placements).
 *
 * @param projectId - The project whose Wheeler data to manage
 * @returns State and actions for the Wheeler diagram
 */
export function useWheelerData(projectId: string): UseWheelerDataReturn {
  const [data, setDataState] = useState<WheelerData>({
    trenches: [],
    placements: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  /** Fetch Wheeler data from the backend. */
  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/projects/${projectId}/wheeler`);
      const loaded: WheelerData = res.data?.data ?? { trenches: [], placements: [] };
      setDataState(loaded);
      setDirty(false);
    } catch (e: unknown) {
      // 404 means no Wheeler data saved yet — not an error
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setDataState({ trenches: [], placements: [] });
        setDirty(false);
      } else {
        const msg =
          (e as { message?: string })?.message ?? "Failed to load Wheeler data";
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  /** Persist current data to the backend. */
  const save = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    try {
      await api.put(`/projects/${projectId}/wheeler`, { data });
      setDirty(false);
    } catch (e: unknown) {
      const msg =
        (e as { message?: string })?.message ?? "Failed to save Wheeler data";
      setError(msg);
    }
  }, [projectId, data]);

  /** Add a trench column. */
  const addTrench = useCallback((trench: WheelerTrench) => {
    setDataState((prev) => ({
      ...prev,
      trenches: [...prev.trenches, trench],
    }));
    setDirty(true);
  }, []);

  /** Remove a trench column by its ID. */
  const removeTrench = useCallback((trenchId: string) => {
    setDataState((prev) => ({
      trenches: prev.trenches.filter((t) => t.id !== trenchId),
      placements: prev.placements.map((p) => ({
        ...p,
        trenchIds: p.trenchIds.filter((tid) => tid !== trenchId),
      })),
    }));
    setDirty(true);
  }, []);

  /** Add or update a single context placement. */
  const updatePlacement = useCallback((placement: WheelerContextPlacement) => {
    setDataState((prev) => {
      const existing = prev.placements.findIndex(
        (p) => p.contextId === placement.contextId,
      );
      const next = [...prev.placements];
      if (existing >= 0) {
        next[existing] = placement;
      } else {
        next.push(placement);
      }
      return { ...prev, placements: next };
    });
    setDirty(true);
  }, []);

  /** Remove a placement by context ID. */
  const removePlacement = useCallback((contextId: string) => {
    setDataState((prev) => ({
      ...prev,
      placements: prev.placements.filter((p) => p.contextId !== contextId),
    }));
    setDirty(true);
  }, []);

  /** Replace the full data state. */
  const setData = useCallback((next: WheelerData) => {
    setDataState(next);
    setDirty(true);
  }, []);

  // Load on mount / project change
  useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    loading,
    error,
    dirty,
    load,
    save,
    addTrench,
    removeTrench,
    updatePlacement,
    removePlacement,
    setData,
  };
}

/**
 * @file
 * Auto-save hook.
 *
 * Automatically saves content changes after a debounce
 * period to prevent data loss.
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
import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Possible states of the auto-save lifecycle. */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

// Draft metadata
interface DraftMetadata {
  formId: string;
  savedAt: string;
  version: number;
}

interface DraftData<T> {
  data: T;
  metadata: DraftMetadata;
}

interface UseAutoSaveOptions<T> {
  /** Unique identifier for this form (e.g., 'create-note-{projectId}') */
  formId: string;
  /** Initial form data */
  initialData: T;
  /** Callback when draft is restored */
  onRestore?: (data: T) => void;
  /** Auto-save interval in milliseconds (default: 30000 = 30 seconds) */
  interval?: number;
  /** Debounce delay in milliseconds (default: 1000 = 1 second) */
  debounceDelay?: number;
  /** Whether to skip auto-restore on mount */
  skipRestore?: boolean;
}

interface UseAutoSaveReturn<T> {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Last save timestamp */
  lastSavedAt: Date | null;
  /** Whether a draft was restored on mount */
  wasRestored: boolean;
  /** Manually save current data */
  saveDraft: (data: T) => Promise<void>;
  /** Clear the saved draft */
  clearDraft: () => Promise<void>;
  /** Check if a draft exists */
  hasDraft: () => Promise<boolean>;
  /** Get the current draft */
  getDraft: () => Promise<T | null>;
  /** Mark form as successfully submitted (clears draft) */
  markSubmitted: () => Promise<void>;
  /** Schedule a save (debounced) */
  scheduleAutoSave: (data: T) => void;
}

const DRAFT_KEY_PREFIX = "@stratum_draft_";
const DRAFT_VERSION = 1;

/**
 * Auto-save hook for form data persistence
 */
export function useAutoSave<T>({
  formId,
  initialData,
  onRestore,
  interval = 30000,
  debounceDelay = 1000,
  skipRestore = false,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn<T> {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [wasRestored, setWasRestored] = useState(false);

  // Refs for debouncing and intervals
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingDataRef = useRef<T | null>(null);

  const storageKey = `${DRAFT_KEY_PREFIX}${formId}`;

  /**
   * Save draft to storage
   */
  const saveDraft = useCallback(
    async (data: T): Promise<void> => {
      try {
        setSaveStatus("saving");

        const draftData: DraftData<T> = {
          data,
          metadata: {
            formId,
            savedAt: new Date().toISOString(),
            version: DRAFT_VERSION,
          },
        };

        await AsyncStorage.setItem(storageKey, JSON.stringify(draftData));

        const now = new Date();
        setLastSavedAt(now);
        setSaveStatus("saved");

        console.log(`[AutoSave] Draft saved for ${formId}`);

        // Reset to idle after showing "saved" briefly
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (error) {
        console.error(`[AutoSave] Failed to save draft for ${formId}:`, error);
        setSaveStatus("error");
      }
    },
    [formId, storageKey],
  );

  /**
   * Clear the saved draft
   */
  const clearDraft = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(storageKey);
      setLastSavedAt(null);
      setSaveStatus("idle");
      console.log(`[AutoSave] Draft cleared for ${formId}`);
    } catch (error) {
      console.error(`[AutoSave] Failed to clear draft for ${formId}:`, error);
    }
  }, [formId, storageKey]);

  /**
   * Check if a draft exists
   */
  const hasDraft = useCallback(async (): Promise<boolean> => {
    try {
      const data = await AsyncStorage.getItem(storageKey);
      return data !== null;
    } catch {
      return false;
    }
  }, [storageKey]);

  /**
   * Get the current draft
   */
  const getDraft = useCallback(async (): Promise<T | null> => {
    try {
      const data = await AsyncStorage.getItem(storageKey);
      if (!data) return null;

      const parsed: DraftData<T> = JSON.parse(data);

      // Check version compatibility
      if (parsed.metadata.version !== DRAFT_VERSION) {
        console.log(`[AutoSave] Draft version mismatch, clearing old draft`);
        await clearDraft();
        return null;
      }

      return parsed.data;
    } catch (error) {
      console.error(`[AutoSave] Failed to get draft for ${formId}:`, error);
      return null;
    }
  }, [formId, storageKey, clearDraft]);

  /**
   * Mark form as successfully submitted
   */
  const markSubmitted = useCallback(async (): Promise<void> => {
    // Cancel any pending saves
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (intervalTimerRef.current) {
      clearInterval(intervalTimerRef.current);
    }
    pendingDataRef.current = null;

    // Clear the draft
    await clearDraft();
    console.log(`[AutoSave] Form submitted, draft cleared for ${formId}`);
  }, [formId, clearDraft]);

  /**
   * Schedule an auto-save (debounced)
   */
  const scheduleAutoSave = useCallback(
    (data: T): void => {
      // Store pending data
      pendingDataRef.current = data;

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Schedule new save
      debounceTimerRef.current = setTimeout(() => {
        if (pendingDataRef.current) {
          saveDraft(pendingDataRef.current);
        }
      }, debounceDelay);
    },
    [saveDraft, debounceDelay],
  );

  /**
   * Restore draft on mount
   */
  useEffect(() => {
    if (skipRestore) return;

    const restoreDraft = async () => {
      try {
        const draft = await getDraft();
        if (draft) {
          console.log(`[AutoSave] Restoring draft for ${formId}`);
          setWasRestored(true);
          onRestore?.(draft);
        }
      } catch (error) {
        console.error(`[AutoSave] Failed to restore draft:`, error);
      }
    };

    restoreDraft();
  }, [formId]); // Only run on mount

  /**
   * Set up periodic auto-save
   */
  useEffect(() => {
    // Set up interval for periodic saves
    intervalTimerRef.current = setInterval(() => {
      if (pendingDataRef.current) {
        saveDraft(pendingDataRef.current);
      }
    }, interval);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
      }
    };
  }, [interval, saveDraft]);

  return {
    saveStatus,
    lastSavedAt,
    wasRestored,
    saveDraft,
    clearDraft,
    hasDraft,
    getDraft,
    markSubmitted,
    scheduleAutoSave,
  };
}

/**
 * Draft Status Indicator Component Helper
 * Returns status text and color for UI display
 */
export function getDraftStatusDisplay(
  saveStatus: SaveStatus,
  lastSavedAt: Date | null,
  wasRestored: boolean,
): { text: string; color: string; visible: boolean } {
  switch (saveStatus) {
    case "saving":
      return { text: "Saving...", color: "#60a5fa", visible: true };
    case "saved":
      return { text: "Draft saved", color: "#34d399", visible: true };
    case "error":
      return { text: "Failed to save", color: "#f87171", visible: true };
    case "idle":
      if (wasRestored) {
        return { text: "Draft restored", color: "#fbbf24", visible: true };
      }
      if (lastSavedAt) {
        const seconds = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000);
        if (seconds < 60) {
          return { text: `Saved ${seconds}s ago`, color: "#9ca3af", visible: true };
        }
        const minutes = Math.floor(seconds / 60);
        return { text: `Saved ${minutes}m ago`, color: "#9ca3af", visible: true };
      }
      return { text: "", color: "", visible: false };
    default:
      return { text: "", color: "", visible: false };
  }
}

export default useAutoSave;

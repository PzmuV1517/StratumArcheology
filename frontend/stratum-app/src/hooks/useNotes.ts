/**
 * @file
 * Note management hook.
 *
 * Provides note data, loading states, and CRUD actions
 * for project notes.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { noteService, Note, socketService } from "../services";

interface NotesState {
  notes: Note[];
  isLoading: boolean;
  error: string | null;
}

interface NotesActions {
  loadNotes: () => Promise<void>;
  createNote: (title: string, content?: string) => Promise<Note | null>;
  updateNote: (noteId: string, title: string, content?: string) => Promise<boolean>;
  deleteNote: (noteId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

/** Combined notes state and action methods returned by {@link useNotes}. */
export type UseNotesReturn = NotesState & NotesActions;

/**
 * Hook for managing project notes
 * Includes real-time updates via WebSocket
 */
export function useNotes(projectId: number | undefined): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to real-time note updates
  useEffect(() => {
    if (!projectId) return;

    unsubscribeRef.current = socketService.on("content_updated", (data) => {
      if (data.content_type === "notes") {
        // Refresh notes list on any note change
        loadNotes();
      }
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Load notes when projectId changes
  useEffect(() => {
    if (projectId) {
      loadNotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadNotes = useCallback(async (): Promise<void> => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await noteService.getNotes(projectId);
      setNotes(data);
    } catch (e: any) {
      setError(e.message || "Failed to load notes");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const createNote = useCallback(
    async (title: string, content?: string): Promise<Note | null> => {
      if (!projectId) return null;

      setIsLoading(true);
      setError(null);

      try {
        const newNote = await noteService.createNote(projectId, { title, content });
        setNotes((prev) => [newNote, ...prev]);
        return newNote;
      } catch (e: any) {
        setError(e.message || "Failed to create note");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [projectId],
  );

  const updateNote = useCallback(
    async (noteId: string, title: string, content?: string): Promise<boolean> => {
      if (!projectId) return false;

      setIsLoading(true);
      setError(null);

      try {
        const updated = await noteService.updateNote(projectId, noteId, {
          title,
          content,
        });
        setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
        return true;
      } catch (e: any) {
        setError(e.message || "Failed to update note");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [projectId],
  );

  const deleteNote = useCallback(
    async (noteId: string): Promise<boolean> => {
      if (!projectId) return false;

      setIsLoading(true);
      setError(null);

      try {
        await noteService.deleteNote(projectId, noteId);
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        return true;
      } catch (e: any) {
        setError(e.message || "Failed to delete note");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [projectId],
  );

  const refresh = useCallback(async (): Promise<void> => {
    await loadNotes();
  }, [loadNotes]);

  return {
    notes,
    isLoading,
    error,
    loadNotes,
    createNote,
    updateNote,
    deleteNote,
    refresh,
  };
}

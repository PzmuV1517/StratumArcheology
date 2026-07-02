/**
 * @file
 * Core note management business logic.
 *
 * Provides shared functions for creating, reading, updating, and deleting
 * project notes via the backend API.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
// Shared note service types and API calls
import api from "./api";

/** A project note with optional attachments. */
export interface Note {
  id: string;
  title: string;
  content: string;
  project_id: string;
  author_id: string;
  is_voice: boolean;
  created_at: string;
  updated_at: string;
  attachments?: Attachment[];
  transcription?: string | null;
  transcription_original?: string | null;
  transcription_modified?: boolean;
  transcription_status?: "pending" | "processing" | "completed" | "failed" | null;
}

/** A file attachment belonging to a note. */
export interface Attachment {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  url?: string;
}

/** Payload for creating a new note. */
export interface CreateNoteData {
  title: string;
  content: string;
  project_id: string;
  is_voice?: boolean;
}

// Shared API methods (work on both platforms)
/** Core note service providing CRUD operations shared across platforms. */
export const noteServiceCore = {
  getNotes: async (projectId: string): Promise<Note[]> => {
    const response = await api.get(`/notes/project/${projectId}`);
    return response.data;
  },

  getNote: async (noteId: string): Promise<Note> => {
    const response = await api.get(`/notes/${noteId}`);
    return response.data;
  },

  createNote: async (data: CreateNoteData): Promise<Note> => {
    try {
      const response = await api.post("/notes/", {
        title: data.title,
        content: data.content,
        project_id: data.project_id,
        is_voice: data.is_voice || false,
      });
      return response.data;
    } catch (error: any) {
      // If offline or network error, queue the action
      if (
        error.code === "ERR_NETWORK" ||
        error.message?.includes("Network") ||
        !error.response
      ) {
        const { offlineQueue } = await import("./offlineQueueService");
        const { authService } = await import("./authService");
        const user = await authService.getCurrentUser();
        const tempId = `temp_note_${Date.now()}`;

        if (user) {
          await offlineQueue.enqueue(
            "CREATE_NOTE",
            data.project_id,
            {
              title: data.title,
              content: data.content,
              is_voice: data.is_voice || false,
            },
            user.id,
            { priority: 1 },
          );

          // Return a temporary note object
          return {
            id: tempId,
            title: data.title,
            content: data.content,
            project_id: data.project_id,
            author_id: "pending",
            is_voice: data.is_voice || false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Note;
        }
      }
      throw error;
    }
  },

  updateNote: async (noteId: string, noteData: Partial<Note>): Promise<Note> => {
    try {
      const response = await api.put(`/notes/${noteId}`, noteData);
      return response.data;
    } catch (error: any) {
      // If offline or network error, queue the action
      if (
        error.code === "ERR_NETWORK" ||
        error.message?.includes("Network") ||
        !error.response
      ) {
        const { offlineQueue } = await import("./offlineQueueService");
        const { authService } = await import("./authService");
        const user = await authService.getCurrentUser();

        if (user) {
          await offlineQueue.enqueue(
            "UPDATE_NOTE",
            noteData.project_id || "",
            noteData,
            user.id,
            {
              entityId: noteId,
              priority: 2,
            },
          );

          // Return optimistic update
          return {
            ...noteData,
            id: noteId,
            updated_at: new Date().toISOString(),
          } as Note;
        }
      }
      throw error;
    }
  },

  deleteNote: async (noteId: string): Promise<void> => {
    await api.delete(`/notes/${noteId}`);
  },

  deleteAttachment: async (noteId: string, attachmentId: string): Promise<void> => {
    await api.delete(`/notes/${noteId}/attachments/${attachmentId}`);
  },

  updateTranscription: async (
    noteId: string,
    text: string,
  ): Promise<{ transcription: string; transcription_modified: boolean }> => {
    const response = await api.patch(`/notes/${noteId}/transcription`, { text });
    return response.data;
  },

  resetTranscription: async (
    noteId: string,
  ): Promise<{ transcription: string; transcription_modified: boolean }> => {
    const response = await api.post(`/notes/${noteId}/transcription/reset`);
    return response.data;
  },
};

// Shared note service types and API calls
import api from './api';

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
}

export interface Attachment {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  url?: string;
}

export interface CreateNoteData {
  title: string;
  content: string;
  project_id: string;
  is_voice?: boolean;
}

// Shared API methods (work on both platforms)
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
    const response = await api.post('/notes/', {
      title: data.title,
      content: data.content,
      project_id: data.project_id,
      is_voice: data.is_voice || false,
    });
    return response.data;
  },

  updateNote: async (noteId: string, noteData: Partial<Note>): Promise<Note> => {
    const response = await api.put(`/notes/${noteId}`, noteData);
    return response.data;
  },

  deleteNote: async (noteId: string): Promise<void> => {
    await api.delete(`/notes/${noteId}`);
  },

  deleteAttachment: async (noteId: string, attachmentId: string): Promise<void> => {
    await api.delete(`/notes/${noteId}/attachments/${attachmentId}`);
  },
};

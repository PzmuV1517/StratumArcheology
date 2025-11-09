import api from './api';

export const noteService = {
  // Get all notes for a project
  getNotes: async (projectId) => {
    try {
      const response = await api.get(`/notes/project/${projectId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get a single note by ID
  getNote: async (noteId) => {
    try {
      const response = await api.get(`/notes/${noteId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Create a new note
  createNote: async (noteData) => {
    try {
      const response = await api.post('/notes', noteData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Update a note
  updateNote: async (noteId, noteData) => {
    try {
      const response = await api.put(`/notes/${noteId}`, noteData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Delete a note
  deleteNote: async (noteId) => {
    try {
      await api.delete(`/notes/${noteId}`);
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Upload a photo to a note
  uploadPhoto: async (noteId, photoUri) => {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: photoUri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      });

      const response = await api.post(
        `/notes/${noteId}/attachments`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Delete a photo from a note
  deletePhoto: async (noteId, attachmentId) => {
    try {
      await api.delete(`/notes/${noteId}/attachments/${attachmentId}`);
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Upload audio to a note
  uploadAudio: async (noteId, audioUri) => {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/mpeg',
        name: 'voice-note.mp3',
      });
      const response = await api.post(`/notes/${noteId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  // Upload audio blob (web MediaRecorder)
  uploadAudioBlob: async (noteId, blob, filename = 'voice-note.webm') => {
    try {
      const formData = new FormData();
      formData.append('file', new File([blob], filename, { type: blob.type || 'audio/webm' }));
      const response = await api.post(`/notes/${noteId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
};

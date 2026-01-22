// Web-specific note operations
import api from "./api";
import {
  noteServiceCore,
  Note,
  Attachment,
  CreateNoteData,
} from "./noteService.core";

// Re-export types
export * from "./noteService.core";

export const noteService = {
  ...noteServiceCore,

  // Web-specific: upload photo using File object
  uploadPhoto: async (noteId: string, file: File): Promise<Attachment> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post(`/notes/${noteId}/attachments`, formData);
    return response.data;
  },

  // Web-specific: upload audio blob from MediaRecorder
  uploadAudio: async (
    noteId: string,
    blob: Blob,
    filename: string = "voice-note.webm",
  ): Promise<Attachment> => {
    const formData = new FormData();
    const file = new File([blob], filename, { type: blob.type || "audio/webm" });
    formData.append("file", file, filename);
    const response = await api.post(`/notes/${noteId}/attachments`, formData);
    return response.data;
  },

  // Web-specific: upload any file as attachment
  uploadAttachment: async (noteId: string, file: File): Promise<Attachment> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post(`/notes/${noteId}/attachments`, formData);
    return response.data;
  },

  // Web-specific: record audio using MediaRecorder
  createAudioRecorder: (): {
    start: () => Promise<void>;
    stop: () => Promise<Blob>;
    cancel: () => void;
  } => {
    let mediaRecorder: MediaRecorder | null = null;
    let audioChunks: Blob[] = [];

    return {
      start: async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };

        mediaRecorder.start();
      },

      stop: () => {
        return new Promise<Blob>((resolve, reject) => {
          if (!mediaRecorder) {
            reject(new Error("No recording in progress"));
            return;
          }

          mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: "audio/webm" });
            // Stop all tracks
            mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
            resolve(blob);
          };

          mediaRecorder.stop();
        });
      },

      cancel: () => {
        if (mediaRecorder) {
          mediaRecorder.stream.getTracks().forEach((track) => track.stop());
          mediaRecorder = null;
          audioChunks = [];
        }
      },
    };
  },
};

export default noteService;

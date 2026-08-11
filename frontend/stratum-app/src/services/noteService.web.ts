/**
 * @file
 * Web-specific note service implementation.
 *
 * Extends core note functionality with web-specific features.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
// Web-specific note operations
import api from "./api";
import { noteServiceCore, Attachment } from "./noteService.core";

// Re-export types
export * from "./noteService.core";

/** Web-specific note service with browser-based audio and file upload support. */
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
  /**
   * Upload a recording as a note attachment.
   *
   * Shares its signature with the native implementation so cross-platform
   * callers type-check on both; web always takes the Blob form.
   */
  uploadAudio: async (
    noteId: string,
    blob: Blob | string,
    filename: string = "voice-note.webm",
  ): Promise<Attachment> => {
    if (typeof blob === "string") {
      throw new Error("uploadAudio on web expects a Blob, not a URI");
    }
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

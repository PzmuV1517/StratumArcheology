/**
 * @file
 * Web-specific note service implementation.
 *
 * Extends core note functionality with web-specific features.
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

  // Alias for uploadAudio to match the interface expected by create-note
  uploadAudioBlob: async (
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

/**
 * @file
 * Note management service (platform-agnostic entry point).
 *
 * Re-exports platform-specific note service implementations
 * for web and native platforms.
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
import { Platform } from "react-native";
import { isConnectedToBackend, refreshNetworkStatus } from "./networkService";
export * from "./noteService.core";

/**
 * Define the expected service methods for TypeScript
 * Note: uploadAudio signature differs between web (Blob) and native (URI string)
 */
export interface NoteServiceMethods {
  getNotes: (projectId: string) => Promise<any[]>;
  getNote: (noteId: string) => Promise<any>;
  createNote: (data: any) => Promise<any>;
  updateNote: (noteId: string, data: any) => Promise<any>;
  deleteNote: (noteId: string) => Promise<void>;
  uploadAudio: (noteId: string, audioData: any, filename?: string) => Promise<any>;
  uploadAudioBlob?: (noteId: string, blob: Blob, filename?: string) => Promise<any>;
  uploadPhoto: (noteId: string, photoData: any) => Promise<any>;
  uploadAttachment: (noteId: string, ...args: any[]) => Promise<any>;
}

/**
 * Helper to dynamically import the correct platform-specific module.
 * Lazy-loads the module to avoid executing API calls on import.
 */
async function getService(): Promise<NoteServiceMethods> {
  await refreshNetworkStatus();

  const isOnline = isConnectedToBackend();
  if (isOnline) {
    if (Platform.OS === "web") {
      return (await import("./noteService.web")).noteService;
    } else {
      return (await import("./noteService.native")).noteService;
    }
  } else {
    // Offline modules not found, throw error or provide fallback
    if (Platform.OS === "web") {
      // return (await import('./noteServiceOffline.web')).noteService;
      throw new Error("Offline note service for web is not implemented.");
    } else {
      // return (await import('./noteServiceOffline.native')).noteService;
      throw new Error("Offline note service for native is not implemented.");
    }
  }
}

/**
 * Proxy that intercepts calls and delegates to the correct service
 */
export const noteService: NoteServiceMethods = new Proxy({} as NoteServiceMethods, {
  get(_, prop: string) {
    return async (...args: any[]) => {
      const service = await getService();
      const fn = (service as any)[prop];
      if (typeof fn !== "function") {
        throw new Error(`Property ${String(prop)} is not a function on noteService`);
      }
      return fn.apply(service, args);
    };
  },
});

export default noteService;

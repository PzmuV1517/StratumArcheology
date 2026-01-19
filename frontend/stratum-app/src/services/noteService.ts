import { Platform } from 'react-native';
import { isConnectedToBackend, refreshNetworkStatus } from './networkService';
export * from './noteService.core';

/**
 * Define the expected service methods for TypeScript
 */
export interface NoteServiceMethods {
  getNotes: (projectId: string) => Promise<any[]>;
  getNote: (noteId: string) => Promise<any>;
  createNote: (data: any) => Promise<any>;
  updateNote: (noteId: string, data: any) => Promise<any>;
  deleteNote: (noteId: string) => Promise<void>;
}

/**
 * Helper to dynamically import the correct platform-specific module.
 * Lazy-loads the module to avoid executing API calls on import.
 */
async function getService(): Promise<NoteServiceMethods> {
  await refreshNetworkStatus();

  const isOnline = isConnectedToBackend();
  if (isOnline) {
    if (Platform.OS === 'web') {
      return (await import('./noteService.web')).noteService;
    } else {
      return (await import('./noteService.native')).noteService;
    }
  } else {
    // Offline modules not found, throw error or provide fallback
    if (Platform.OS === 'web') {
      // return (await import('./noteServiceOffline.web')).noteService;
      throw new Error('Offline note service for web is not implemented.');
    } else {
      // return (await import('./noteServiceOffline.native')).noteService;
      throw new Error('Offline note service for native is not implemented.');
    }
  }
}

/**
 * Proxy that intercepts calls and delegates to the correct service
 */
export const noteService: NoteServiceMethods = new Proxy({} as NoteServiceMethods, {
  get(_, prop: keyof NoteServiceMethods) {
    return async (...args: any[]) => {
      const service = await getService();
      const fn = service[prop];
      if (typeof fn !== 'function') {
        throw new Error(`Property ${String(prop)} is not a function on noteService`);
      }
      return (fn as (...args: any[]) => any).apply(service, args);
    };
  },
});

export default noteService;

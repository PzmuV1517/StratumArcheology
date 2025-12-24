import { Platform } from 'react-native';
import { isConnectedToBackend, refreshNetworkStatus } from './networkService';
export * from './noteService.core';

/**
 * Helper to dynamically import the correct platform-specific module.
 * Lazy-loads the module to avoid executing API calls on import.
 */
async function getService() {
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
export const noteService = new Proxy(
  {},
  {
    get(_, prop: string) {
      return async (...args: any[]) => {
        const service = await getService();
        // Type assertion to fix TS error: prop as keyof typeof service
        const fn = service[prop as keyof typeof service];
        if (typeof fn !== 'function') {
          throw new Error(`Property ${prop} is not a function on noteService`);
        }
        // Use apply to avoid TS spread argument error
        return (fn as (...args: any[]) => any).apply(service, args);
      };
    },
  }
);

export default noteService;

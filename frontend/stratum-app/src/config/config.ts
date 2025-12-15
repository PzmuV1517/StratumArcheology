import Constants from 'expo-constants';
import { Platform } from 'react-native';

interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

interface AppConfig {
  apiBaseUrl: string;
  firebase: FirebaseConfig;
  app: {
    name: string;
    version: string;
  };
}

const expoExtra = Constants.expoConfig?.extra as Record<string, any> | undefined;

/**
 * Get the appropriate API base URL for the current platform
 * - Web: uses localhost (runs in browser on same machine)
 * - Android emulator: uses 10.0.2.2 (special alias for host machine's localhost)
 * - iOS simulator: uses localhost (shares network with host)
 * - Physical devices: uses machine's local IP address
 */
const getApiBaseUrl = (): string => {
  // Allow override via app.json extra config
  if (expoExtra?.apiBaseUrl) {
    return expoExtra.apiBaseUrl;
  }

  // Default port for the backend
  const port = 8000;

  if (Platform.OS === 'web') {
    // Web runs in browser, localhost works
    return `http://localhost:${port}/api`;
  }

  if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 to reach host machine's localhost
    return `http://10.0.2.2:${port}/api`;
  }

  if (Platform.OS === 'ios') {
    // iOS simulator shares network with host, localhost works
    return `http://localhost:${port}/api`;
  }

  // Fallback
  return `http://localhost:${port}/api`;
};

export const config: AppConfig = {
  apiBaseUrl: getApiBaseUrl(),

  firebase: {
    apiKey: expoExtra?.firebaseApiKey,
    authDomain: expoExtra?.firebaseAuthDomain,
    projectId: expoExtra?.firebaseProjectId,
    storageBucket: expoExtra?.firebaseStorageBucket,
    messagingSenderId: expoExtra?.firebaseMessagingSenderId,
    appId: expoExtra?.firebaseAppId,
  },

  app: {
    name: 'STRATUM',
    version: '1.0.0',
  },
};

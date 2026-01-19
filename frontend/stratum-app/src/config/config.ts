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
 * - Physical devices: uses Expo dev server's host IP (same network)
 */
const getApiBaseUrl = (): string => {
  // Allow override via app.json extra config
  if (expoExtra?.apiBaseUrl) {
    console.log('[Config] Using apiBaseUrl from app.json extra:', expoExtra.apiBaseUrl);
    return expoExtra.apiBaseUrl;
  }

  // Default port for the backend
  const port = 8000;

  console.log('[Config] Platform:', Platform.OS);
  console.log('[Config] Constants.expoConfig?.hostUri:', Constants.expoConfig?.hostUri);
  console.log(
    '[Config] Constants.manifest2?.extra?.expoGo?.debuggerHost:',
    Constants.manifest2?.extra?.expoGo?.debuggerHost
  );

  if (Platform.OS === 'web') {
    // Web runs in browser, localhost works
    const url = `http://localhost:${port}/api`;
    console.log('[Config] Web platform, using:', url);
    return url;
  }

  // For iOS simulator, always use 127.0.0.1 - it shares network with host machine
  if (Platform.OS === 'ios') {
    // Check if we're running in a simulator vs physical device
    // Physical iOS devices need the debuggerHost IP to reach the dev machine
    const debuggerHost =
      Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
    const hostIp = debuggerHost?.split(':')[0];

    // If hostIp is a real network IP (not localhost/127.0.0.1), we might be on a physical device
    // But we can't reliably detect simulator vs physical device, so we provide both options
    // For now, default to 127.0.0.1 for iOS (works in simulator)
    // Users on physical devices can set apiBaseUrl override in AsyncStorage
    const url = `http://127.0.0.1:${port}/api`;
    console.log('[Config] iOS platform (simulator), using:', url);
    console.log('[Config] If on physical device, the app may need debuggerHost:', hostIp);
    return url;
  }

  if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 to reach host machine's localhost
    const url = `http://10.0.2.2:${port}/api`;
    console.log('[Config] Android platform, using:', url);
    return url;
  }

  // For other platforms or physical devices, try to use debuggerHost
  const debuggerHost =
    Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const hostIp = debuggerHost.split(':')[0];
    console.log('[Config] debuggerHost:', debuggerHost, '-> hostIp:', hostIp);
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      const url = `http://${hostIp}:${port}/api`;
      console.log('[Config] Using debuggerHost IP:', url);
      return url;
    }
  }

  // Fallback
  const url = `http://localhost:${port}/api`;
  console.log('[Config] Fallback, using:', url);
  return url;
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

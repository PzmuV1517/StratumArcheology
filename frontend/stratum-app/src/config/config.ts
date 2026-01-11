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
  console.log('[Config] Constants.manifest2?.extra?.expoGo?.debuggerHost:', Constants.manifest2?.extra?.expoGo?.debuggerHost);

  if (Platform.OS === 'web') {
    // Web runs in browser, localhost works
    const url = `http://localhost:${port}/api`;
    console.log('[Config] Web platform, using:', url);
    return url;
  }

  // Try to get the dev server host IP from Expo manifest
  // This works for physical devices on the same network as the dev machine
  const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    // Extract just the IP address (remove port if present)
    const hostIp = debuggerHost.split(':')[0];
    console.log('[Config] debuggerHost:', debuggerHost, '-> hostIp:', hostIp);
    // Only use debuggerHost for actual physical devices
    // Exclude simulator IPs (172.20.x.x is used by Expo for simulators, localhost for simulators)
    const isSimulatorIp = hostIp.startsWith('172.20.');
    if (hostIp && hostIp !== 'localhost' && !isSimulatorIp) {
      const url = `http://${hostIp}:${port}/api`;
      console.log('[Config] Using debuggerHost IP for physical device:', url);
      return url;
    }
  }

  if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 to reach host machine's localhost
    const url = `http://10.0.2.2:${port}/api`;
    console.log('[Config] Android platform, using:', url);
    return url;
  }

  if (Platform.OS === 'ios') {
    // iOS simulator shares network with host
    // Use 127.0.0.1 instead of localhost for more reliable connectivity
    const url = `http://127.0.0.1:${port}/api`;
    console.log('[Config] iOS platform, using:', url);
    return url;
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

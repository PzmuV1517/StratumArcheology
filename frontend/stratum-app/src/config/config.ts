import Constants from "expo-constants";
import { Platform } from "react-native";

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
 * - Tunnel mode: use EXPO_PUBLIC_API_URL env var for ngrok backend URL
 */
const getApiBaseUrl = (): string => {
  // Priority 1: Environment variable (for tunnel/hotspot mode)
  // Set via: EXPO_PUBLIC_API_URL=https://xxx.ngrok.io/api npx expo start --tunnel
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envApiUrl) {
    console.log("[Config] Using EXPO_PUBLIC_API_URL:", envApiUrl);
    return envApiUrl;
  }

  // Priority 2: app.json extra config
  if (expoExtra?.apiBaseUrl) {
    console.log(
      "[Config] Using apiBaseUrl from app.json extra:",
      expoExtra.apiBaseUrl,
    );
    return expoExtra.apiBaseUrl;
  }

  // Default port for the backend
  const port = 8000;

  console.log("[Config] Platform:", Platform.OS);
  console.log(
    "[Config] Constants.expoConfig?.hostUri:",
    Constants.expoConfig?.hostUri,
  );
  console.log(
    "[Config] Constants.manifest2?.extra?.expoGo?.debuggerHost:",
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
  );

  if (Platform.OS === "web") {
    // Web runs in browser, localhost works
    const url = `http://localhost:${port}/api`;
    console.log("[Config] Web platform, using:", url);
    return url;
  }

  // For iOS simulator, always use 127.0.0.1 - it shares network with host machine
  // For physical iOS devices, use the debuggerHost IP from Expo
  if (Platform.OS === "ios") {
    const debuggerHost =
      Constants.expoConfig?.hostUri ||
      Constants.manifest2?.extra?.expoGo?.debuggerHost;
    const hostIp = debuggerHost?.split(":")[0];

    // If we have a real network IP from Expo, use it (physical device over hotspot/wifi)
    if (hostIp && hostIp !== "localhost" && hostIp !== "127.0.0.1") {
      const url = `http://${hostIp}:${port}/api`;
      console.log("[Config] iOS physical device, using debuggerHost IP:", url);
      return url;
    }

    // Fallback for simulator (shares host network)
    const url = `http://127.0.0.1:${port}/api`;
    console.log("[Config] iOS simulator, using:", url);
    return url;
  }

  if (Platform.OS === "android") {
    // Android emulator uses 10.0.2.2 to reach host machine's localhost
    const url = `http://10.0.2.2:${port}/api`;
    console.log("[Config] Android platform, using:", url);
    return url;
  }

  // For other platforms or physical devices, try to use debuggerHost
  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const hostIp = debuggerHost.split(":")[0];
    console.log("[Config] debuggerHost:", debuggerHost, "-> hostIp:", hostIp);
    if (hostIp && hostIp !== "localhost" && hostIp !== "127.0.0.1") {
      const url = `http://${hostIp}:${port}/api`;
      console.log("[Config] Using debuggerHost IP:", url);
      return url;
    }
  }

  // Fallback
  const url = `http://localhost:${port}/api`;
  console.log("[Config] Fallback, using:", url);
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
    name: "STRATUM",
    version: "1.0.0",
  },
};

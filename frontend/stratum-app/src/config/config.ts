/**
 * @file
 * Application configuration constants.
 *
 * Defines API base URLs, feature flags, and environment-specific
 * settings for the STRATUM mobile and web application.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
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

interface GoogleOAuthConfig {
  webClientId?: string;
  iosClientId?: string;
  androidClientId?: string;
}

interface AppConfig {
  apiBaseUrl: string;
  firebase: FirebaseConfig;
  googleOAuth: GoogleOAuthConfig;
  app: {
    name: string;
    version: string;
  };
}

const expoExtra =
  (Constants.expoConfig?.extra as Record<string, any> | undefined) ??
  (Constants.manifest2?.extra as Record<string, any> | undefined) ??
  ((Constants as any).manifest?.extra as Record<string, any> | undefined);

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
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const pagePort = window.location.port;
      const isLocalHost =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host === "0.0.0.0";
      const isExpoDevPort =
        pagePort === "8081" ||
        pagePort === "19006" ||
        pagePort === "19000" ||
        pagePort === "19001";
      const isDevelopment = process.env.NODE_ENV !== "production";

      // Expo web dev commonly runs on :8081/:19006 and should target backend on :8000.
      if (isDevelopment || isLocalHost || isExpoDevPort) {
        const resolvedHost = host === "0.0.0.0" ? "127.0.0.1" : host;
        const url = `http://${resolvedHost}:${port}/api`;
        console.log("[Config] Web development, using:", url);
        return url;
      }

      // Production: use relative URL (e.g., /api on deployed domain)
      const url = `/api`;
      console.log("[Config] Web production, using relative URL:", url);
      return url;
    }

    const url = `http://localhost:${port}/api`;
    console.log("[Config] Web fallback, using:", url);
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
    // Physical device: use the Expo dev server's host IP (same LAN)
    const debuggerHost =
      Constants.expoConfig?.hostUri ||
      Constants.manifest2?.extra?.expoGo?.debuggerHost;
    const hostIp = debuggerHost?.split(":")[0];

    if (hostIp && hostIp !== "localhost" && hostIp !== "127.0.0.1") {
      const url = `http://${hostIp}:${port}/api`;
      console.log("[Config] Android physical device, using debuggerHost IP:", url);
      return url;
    }

    // Emulator fallback: 10.0.2.2 is a special alias for host machine's localhost
    const url = `http://10.0.2.2:${port}/api`;
    console.log("[Config] Android emulator, using:", url);
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

  googleOAuth: {
    webClientId: expoExtra?.googleWebClientId,
    iosClientId: expoExtra?.googleIosClientId,
    androidClientId: expoExtra?.googleAndroidClientId,
  },

  app: {
    name: "STRATUM",
    version: "1.0.0",
  },
};

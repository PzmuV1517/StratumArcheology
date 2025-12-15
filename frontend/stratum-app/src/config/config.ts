import Constants from 'expo-constants';

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

export const config: AppConfig = {
  // Default to backend on port 3000; can be overridden via app.json/eas.json (extra.apiBaseUrl)
  apiBaseUrl: expoExtra?.apiBaseUrl || 'http://localhost:3000/api',

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

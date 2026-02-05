import Constants from "expo-constants";

export const config = {
  // Default to backend on port 3000; can be overridden via app.json/eas.json (extra.apiBaseUrl)
  apiBaseUrl: Constants.expoConfig?.extra?.apiBaseUrl || "http://localhost:3000/api",
  firebase: {
    apiKey: Constants.expoConfig?.extra?.firebaseApiKey,
    authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain,
    projectId: Constants.expoConfig?.extra?.firebaseProjectId,
    storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket,
    messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId,
    appId: Constants.expoConfig?.extra?.firebaseAppId,
  },
  app: {
    name: "STRATUM",
    version: "1.0.0",
  },
};

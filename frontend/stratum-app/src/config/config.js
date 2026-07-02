import Constants from "expo-constants";

const expoExtra =
  Constants.expoConfig?.extra ||
  Constants.manifest2?.extra ||
  Constants.manifest?.extra ||
  {};

export const config = {
  // Default to backend on port 3000; can be overridden via app.json/eas.json (extra.apiBaseUrl)
  apiBaseUrl: expoExtra.apiBaseUrl || "http://localhost:3000/api",
  firebase: {
    apiKey: expoExtra.firebaseApiKey,
    authDomain: expoExtra.firebaseAuthDomain,
    projectId: expoExtra.firebaseProjectId,
    storageBucket: expoExtra.firebaseStorageBucket,
    messagingSenderId: expoExtra.firebaseMessagingSenderId,
    appId: expoExtra.firebaseAppId,
  },
  googleOAuth: {
    webClientId: expoExtra.googleWebClientId,
    iosClientId: expoExtra.googleIosClientId,
    androidClientId: expoExtra.googleAndroidClientId,
  },
  app: {
    name: "STRATUM",
    version: "1.0.0",
  },
};

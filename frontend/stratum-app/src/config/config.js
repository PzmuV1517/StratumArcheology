import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const config = {
  apiBaseUrl:
    Platform.OS === 'web'
      ? 'http://127.0.0.1:8000/api' // correct backend for web
      : Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:3000/api',
  firebase: {
    apiKey: Constants.expoConfig?.extra?.firebaseApiKey,
    authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain,
    projectId: Constants.expoConfig?.extra?.firebaseProjectId,
    storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket,
    messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId,
    appId: Constants.expoConfig?.extra?.firebaseAppId,
  },
  app: {
    name: 'STRATUM',
    version: '1.0.0',
  },
};
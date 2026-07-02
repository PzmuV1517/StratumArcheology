/**
 * @file
 * Firebase authentication service.
 *
 * Handles user registration, login, token verification, and session
 * management using Firebase Auth with JWT token integration.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleAuthProvider, signInWithCredential, signOut } from "firebase/auth";
import { auth } from "./firebaseService";
import {
  User,
  AuthResult,
  AUTH_TOKEN_KEY,
  USER_DATA_KEY,
} from "./authService.types";

const resolveApiError = (error: any, fallback: string): string => {
  return error?.response?.data?.detail || error?.message || fallback;
};

const persistSession = async (accessToken: string, user: User): Promise<void> => {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, accessToken);
  await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
};

/**
 * Auth service - works on both web and native
 * Uses AsyncStorage which has web support via @react-native-async-storage/async-storage
 */
export const authService = {
  /**
   * Login with email and password
   */
  login: async (email: string, password: string): Promise<AuthResult> => {
    try {
      const response = await api.post("/auth/login", {
        email,
        password,
      });
      const { access_token, user } = response.data;

      if (!access_token) {
        return {
          success: false,
          error: "Login response missing access token",
        };
      }

      await persistSession(access_token, user);

      return { success: true, token: access_token, user };
    } catch (error: any) {
      console.error("Login error:", error);
      return {
        success: false,
        error: resolveApiError(error, "Login failed"),
      };
    }
  },

  /**
   * Register new user
   */
  register: async (
    email: string,
    password: string,
    displayName: string,
    username: string,
  ): Promise<AuthResult> => {
    try {
      const response = await api.post("/auth/register", {
        email,
        password,
        display_name: displayName,
        username,
      });
      const { access_token, user, verification_required, message } = response.data;

      if (verification_required || !access_token) {
        return {
          success: true,
          user,
          verificationRequired: true,
          message:
            message ||
            "Verification email sent. Confirm your address before logging in.",
        };
      }

      await persistSession(access_token, user);

      return { success: true, token: access_token, user };
    } catch (error: any) {
      console.error("Register error:", error);
      return {
        success: false,
        error: resolveApiError(error, "Registration failed"),
      };
    }
  },

  /**
   * Exchange a Firebase ID token for a backend API JWT session.
   */
  verifyFirebaseToken: async (
    firebaseToken: string,
    displayName?: string,
  ): Promise<AuthResult> => {
    try {
      const response = await api.post("/auth/verify-token", {
        firebase_token: firebaseToken,
        display_name: displayName,
      });
      const { access_token, user } = response.data;

      if (!access_token) {
        return {
          success: false,
          error: "Token verification response missing access token",
        };
      }

      await persistSession(access_token, user);
      return { success: true, token: access_token, user };
    } catch (error: any) {
      console.error("Firebase token verification error:", error);
      return {
        success: false,
        error: resolveApiError(error, "Authentication failed"),
      };
    }
  },

  /**
   * Login/register with Google token(s) by signing into Firebase first,
   * then exchanging Firebase ID token with the backend.
   */
  loginWithGoogleIdToken: async (
    googleIdToken?: string | null,
    googleAccessToken?: string | null,
  ): Promise<AuthResult> => {
    try {
      if (!googleIdToken && !googleAccessToken) {
        return {
          success: false,
          error: "Google did not return an identity or access token",
        };
      }

      const credential = GoogleAuthProvider.credential(
        googleIdToken ?? null,
        googleAccessToken ?? null,
      );
      const firebaseResult = await signInWithCredential(auth, credential);
      const firebaseToken = await firebaseResult.user.getIdToken(true);
      const response = await api.post("/auth/verify-token", {
        firebase_token: firebaseToken,
        display_name: firebaseResult.user.displayName || undefined,
      });
      const { access_token, user } = response.data;

      if (!access_token) {
        return {
          success: false,
          error: "Token verification response missing access token",
        };
      }

      await persistSession(access_token, user);
      return { success: true, token: access_token, user };
    } catch (error: any) {
      console.error("Google login error:", error);
      return {
        success: false,
        error: resolveApiError(error, "Google authentication failed"),
      };
    }
  },

  /**
   * Logout - clear stored credentials and optionally clear offline data
   * @param clearOfflineData - If true, clears all offline cached data
   */
  logout: async (clearOfflineData: boolean = true): Promise<void> => {
    try {
      try {
        await signOut(auth);
      } catch (firebaseLogoutError) {
        console.warn(
          "[AuthService] Failed to sign out from Firebase session:",
          firebaseLogoutError,
        );
      }

      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem(USER_DATA_KEY);
      // Clear axios default Authorization header
      if (api.defaults && api.defaults.headers) {
        delete (api.defaults.headers as any).common?.Authorization;
      }

      // Clear offline data to prevent data leakage to other users
      if (clearOfflineData) {
        try {
          // Import dynamically to avoid circular dependencies
          const { recentProjectsCache, offlineFilesStorage } =
            await import("./offlineService");
          await recentProjectsCache.clearCache();
          await offlineFilesStorage.clearAllOfflineFiles();

          // Also clear any pending offline queue
          const { offlineQueue, conflicts } = await import("./offlineQueueService");
          await offlineQueue.clearQueue();
          await conflicts.clearResolved();

          console.log("[AuthService] Cleared offline data on logout");
        } catch (offlineError) {
          console.warn("[AuthService] Failed to clear offline data:", offlineError);
        }
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  },

  /**
   * Get current user from storage
   */
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const userDataString = await AsyncStorage.getItem(USER_DATA_KEY);
      return userDataString ? JSON.parse(userDataString) : null;
    } catch (_error) {
      return null;
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: async (): Promise<boolean> => {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    return !!token;
  },

  /**
   * Get stored auth token
   */
  getToken: async (): Promise<string | null> => {
    return AsyncStorage.getItem(AUTH_TOKEN_KEY);
  },

  /**
   * Update stored user data
   */
  updateUserData: async (user: User): Promise<void> => {
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
  },
};

export type { User, AuthResult } from "./authService.types";

// Standalone exports for convenience
/** Check if a user is currently authenticated. */
export const isAuthenticated = authService.isAuthenticated;
/** Retrieve the stored JWT auth token. */
export const getToken = authService.getToken;
/** Get the current user object from local storage. */
export const getCurrentUser = authService.getCurrentUser;
/** Log in with email and password credentials. */
export const login = authService.login;
/** Exchange Firebase token for backend session. */
export const verifyFirebaseToken = authService.verifyFirebaseToken;
/** Log in using Google token(s). */
export const loginWithGoogleIdToken = authService.loginWithGoogleIdToken;
/** Register a new user account. */
export const register = authService.register;
/** Log out and clear stored credentials. */
export const logout = authService.logout;

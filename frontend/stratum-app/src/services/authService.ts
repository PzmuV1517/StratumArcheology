import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  AuthResult,
  AUTH_TOKEN_KEY,
  USER_DATA_KEY,
} from './authService.types';

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
      const response = await api.post('/auth/login', {
        email,
        password,
      });
      const { access_token, user } = response.data;

      await AsyncStorage.setItem(AUTH_TOKEN_KEY, access_token);
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user));

      return { success: true, token: access_token, user };
    } catch (error: any) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Login failed',
      };
    }
  },

  /**
   * Register new user
   */
  register: async (
    email: string,
    password: string,
    displayName: string
  ): Promise<AuthResult> => {
    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        display_name: displayName,
      });
      const { access_token, user } = response.data;

      await AsyncStorage.setItem(AUTH_TOKEN_KEY, access_token);
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user));

      return { success: true, token: access_token, user };
    } catch (error: any) {
      console.error('Register error:', error);
      return {
        success: false,
        error:
          error.response?.data?.detail || error.message || 'Registration failed',
      };
    }
  },

  /**
   * Logout - clear stored credentials and optionally clear offline data
   * @param clearOfflineData - If true, clears all offline cached data
   */
  logout: async (clearOfflineData: boolean = true): Promise<void> => {
    try {
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
          const { recentProjectsCache, offlineFilesStorage } = await import('./offlineService');
          await recentProjectsCache.clearCache();
          await offlineFilesStorage.clearAllOfflineFiles();
          
          // Also clear any pending offline queue
          const { offlineQueue, conflicts } = await import('./offlineQueueService');
          await offlineQueue.clearQueue();
          await conflicts.clearResolved();
          
          console.log('[AuthService] Cleared offline data on logout');
        } catch (offlineError) {
          console.warn('[AuthService] Failed to clear offline data:', offlineError);
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  /**
   * Get current user from storage
   */
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const userDataString = await AsyncStorage.getItem(USER_DATA_KEY);
      return userDataString ? JSON.parse(userDataString) : null;
    } catch (error) {
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

export type { User, AuthResult } from './authService.types';

// Standalone exports for convenience
export const isAuthenticated = authService.isAuthenticated;
export const getToken = authService.getToken;
export const getCurrentUser = authService.getCurrentUser;
export const login = authService.login;
export const register = authService.register;
export const logout = authService.logout;

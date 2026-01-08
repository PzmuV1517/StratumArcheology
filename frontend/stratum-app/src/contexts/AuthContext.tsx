import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { authService } from '../services/authService';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  display_name: string;
  photo_url?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // First check if we have stored user data
      const storedUser = await authService.getCurrentUser();
      const token = await authService.getToken();
      
      if (!storedUser || !token) {
        // No stored session
        setUser(null);
        setLoading(false);
        return;
      }

      // Validate token with backend - this ensures the token hasn't expired
      try {
        const response = await api.get('/auth/me');
        if (response.data) {
          // Token is valid, update stored user data with fresh data from server
          const freshUser = {
            id: response.data.id,
            email: response.data.email,
            display_name: response.data.display_name,
            photo_url: response.data.photo_url,
          };
          await authService.updateUserData(freshUser);
          setUser(freshUser);
        }
      } catch (apiError: any) {
        // Token is invalid or expired (401), already cleared by api interceptor
        console.log('[AuthContext] Token validation failed, clearing session');
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('[AuthContext] login called with email:', email);
      const result = await authService.login(email, password);
      console.log('[AuthContext] authService.login result:', result);
      if (result.success) {
        console.log('[AuthContext] Setting user:', result.user);
        setUser(result.user || null);
        return { success: true };
      } else {
        console.log('[AuthContext] Login failed:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      console.error('[AuthContext] Login exception:', error);
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const register = async (email: string, password: string, displayName: string) => {
    try {
      const result = await authService.register(email, password, displayName);
      if (result.success) {
        setUser(result.user || null);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'Registration failed' };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data) {
        const freshUser = {
          id: response.data.id,
          email: response.data.email,
          display_name: response.data.display_name,
          photo_url: response.data.photo_url,
        };
        await authService.updateUserData(freshUser);
        setUser(freshUser);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

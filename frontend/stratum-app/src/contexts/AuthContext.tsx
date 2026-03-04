/**
 * @file
 * Authentication context provider.
 *
 * Provides authentication state (user, token, loading) and actions
 * (login, register, logout) to all child components via React Context.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useCallback,
} from "react";
import { authService } from "../services/authService";
import api, { authEvents, AUTH_SESSION_EXPIRED } from "../services/api";
import { showAlert } from "../utils/alert";

interface User {
  id: string;
  email: string;
  username?: string;
  display_name: string;
  photo_url?: string;
  banner_url?: string;
  bio?: string;
  description?: string;
  phone?: string;
  timezone?: string;
  show_projects?: boolean;
  link_x?: string;
  link_discord?: string;
  link_bsky?: string;
  link_linkedin?: string;
  link_website?: string;
  has_completed_onboarding?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  sessionExpired: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    displayName: string,
    username: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  sessionExpired: false,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {},
  clearSessionExpired: () => {},
});

/**
 * Provides authentication state and actions to all child components.
 * @param props - Component props containing children to wrap
 * @returns A context provider wrapping children with auth state
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Handle session expiry event from API interceptor
  const handleSessionExpired = useCallback(() => {
    console.log("[AuthContext] Session expired event received");
    setUser(null);
    setSessionExpired(true);
    showAlert("Session Expired", "Your session has expired. Please log in again.", [
      { text: "OK" },
    ]);
  }, []);

  // Clear session expired flag (after user acknowledges or logs in)
  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  useEffect(() => {
    // Subscribe to session expiry events
    authEvents.on(AUTH_SESSION_EXPIRED, handleSessionExpired);

    return () => {
      authEvents.off(AUTH_SESSION_EXPIRED, handleSessionExpired);
    };
  }, [handleSessionExpired]);

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
        const response = await api.get("/auth/me");
        if (response.data) {
          // Token is valid, update stored user data with fresh data from server
          const freshUser = {
            id: response.data.id,
            email: response.data.email,
            username: response.data.username,
            display_name: response.data.display_name,
            photo_url: response.data.photo_url,
            banner_url: response.data.banner_url,
            bio: response.data.bio,
            description: response.data.description,
            phone: response.data.phone,
            timezone: response.data.timezone,
            show_projects: response.data.show_projects,
            link_x: response.data.link_x,
            link_discord: response.data.link_discord,
            link_bsky: response.data.link_bsky,
            link_linkedin: response.data.link_linkedin,
            link_website: response.data.link_website,
            has_completed_onboarding: response.data.has_completed_onboarding,
          };
          await authService.updateUserData(freshUser);
          setUser(freshUser);
        }
      } catch (_apiError: any) {
        // Token is invalid or expired (401), already cleared by api interceptor
        console.log("[AuthContext] Token validation failed, clearing session");
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check error:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log("[AuthContext] login called with email:", email);
      const result = await authService.login(email, password);
      console.log("[AuthContext] authService.login result:", result);
      if (result.success) {
        console.log("[AuthContext] Setting user:", result.user);
        setUser(result.user || null);
        return { success: true };
      } else {
        console.log("[AuthContext] Login failed:", result.error);
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      console.error("[AuthContext] Login exception:", error);
      return { success: false, error: error.message || "Login failed" };
    }
  };

  const register = async (email: string, password: string, displayName: string, username: string) => {
    try {
      const result = await authService.register(email, password, displayName, username);
      if (result.success) {
        setUser(result.user || null);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      return { success: false, error: error.message || "Registration failed" };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await api.get("/auth/me");
      if (response.data) {
        const freshUser = {
          id: response.data.id,
          email: response.data.email,
          username: response.data.username,
          display_name: response.data.display_name,
          photo_url: response.data.photo_url,
          banner_url: response.data.banner_url,
          bio: response.data.bio,
          description: response.data.description,
          phone: response.data.phone,
          timezone: response.data.timezone,
          show_projects: response.data.show_projects,
          link_x: response.data.link_x,
          link_discord: response.data.link_discord,
          link_bsky: response.data.link_bsky,
          link_linkedin: response.data.link_linkedin,
          link_website: response.data.link_website,
          has_completed_onboarding: response.data.has_completed_onboarding,
        };
        await authService.updateUserData(freshUser);
        setUser(freshUser);
      }
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionExpired,
        login,
        register,
        logout,
        refreshUser,
        clearSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Consumes the AuthContext to access authentication state and actions.
 * @returns The current authentication context value
 */
export const useAuth = () => useContext(AuthContext);

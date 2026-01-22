import { useState, useEffect, useCallback } from "react";
import { authService, User } from "../services";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export type UseAuthReturn = AuthState & AuthActions;

/**
 * Hook for authentication state and actions
 * Works on both web and native platforms
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        if (authenticated) {
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error("Auth check failed:", e);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await authService.login(email, password);
        if (result.success && result.user) {
          setUser(result.user);
          setIsAuthenticated(true);
          return true;
        } else {
          setError(result.error || "Login failed");
          return false;
        }
      } catch (e: any) {
        setError(e.message || "Login failed");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await authService.register(email, password, displayName);
        if (result.success && result.user) {
          setUser(result.user);
          setIsAuthenticated(true);
          return true;
        } else {
          setError(result.error || "Registration failed");
          return false;
        }
      } catch (e: any) {
        setError(e.message || "Registration failed");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };
}

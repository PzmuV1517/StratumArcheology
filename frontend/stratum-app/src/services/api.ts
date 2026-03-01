/**
 * @file
 * Axios HTTP client configuration with authentication interceptors.
 *
 * Provides a pre-configured API client that automatically attaches
 * JWT tokens and handles token refresh for all backend requests.
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
import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { config } from "../config/config";

// Simple event system for auth events (React Native compatible)
/** Event name emitted when an authenticated session expires. */
export const AUTH_SESSION_EXPIRED = "auth:session_expired";

type AuthEventCallback = () => void;
const sessionExpiredListeners: AuthEventCallback[] = [];

/** Simple event emitter for authentication lifecycle events. */
export const authEvents = {
  on: (event: string, callback: AuthEventCallback) => {
    if (event === AUTH_SESSION_EXPIRED) {
      sessionExpiredListeners.push(callback);
    }
  },
  off: (event: string, callback: AuthEventCallback) => {
    if (event === AUTH_SESSION_EXPIRED) {
      const index = sessionExpiredListeners.indexOf(callback);
      if (index > -1) {
        sessionExpiredListeners.splice(index, 1);
      }
    }
  },
  emit: (event: string) => {
    if (event === AUTH_SESSION_EXPIRED) {
      sessionExpiredListeners.forEach((cb) => cb());
    }
  },
};

/**
 * Helper to resolve the most appropriate base URL at runtime
 * Supports runtime override via AsyncStorage and HTTPS upgrade for web
 */
export const resolveBaseUrl = async (): Promise<string> => {
  try {
    const override = await AsyncStorage.getItem("apiBaseUrlOverride");
    let base = override || config.apiBaseUrl;

    // Prevent mixed content on HTTPS pages by upgrading scheme when pointing to same host
    const isWeb = typeof window !== "undefined" && typeof document !== "undefined";
    if (
      isWeb &&
      window.location.protocol === "https:" &&
      base.startsWith("http://")
    ) {
      try {
        const target = new URL(base);
        const current = new URL(window.location.href);
        if (target.host === current.host) {
          base = base.replace("http://", "https://");
        }
      } catch {
        // If URL parsing fails, leave base as-is
      }
    }
    return base;
  } catch {
    return config.apiBaseUrl;
  }
};

/**
 * Axios instance configured for the STRATUM API
 * - Auto-attaches auth token from AsyncStorage
 * - Handles JSON and FormData content types
 * - Auto-clears auth on 401 responses
 * - Manually handles 307 redirects to preserve Authorization header
 */
const api: AxiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 30000,
  maxRedirects: 0, // Disable auto-redirects to handle them manually with auth header
  validateStatus: (status) => {
    // Accept 2xx and 307 (we'll handle 307 manually in interceptor)
    return (status >= 200 && status < 300) || status === 307;
  },
});

// Initialize baseURL from saved override ASAP
(async () => {
  const base = await resolveBaseUrl();
  api.defaults.baseURL = base;
})();

// Request interceptor to add auth token and set headers
api.interceptors.request.use(
  async (axiosConfig: InternalAxiosRequestConfig) => {
    // Ensure baseURL honors override on every request
    const base = await resolveBaseUrl();
    axiosConfig.baseURL = base;

    // Debug logging
    console.log("[API] Request to:", base + axiosConfig.url);

    // Attach auth token if available (skip for auth routes that don't need it)
    const url = axiosConfig.url || "";
    const isAuthRoute =
      url.includes("/auth/login") || url.includes("/auth/register");

    if (!isAuthRoute) {
      try {
        const token = await AsyncStorage.getItem("authToken");
        if (token) {
          axiosConfig.headers = axiosConfig.headers || {};
          axiosConfig.headers.Authorization = `Bearer ${token}`;
          console.log("[API] Auth token attached");
        } else {
          console.log("[API] No auth token available");
        }
      } catch (tokenError) {
        console.error("[API] Failed to get auth token:", tokenError);
      }
    } else {
      console.log("[API] Skipping auth token for auth route");
    }

    // Only set JSON Content-Type when body is NOT FormData
    const isFormData =
      typeof FormData !== "undefined" && axiosConfig.data instanceof FormData;
    if (!isFormData) {
      axiosConfig.headers = axiosConfig.headers || {};
      if (!axiosConfig.headers["Content-Type"]) {
        axiosConfig.headers["Content-Type"] = "application/json";
      }
    } else {
      // Remove JSON header so browser can set multipart boundary
      if (
        axiosConfig.headers &&
        axiosConfig.headers["Content-Type"] === "application/json"
      ) {
        delete axiosConfig.headers["Content-Type"];
      }
    }

    return axiosConfig;
  },
  (error) => Promise.reject(error),
);

// Response interceptor to handle 307 redirects and auth errors
api.interceptors.response.use(
  async (response) => {
    // Handle 307 Temporary Redirect - retry with the redirected URL
    // This is needed because 307 redirects lose Authorization headers on iOS
    if (response.status === 307) {
      const redirectUrl = response.headers?.location;

      if (redirectUrl) {
        const originalRequest = response.config;
        // Update the URL and retry with auth header
        originalRequest.url = redirectUrl;
        originalRequest.baseURL = ""; // Clear baseURL since redirectUrl is absolute

        // Re-attach the token
        const token = await AsyncStorage.getItem("authToken");
        if (token) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }

        console.log("[API] Following 307 redirect to:", redirectUrl);
        return api.request(originalRequest);
      }
    }
    return response;
  },
  async (error) => {
    // Check for network errors and provide user-friendly messages
    console.log("[API] Error interceptor:", {
      message: error.message,
      code: error.code,
      hasResponse: !!error.response,
      statusCode: error.response?.status,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
    });

    if (!error.response) {
      // No response - could be network error, timeout, or server unreachable
      // Be more specific about what's actually a "no network" vs "server down"
      const errorMessage = error.message?.toLowerCase() || "";
      const errorCode = error.code || "";

      // These indicate actual network/connectivity issues
      const isNetworkConnectivityError =
        errorCode === "ERR_NETWORK" ||
        errorCode === "ECONNREFUSED" ||
        errorCode === "ENOTFOUND" ||
        errorMessage.includes("network request failed") ||
        errorMessage.includes("network error");

      // Timeout is a different issue - server might be slow, not unreachable
      const isTimeout =
        errorCode === "ECONNABORTED" || errorMessage.includes("timeout");

      console.log("[API] No response analysis:", {
        errorMessage,
        errorCode,
        isNetworkConnectivityError,
        isTimeout,
      });

      if (isNetworkConnectivityError) {
        console.log("[API] Network connectivity error detected");
        // For simulator, this usually means wrong IP or server not running
        const networkError = new Error(
          "Cannot connect to server. Make sure the backend is running.",
        );
        (networkError as any).isNetworkError = true;
        (networkError as any).originalError = error;
        return Promise.reject(networkError);
      }

      if (isTimeout) {
        console.log("[API] Timeout error detected");
        const timeoutError = new Error("Request timed out. The server may be busy.");
        (timeoutError as any).isTimeout = true;
        (timeoutError as any).originalError = error;
        return Promise.reject(timeoutError);
      }

      // For other errors without a response, provide the original message
      console.log("[API] Unknown error without response:", error.message);
    }

    if (error.response?.status === 401) {
      // Only treat as session expiry for authenticated endpoints.
      // Auth routes (login/register) naturally return 401 for bad credentials
      // — that's NOT a session expiry.
      const requestUrl = error.config?.url || "";
      const isAuthRoute =
        requestUrl.includes("/auth/login") || requestUrl.includes("/auth/register");

      if (!isAuthRoute) {
        // Guard against race condition: if a login just succeeded and stored a
        // new token, the stale /auth/me request from checkAuthStatus will come
        // back 401 — but we should NOT wipe the brand-new token.
        // Only clear if the failed request's token matches what's currently stored.
        const failedToken = error.config?.headers?.Authorization?.replace(
          "Bearer ",
          "",
        );
        const currentToken = await AsyncStorage.getItem("authToken");

        if (!currentToken || currentToken === failedToken) {
          // Token expired and nothing newer has replaced it—clear session
          await AsyncStorage.removeItem("authToken");
          await AsyncStorage.removeItem("userData");
          authEvents.emit(AUTH_SESSION_EXPIRED);
        } else {
          // A newer token exists (login just completed)—ignore this stale 401
          console.log("[API] Ignoring stale 401 — a newer token is already stored");
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;

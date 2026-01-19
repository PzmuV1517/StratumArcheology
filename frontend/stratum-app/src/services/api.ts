import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config/config';

// Simple event system for auth events (React Native compatible)
export const AUTH_SESSION_EXPIRED = 'auth:session_expired';

type AuthEventCallback = () => void;
const sessionExpiredListeners: AuthEventCallback[] = [];

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
      sessionExpiredListeners.forEach(cb => cb());
    }
  },
};

/**
 * Helper to resolve the most appropriate base URL at runtime
 * Supports runtime override via AsyncStorage and HTTPS upgrade for web
 */
const resolveBaseUrl = async (): Promise<string> => {
  try {
    const override = await AsyncStorage.getItem('apiBaseUrlOverride');
    let base = override || config.apiBaseUrl;

    // Prevent mixed content on HTTPS pages by upgrading scheme when pointing to same host
    const isWeb =
      typeof window !== 'undefined' && typeof document !== 'undefined';
    if (
      isWeb &&
      window.location.protocol === 'https:' &&
      base.startsWith('http://')
    ) {
      try {
        const target = new URL(base);
        const current = new URL(window.location.href);
        if (target.host === current.host) {
          base = base.replace('http://', 'https://');
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
    console.log('[API] Request to:', base + axiosConfig.url);

    // Attach auth token if available
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        axiosConfig.headers = axiosConfig.headers || {};
        axiosConfig.headers.Authorization = `Bearer ${token}`;
        console.log('[API] Auth token attached');
      } else {
        console.log('[API] No auth token available');
      }
    } catch (tokenError) {
      console.error('[API] Failed to get auth token:', tokenError);
    }

    // Only set JSON Content-Type when body is NOT FormData
    const isFormData =
      typeof FormData !== 'undefined' && axiosConfig.data instanceof FormData;
    if (!isFormData) {
      axiosConfig.headers = axiosConfig.headers || {};
      if (!axiosConfig.headers['Content-Type']) {
        axiosConfig.headers['Content-Type'] = 'application/json';
      }
    } else {
      // Remove JSON header so browser can set multipart boundary
      if (
        axiosConfig.headers &&
        axiosConfig.headers['Content-Type'] === 'application/json'
      ) {
        delete axiosConfig.headers['Content-Type'];
      }
    }

    return axiosConfig;
  },
  (error) => Promise.reject(error)
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
        originalRequest.baseURL = ''; // Clear baseURL since redirectUrl is absolute
        
        // Re-attach the token
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        
        console.log('[API] Following 307 redirect to:', redirectUrl);
        return api.request(originalRequest);
      }
    }
    return response;
  },
  async (error) => {
    // Check for network errors and provide user-friendly messages
    console.log('[API] Error interceptor:', {
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
      const errorMessage = error.message?.toLowerCase() || '';
      const errorCode = error.code || '';
      
      // These indicate actual network/connectivity issues
      const isNetworkConnectivityError = 
        errorCode === 'ERR_NETWORK' ||
        errorCode === 'ECONNREFUSED' ||
        errorCode === 'ENOTFOUND' ||
        errorMessage.includes('network request failed') ||
        errorMessage.includes('network error');
      
      // Timeout is a different issue - server might be slow, not unreachable
      const isTimeout = 
        errorCode === 'ECONNABORTED' || 
        errorMessage.includes('timeout');
      
      console.log('[API] No response analysis:', {
        errorMessage,
        errorCode,
        isNetworkConnectivityError,
        isTimeout,
      });
      
      if (isNetworkConnectivityError) {
        console.log('[API] Network connectivity error detected');
        // For simulator, this usually means wrong IP or server not running
        const networkError = new Error('Cannot connect to server. Make sure the backend is running.');
        (networkError as any).isNetworkError = true;
        (networkError as any).originalError = error;
        return Promise.reject(networkError);
      }
      
      if (isTimeout) {
        console.log('[API] Timeout error detected');
        const timeoutError = new Error('Request timed out. The server may be busy.');
        (timeoutError as any).isTimeout = true;
        (timeoutError as any).originalError = error;
        return Promise.reject(timeoutError);
      }
      
      // For other errors without a response, provide the original message
      console.log('[API] Unknown error without response:', error.message);
    }
    
    if (error.response?.status === 401) {
      // Token expired, clear storage
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      // Emit session expired event so AuthContext can handle redirect
      authEvents.emit(AUTH_SESSION_EXPIRED);
    }
    return Promise.reject(error);
  }
);

export default api;

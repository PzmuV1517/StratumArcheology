import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config/config';

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
 */
const api: AxiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 10000,
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
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      axiosConfig.headers = axiosConfig.headers || {};
      axiosConfig.headers.Authorization = `Bearer ${token}`;
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

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, clear storage
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
    }
    return Promise.reject(error);
  }
);

export default api;

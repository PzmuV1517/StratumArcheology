/**
 * STRATUM Network Status Service
 * 
 * Monitors network connectivity and provides:
 * - Online/offline detection
 * - Network quality estimation
 * - Automatic sync trigger on reconnection
 * 
 * Cross-platform: Uses NetInfo on native, navigator.onLine on web
 */

import { Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Network status types
export type NetworkStatus = 'online' | 'offline' | 'unknown';

export interface NetworkState {
  status: NetworkStatus;
  isConnected: boolean;
  type: string | null; // 'wifi', 'cellular', 'ethernet', etc.
  isInternetReachable: boolean | null;
  lastChecked: Date;
}

// Callbacks for network status updates
type NetworkStatusCallback = (state: NetworkState) => void;
const statusCallbacks: NetworkStatusCallback[] = [];

// Current network state
let currentState: NetworkState = {
  status: 'unknown',
  isConnected: false,
  type: null,
  isInternetReachable: null,
  lastChecked: new Date(),
};

// NetInfo reference (lazy loaded on native)
let NetInfo: any = null;
let unsubscribeNetInfo: (() => void) | null = null;

/**
 * Initialize the network status service
 * Call this when the app starts
 */
export async function initNetworkService(): Promise<void> {
  if (Platform.OS === 'web') {
    initWebNetworkService();
  } else {
    await initNativeNetworkService();
  }
  
  // Also listen for app state changes to refresh on resume
  AppState.addEventListener('change', handleAppStateChange);
  
  console.log('[NetworkService] Initialized');
}

/**
 * Initialize web-based network monitoring
 */
function initWebNetworkService(): void {
  // Use navigator.onLine for basic detection
  const updateWebStatus = () => {
    const isOnline = navigator.onLine;
    updateNetworkState({
      status: isOnline ? 'online' : 'offline',
      isConnected: isOnline,
      type: 'unknown',
      isInternetReachable: isOnline,
      lastChecked: new Date(),
    });
  };

  // Set initial state
  updateWebStatus();

  // Listen for online/offline events
  window.addEventListener('online', () => {
    console.log('[NetworkService] Browser online event');
    updateWebStatus();
    // Trigger sync on reconnect
    triggerReconnectSync();
  });

  window.addEventListener('offline', () => {
    console.log('[NetworkService] Browser offline event');
    updateWebStatus();
  });
}

/**
 * Initialize native network monitoring using NetInfo
 */
async function initNativeNetworkService(): Promise<void> {
  try {
    NetInfo = require('@react-native-community/netinfo').default;
    
    // Get initial state
    const state = await NetInfo.fetch();
    handleNetInfoChange(state);
    
    // Subscribe to changes
    unsubscribeNetInfo = NetInfo.addEventListener(handleNetInfoChange);
  } catch (error) {
    console.warn('[NetworkService] NetInfo not available, using fallback');
    // Fallback: assume online
    updateNetworkState({
      status: 'online',
      isConnected: true,
      type: 'unknown',
      isInternetReachable: true,
      lastChecked: new Date(),
    });
  }
}

/**
 * Handle NetInfo state changes (native)
 */
function handleNetInfoChange(state: any): void {
  const wasOffline = !currentState.isConnected;
  
  updateNetworkState({
    status: state.isConnected ? 'online' : 'offline',
    isConnected: state.isConnected || false,
    type: state.type || null,
    isInternetReachable: state.isInternetReachable,
    lastChecked: new Date(),
  });

  // Trigger sync if we just came back online
  if (wasOffline && state.isConnected) {
    console.log('[NetworkService] Connection restored');
    triggerReconnectSync();
  }
}

/**
 * Handle app state changes (foreground/background)
 */
function handleAppStateChange(nextAppState: AppStateStatus): void {
  if (nextAppState === 'active') {
    // App came to foreground - refresh network status
    refreshNetworkStatus();
  }
}

/**
 * Trigger sync when reconnecting
 */
async function triggerReconnectSync(): Promise<void> {
  try {
    // Dynamically import to avoid circular dependency
    const { processQueue } = await import('./syncService');
    console.log('[NetworkService] Triggering sync on reconnect');
    processQueue();
  } catch (error) {
    console.error('[NetworkService] Failed to trigger sync:', error);
  }
}

/**
 * Update network state and notify subscribers
 */
function updateNetworkState(newState: NetworkState): void {
  const previousStatus = currentState.status;
  currentState = newState;
  
  // Log status changes
  if (previousStatus !== newState.status) {
    console.log(`[NetworkService] Status changed: ${previousStatus} -> ${newState.status}`);
  }
  
  // Notify all subscribers
  statusCallbacks.forEach((callback) => callback(currentState));
  
  // Persist last known state
  AsyncStorage.setItem('@stratum_network_state', JSON.stringify(currentState)).catch(() => {});
}

/**
 * Manually refresh network status
 */
export async function refreshNetworkStatus(): Promise<NetworkState> {
  if (Platform.OS === 'web') {
    updateNetworkState({
      ...currentState,
      status: navigator.onLine ? 'online' : 'offline',
      isConnected: navigator.onLine,
      lastChecked: new Date(),
    });
  } else if (NetInfo) {
    const state = await NetInfo.fetch();
    handleNetInfoChange(state);
  }
  
  return currentState;
}

/**
 * Subscribe to network status updates
 */
export function subscribeNetworkStatus(callback: NetworkStatusCallback): () => void {
  statusCallbacks.push(callback);
  // Immediately call with current state
  callback(currentState);
  // Return unsubscribe function
  return () => {
    const index = statusCallbacks.indexOf(callback);
    if (index >= 0) statusCallbacks.splice(index, 1);
  };
}

/**
 * Get current network state
 */
export function getNetworkState(): NetworkState {
  return { ...currentState };
}

/**
 * Check if currently online
 */
export function isOnline(): boolean {
  return currentState.isConnected;
}

/**
 * 
 * Check if currently connected to backend (in case backend is down but network is up)
 */

export function isConnectedToBackend(): boolean {
  return currentState.isConnected && currentState.isInternetReachable === true
}

/**
 * Check if currently offline
 */
export function isOffline(): boolean {
  return !currentState.isConnected;
}

/**
 * Clean up network service
 */
export function cleanupNetworkService(): void {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
}

/**
 * Perform a network request with offline queue fallback
 * 
 * If offline, queues the request for later.
 * If online, executes immediately.
 */
export async function executeWithOfflineFallback<T>(
  requestFn: () => Promise<T>,
  queueData: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    data?: any;
  }
): Promise<T | null> {
  if (isOnline()) {
    try {
      return await requestFn();
    } catch (error: any) {
      // If network error, queue for later
      if (!error.response) {
        console.log('[NetworkService] Request failed, queueing for later');
        const { queueRequest } = await import('../db');
        await queueRequest({
          method: queueData.method,
          url: queueData.url,
          data: queueData.data ? JSON.stringify(queueData.data) : null,
          headers: JSON.stringify({ 'Content-Type': 'application/json' }),
        });
        return null;
      }
      throw error;
    }
  } else {
    // Offline - queue the request
    console.log('[NetworkService] Offline, queueing request');
    const { queueRequest } = await import('../db');
    await queueRequest({
      method: queueData.method,
      url: queueData.url,
      data: queueData.data ? JSON.stringify(queueData.data) : null,
      headers: JSON.stringify({ 'Content-Type': 'application/json' }),
    });
    return null;
  }
}

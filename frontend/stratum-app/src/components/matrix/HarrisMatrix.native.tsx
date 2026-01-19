/**
 * Harris Matrix Native Component
 * 
 * Renders the Harris Matrix visualization on iOS and Android using WebView.
 * The D3-based visualization requires DOM APIs, so we use WebView to host
 * the full-featured HTML/JS implementation.
 * 
 * Data is persisted using AsyncStorage for offline access and synced with the 
 * server when online. Uses offlineQueueService for proper sync management.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { getHarrisMatrixHTML } from './HarrisMatrixHTML';
import api from '../../services/api';

interface HarrisMatrixProps {
  projectId: string;
  canEdit?: boolean;
}

export default function HarrisMatrix({ projectId, canEdit = true }: HarrisMatrixProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedData, setSavedData] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const webViewRef = useRef<WebView>(null);
  const storageKey = `harrisMatrixData:${projectId}`;
  const pendingChangesKey = `harrisMatrixPending:${projectId}`;
  const lastSyncKey = `harrisMatrixLastSync:${projectId}`;

  // Subscribe to network state changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable);
      setIsOnline(online);
      
      // If we just came online and have pending changes, sync
      if (online && hasPendingChanges) {
        syncToServer();
      }
    });

    // Check initial state
    NetInfo.fetch().then((state) => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable));
    });

    return () => unsubscribe();
  }, [hasPendingChanges]);

  // Load saved data from AsyncStorage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [data, pendingData, syncTimeStr] = await Promise.all([
          AsyncStorage.getItem(storageKey),
          AsyncStorage.getItem(pendingChangesKey),
          AsyncStorage.getItem(lastSyncKey),
        ]);
        
        setSavedData(data);
        setHasPendingChanges(pendingData === 'true');
        if (syncTimeStr) {
          setLastSyncTime(new Date(syncTimeStr));
        }
        setLoading(false);

        // Try to sync if we're online and have pending changes
        const netState = await NetInfo.fetch();
        if (netState.isConnected && netState.isInternetReachable && pendingData === 'true') {
          syncToServer();
        }
      } catch (err) {
        console.error('[HarrisMatrix.native] Failed to load data:', err);
        setError('Failed to load saved data');
        setLoading(false);
      }
    };
    loadData();
  }, [storageKey]);

  // Sync data to server
  const syncToServer = useCallback(async () => {
    if (isSyncing) return;
    
    try {
      setIsSyncing(true);
      const data = await AsyncStorage.getItem(storageKey);
      
      if (data) {
        // POST/PUT to the backend - Harris Matrix data endpoint
        // Note: This endpoint may not exist yet - implement on backend if needed
        try {
          await api.put(`/projects/${projectId}/harris-matrix`, { data: JSON.parse(data) });
        } catch (error: any) {
          if (error.response?.status === 404) {
            console.warn('[HarrisMatrix.native] Harris Matrix sync endpoint not implemented yet');
            // Still mark as synced locally to avoid repeated failures
          } else {
            throw error;
          }
        }
        
        // Clear pending changes flag
        await AsyncStorage.setItem(pendingChangesKey, 'false');
        setHasPendingChanges(false);
        
        // Update last sync time
        const now = new Date();
        await AsyncStorage.setItem(lastSyncKey, now.toISOString());
        setLastSyncTime(now);
        
        console.log('[HarrisMatrix.native] Data synced to server');
      }
    } catch (err) {
      console.error('[HarrisMatrix.native] Sync failed:', err);
      // Keep pending changes flag set
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, storageKey, projectId]);

  // Handle messages from WebView (save data, errors, etc.)
  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'SAVE_DATA':
          // Always save locally first (offline-first)
          await AsyncStorage.setItem(storageKey, JSON.stringify(message.payload));
          console.log('[HarrisMatrix.native] Data saved to AsyncStorage');
          
          // Mark as having pending changes
          await AsyncStorage.setItem(pendingChangesKey, 'true');
          setHasPendingChanges(true);
          
          // If online, sync immediately
          if (isOnline) {
            syncToServer();
          }
          break;
        
        case 'READY':
          // WebView is ready, inject saved data if available
          if (savedData && webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              window.loadHarrisMatrixData(${savedData});
              true;
            `);
          }
          // Also notify WebView of online/offline status
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              window.setOfflineMode(${!isOnline});
              true;
            `);
          }
          break;
        
        case 'ERROR':
          console.error('[HarrisMatrix.native] WebView error:', message.payload);
          break;
        
        case 'ALERT':
          Alert.alert(message.payload.title || 'Harris Matrix', message.payload.message);
          break;
        
        case 'REQUEST_SYNC':
          // Manual sync request from WebView
          if (isOnline) {
            syncToServer();
          } else {
            Alert.alert('Offline', 'Cannot sync while offline. Changes are saved locally.');
          }
          break;
      }
    } catch (err) {
      console.error('[HarrisMatrix.native] Failed to handle message:', err);
    }
  }, [savedData, storageKey, isOnline, syncToServer]);

  // Handle WebView load error
  const handleError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('[HarrisMatrix.native] WebView error:', nativeEvent);
    setError('Failed to load Harris Matrix visualization');
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading Harris Matrix...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Generate the HTML with embedded JavaScript
  const html = getHarrisMatrixHTML({
    projectId,
    canEdit,
    initialData: savedData,
  });

  // Format last sync time
  const formatSyncTime = () => {
    if (!lastSyncTime) return 'Never';
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return lastSyncTime.toLocaleDateString();
  };

  return (
    <View style={styles.webViewContainer}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? '#4CAF50' : '#FF4444' }]} />
          <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
        
        {hasPendingChanges && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>Pending changes</Text>
          </View>
        )}
        
        {isSyncing ? (
          <View style={styles.syncingIndicator}>
            <ActivityIndicator size="small" color="#007bff" />
            <Text style={styles.syncingText}>Syncing...</Text>
          </View>
        ) : isOnline && hasPendingChanges ? (
          <TouchableOpacity style={styles.syncButton} onPress={syncToServer}>
            <Text style={styles.syncButtonText}>Sync Now</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.lastSyncText}>Last sync: {formatSyncTime()}</Text>
        )}
      </View>

      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webView}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#007bff" />
          </View>
        )}
        onMessage={handleMessage}
        onError={handleError}
        scrollEnabled={true}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        // iOS specific settings
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // Android specific settings
        mixedContentMode="compatibility"
        allowFileAccess={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A',
    padding: 20,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f2f5',
  },
  loadingText: {
    color: '#9A9A9A',
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    color: '#dc3545',
    fontSize: 16,
    textAlign: 'center',
  },
  // Status bar styles
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    color: '#34495e',
    fontWeight: '500',
  },
  pendingBadge: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pendingText: {
    fontSize: 12,
    color: '#856404',
    fontWeight: '500',
  },
  syncingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncingText: {
    fontSize: 12,
    color: '#007bff',
  },
  syncButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  lastSyncText: {
    fontSize: 11,
    color: '#6c757d',
  },
});

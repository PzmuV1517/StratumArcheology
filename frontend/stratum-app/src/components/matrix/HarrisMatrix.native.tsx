/**
 * Harris Matrix Native Component
 * 
 * Renders the Harris Matrix visualization on iOS and Android using WebView.
 * The D3-based visualization requires DOM APIs, so we use WebView to host
 * the full-featured HTML/JS implementation.
 * 
 * Data is persisted using AsyncStorage and synced with the WebView via postMessage.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { getHarrisMatrixHTML } from './HarrisMatrixHTML';

interface HarrisMatrixProps {
  projectId: string;
  canEdit?: boolean;
}

export default function HarrisMatrix({ projectId, canEdit = true }: HarrisMatrixProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedData, setSavedData] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const storageKey = `harrisMatrixData:${projectId}`;

  // Load saved data from AsyncStorage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await AsyncStorage.getItem(storageKey);
        setSavedData(data);
        setLoading(false);
      } catch (err) {
        console.error('[HarrisMatrix.native] Failed to load data:', err);
        setError('Failed to load saved data');
        setLoading(false);
      }
    };
    loadData();
  }, [storageKey]);

  // Handle messages from WebView (save data, errors, etc.)
  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'SAVE_DATA':
          await AsyncStorage.setItem(storageKey, JSON.stringify(message.payload));
          console.log('[HarrisMatrix.native] Data saved to AsyncStorage');
          break;
        
        case 'READY':
          // WebView is ready, inject saved data if available
          if (savedData && webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              window.loadHarrisMatrixData(${savedData});
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
      }
    } catch (err) {
      console.error('[HarrisMatrix.native] Failed to handle message:', err);
    }
  }, [savedData, storageKey]);

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

  return (
    <View style={styles.webViewContainer}>
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
});

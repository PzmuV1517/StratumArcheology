import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OfflineBannerProps {
  /** Optional custom message */
  message?: string;
}

/**
 * OfflineBanner - Shows a banner when the device is offline
 * 
 * Animates in/out smoothly when network status changes.
 * Shows at the top of the screen with safe area awareness.
 */
export default function OfflineBanner({ message = 'No Internet Connection' }: OfflineBannerProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const slideAnim = useState(new Animated.Value(-60))[0];
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    // Check network status
    const checkNetwork = async () => {
      if (Platform.OS === 'web') {
        // Web: use navigator.onLine
        setIsOffline(!navigator.onLine);
        
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        cleanup = () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };
      } else {
        // Native: use @react-native-community/netinfo
        try {
          const NetInfo = await import('@react-native-community/netinfo');
          
          // Get initial state
          const state = await NetInfo.default.fetch();
          setIsOffline(!state.isConnected);
          
          // Subscribe to changes
          const unsubscribe = NetInfo.default.addEventListener(state => {
            setIsOffline(!state.isConnected);
          });
          
          cleanup = unsubscribe;
        } catch (error) {
          console.warn('[OfflineBanner] NetInfo not available:', error);
        }
      }
    };

    checkNetwork();
    
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  // Animate banner in/out
  useEffect(() => {
    if (isOffline) {
      setShowBanner(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -60,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowBanner(false);
      });
    }
  }, [isOffline, slideAnim]);

  if (!showBanner) return null;

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          paddingTop: insets.top + 4,
          transform: [{ translateY: slideAnim }] 
        }
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>📡</Text>
        <Text style={styles.text}>{message}</Text>
      </View>
      <Text style={styles.subtext}>Changes will sync when back online</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#B71C1C',
    paddingBottom: 10,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  subtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OfflineBannerProps {
  /** Optional custom message */
  message?: string;
}

/**
 * OfflineBanner - Shows a small icon when the device is offline
 *
 * Displays a subtle cloud-off icon in the top-right corner.
 * Tap to see more details about offline status.
 */
export default function OfflineBanner({ message = 'No Internet Connection' }: OfflineBannerProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
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
          const unsubscribe = NetInfo.default.addEventListener((state) => {
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

  // Animate indicator in/out
  useEffect(() => {
    if (isOffline) {
      setShowIndicator(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowIndicator(false);
      });
    }
  }, [isOffline, fadeAnim]);

  if (!showIndicator) return null;

  return (
    <>
      {/* Small icon indicator in top-right */}
      <Animated.View
        style={[
          styles.indicator,
          {
            top: insets.top + 8,
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setShowModal(true)}
          accessibilityLabel="Offline indicator. Tap for details."
          accessibilityRole="button"
        >
          <Text style={styles.offlineIcon}>☁️</Text>
          <View style={styles.slashOverlay}>
            <Text style={styles.slash}>╲</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Details modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <View style={[styles.modalContent, { marginTop: insets.top + 60 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalIcon}>📡</Text>
              <Text style={styles.modalTitle}>{message}</Text>
            </View>
            <Text style={styles.modalText}>
              You're currently offline. Any changes you make will be saved locally and synced
              automatically when your connection is restored.
            </Text>
            <TouchableOpacity style={styles.dismissButton} onPress={() => setShowModal(false)}>
              <Text style={styles.dismissText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    right: 16,
    zIndex: 9999,
    elevation: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(183, 28, 28, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  offlineIcon: {
    fontSize: 18,
  },
  slashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slash: {
    fontSize: 28,
    color: '#B71C1C',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  modalText: {
    color: '#AAAAAA',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  dismissButton: {
    backgroundColor: '#B71C1C',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  dismissText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

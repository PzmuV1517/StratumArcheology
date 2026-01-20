import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * ConnectionStatusIndicator - Shows connection status as a small icon
 *
 * Displays a persistent indicator in the top-left corner:
 * - Green checkmark when connected to backend
 * - Red X when disconnected
 * Tap to see more details about connection status.
 * 
 * Only shown on mobile (iOS/Android) - not on web.
 */
export default function ConnectionStatusIndicator() {
  // Don't show on web - offline sync is mobile-only
  if (Platform.OS === 'web') {
    return null;
  }

  return <ConnectionStatusIndicatorInner />;
}

function ConnectionStatusIndicatorInner() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null); // null = checking
  const [isChecking, setIsChecking] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const insets = useSafeAreaInsets();

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      // First check device network connectivity
      if (Platform.OS === 'web') {
        if (!navigator.onLine) {
          setIsConnected(false);
          setLastChecked(new Date());
          setIsChecking(false);
          return;
        }
      } else {
        try {
          const NetInfo = await import('@react-native-community/netinfo');
          const state = await NetInfo.default.fetch();
          if (!state.isConnected) {
            setIsConnected(false);
            setLastChecked(new Date());
            setIsChecking(false);
            return;
          }
        } catch (e) {
          console.warn('[ConnectionStatus] NetInfo not available:', e);
        }
      }

      // Try to reach the backend
      const { default: api } = await import('../../services/api');
      const response = await api.get('/health');
      setIsConnected(response.status === 200);
    } catch (error) {
      setIsConnected(false);
    } finally {
      setLastChecked(new Date());
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkConnection();

    // Set up periodic checks every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    // Also listen for network changes on native
    let cleanup: (() => void) | undefined;

    const setupNetworkListener = async () => {
      if (Platform.OS === 'web') {
        const handleChange = () => checkConnection();
        window.addEventListener('online', handleChange);
        window.addEventListener('offline', handleChange);
        cleanup = () => {
          window.removeEventListener('online', handleChange);
          window.removeEventListener('offline', handleChange);
        };
      } else {
        try {
          const NetInfo = await import('@react-native-community/netinfo');
          const unsubscribe = NetInfo.default.addEventListener(() => {
            checkConnection();
          });
          cleanup = unsubscribe;
        } catch (e) {
          console.warn('[ConnectionStatus] Could not set up network listener:', e);
        }
      }
    };

    setupNetworkListener();

    return () => {
      clearInterval(interval);
      if (cleanup) cleanup();
    };
  }, [checkConnection]);

  const getStatusColor = () => {
    if (isChecking || isConnected === null) return '#666666'; // Gray while checking
    return isConnected ? '#22c55e' : '#ef4444'; // Green or Red
  };

  const getStatusIcon = () => {
    if (isChecking || isConnected === null) return '...';
    return isConnected ? '✓' : '✕';
  };

  const getStatusText = () => {
    if (isChecking) return 'Checking connection...';
    return isConnected ? 'Connected to STRATUM' : 'Not connected';
  };

  const getDetailText = () => {
    if (isChecking) return 'Verifying backend connection...';
    if (isConnected) {
      return 'Your device is connected to the STRATUM backend. All features are available.';
    }
    return 'Cannot reach the STRATUM backend. You can still work offline - your changes will sync when connection is restored.';
  };

  return (
    <>
      {/* Small icon indicator in top-left */}
      <View
        style={[
          styles.indicator,
          {
            top: insets.top + 8,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: getStatusColor() }]}
          onPress={() => setShowModal(true)}
          accessibilityLabel={`Connection status: ${getStatusText()}. Tap for details.`}
          accessibilityRole="button"
        >
          {isChecking ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
          )}
        </TouchableOpacity>
      </View>

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
              <View style={[styles.modalStatusDot, { backgroundColor: getStatusColor() }]}>
                {isChecking ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalStatusIcon}>{getStatusIcon()}</Text>
                )}
              </View>
              <Text style={styles.modalTitle}>{getStatusText()}</Text>
            </View>
            <Text style={styles.modalText}>{getDetailText()}</Text>
            {lastChecked && (
              <Text style={styles.lastCheckedText}>
                Last checked: {lastChecked.toLocaleTimeString()}
              </Text>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={() => {
                  checkConnection();
                }}
              >
                <Text style={styles.refreshText}>Refresh</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dismissButton} onPress={() => setShowModal(false)}>
                <Text style={styles.dismissText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    left: 16,
    zIndex: 9999,
    elevation: 10,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  statusIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
    width: '90%',
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
  modalStatusDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalStatusIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  modalText: {
    color: '#AAAAAA',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  lastCheckedText: {
    color: '#666666',
    fontSize: 12,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  refreshButton: {
    backgroundColor: '#333333',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  refreshText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    backgroundColor: '#C41E3A',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  dismissText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

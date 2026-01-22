import React, { useState, useEffect, useCallback, useRef } from 'react';
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

const MIN_CHECK_INTERVAL = 60000; // 60 seconds minimum between manual checks

/**
 * ConnectionStatusIndicator - DISABLED
 *
 * Previously showed connection status as a tiny dot in the bottom-right corner.
 * Removed per user request - the indicator was deemed unnecessary and distracting.
 *
 * The offline sync functionality still works in the background without any UI indicator.
 */
export default function ConnectionStatusIndicator() {
  // Disabled - no longer shows any indicator
  return null;
}

function ConnectionStatusIndicatorInner() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null); // null = checking
  const [isChecking, setIsChecking] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [canRefresh, setCanRefresh] = useState(true);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const lastManualCheckRef = useRef<number>(0);
  const insets = useSafeAreaInsets();

  const checkConnection = useCallback(async (isManual = false) => {
    // For manual checks, enforce cooldown
    if (isManual) {
      const now = Date.now();
      const timeSinceLastCheck = now - lastManualCheckRef.current;
      if (timeSinceLastCheck < MIN_CHECK_INTERVAL) {
        // Still in cooldown, don't check
        return;
      }
      lastManualCheckRef.current = now;
      setCanRefresh(false);
      setCooldownRemaining(60);
    }

    setIsChecking(true);
    try {
      // First check device network connectivity
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

      // Try to reach the backend
      const { default: api } = await import('../../services/api');
      const response = await api.get('/health');
      setIsConnected(response.status === 200);
    } catch {
      setIsConnected(false);
    } finally {
      setLastChecked(new Date());
      setIsChecking(false);
    }
  }, []);

  // Cooldown timer for manual refresh
  useEffect(() => {
    if (!canRefresh && cooldownRemaining > 0) {
      const timer = setInterval(() => {
        setCooldownRemaining((prev) => {
          if (prev <= 1) {
            setCanRefresh(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [canRefresh, cooldownRemaining]);

  useEffect(() => {
    // Initial check
    checkConnection();

    // Set up periodic checks every 60 seconds (automatic, not manual)
    const interval = setInterval(() => checkConnection(false), 60000);

    // Also listen for network changes on native
    let cleanup: (() => void) | undefined;

    const setupNetworkListener = async () => {
      try {
        const NetInfo = await import('@react-native-community/netinfo');
        const unsubscribe = NetInfo.default.addEventListener(() => {
          checkConnection(false);
        });
        cleanup = unsubscribe;
      } catch (e) {
        console.warn('[ConnectionStatus] Could not set up network listener:', e);
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
    if (isChecking || isConnected === null) return '•';
    return isConnected ? '✓' : '✕';
  };

  const getStatusText = () => {
    if (isChecking) return 'Checking...';
    return isConnected ? 'Connected' : 'Offline';
  };

  const getDetailText = () => {
    if (isChecking) return 'Verifying backend connection...';
    if (isConnected) {
      return 'Your device is connected to STRATUM. All features are available.';
    }
    return 'Cannot reach the backend. You can still work offline — changes will sync when connection is restored.';
  };

  const handleRefresh = () => {
    if (canRefresh) {
      checkConnection(true);
    }
  };

  return (
    <>
      {/* Tiny dot indicator in bottom-right */}
      <View
        style={[
          styles.indicator,
          {
            bottom: insets.bottom + 12,
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
            <ActivityIndicator size="small" color="#FFFFFF" style={{ transform: [{ scale: 0.6 }] }} />
          ) : (
            <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Centered details modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
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
                style={[styles.refreshButton, !canRefresh && styles.refreshButtonDisabled]}
                onPress={handleRefresh}
                disabled={!canRefresh}
              >
                <Text style={[styles.refreshText, !canRefresh && styles.refreshTextDisabled]}>
                  {canRefresh ? 'Refresh' : `Wait ${cooldownRemaining}s`}
                </Text>
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
    right: 12,
    zIndex: 9999,
    elevation: 10,
  },
  iconButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    opacity: 0.8,
  },
  statusIcon: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
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
  refreshButtonDisabled: {
    backgroundColor: '#222222',
  },
  refreshText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshTextDisabled: {
    color: '#666666',
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

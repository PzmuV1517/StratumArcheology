/**
 * Network Status Indicator Component
 * 
 * Displays current network status with visual feedback:
 * - Online: Green dot
 * - Offline: Red dot with message
 * - Syncing: Animated indicator
 * 
 * Cross-platform: Works on both web and native
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import {
  subscribeNetworkStatus,
  NetworkState,
  isOnline,
} from '../../services/networkService';
import {
  subscribeSyncStatus,
  SyncStatus,
  forceSync,
} from '../../services/syncService';

interface NetworkStatusIndicatorProps {
  /** Show full status bar or just the dot */
  compact?: boolean;
  /** Custom style */
  style?: any;
}

export function NetworkStatusIndicator({
  compact = false,
  style,
}: NetworkStatusIndicatorProps) {
  const [networkState, setNetworkState] = useState<NetworkState | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Subscribe to network and sync status
  useEffect(() => {
    const unsubNetwork = subscribeNetworkStatus(setNetworkState);
    const unsubSync = subscribeSyncStatus(setSyncStatus);

    return () => {
      unsubNetwork();
      unsubSync();
    };
  }, []);

  // Pulse animation when syncing
  useEffect(() => {
    if (syncStatus?.isSyncing) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [syncStatus?.isSyncing]);

  // Don't render until we have network state
  if (!networkState) return null;

  const isConnected = networkState.isConnected;
  const isSyncing = syncStatus?.isSyncing || false;
  const pendingCount = syncStatus?.pendingCount || 0;
  const hasErrors = (syncStatus?.failedCount || 0) > 0;

  // Determine status color
  const getStatusColor = () => {
    if (!isConnected) return '#ef4444'; // Red - offline
    if (hasErrors) return '#f59e0b'; // Amber - errors
    if (isSyncing) return '#3b82f6'; // Blue - syncing
    if (pendingCount > 0) return '#f59e0b'; // Amber - pending
    return '#22c55e'; // Green - all good
  };

  // Determine status text
  const getStatusText = () => {
    if (!isConnected) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (hasErrors) return `${syncStatus?.failedCount} failed`;
    if (pendingCount > 0) return `${pendingCount} pending`;
    return 'Online';
  };

  // Handle manual sync trigger
  const handlePress = async () => {
    if (isConnected && !isSyncing) {
      await forceSync();
    }
  };

  if (compact) {
    // Just show the status dot
    return (
      <TouchableOpacity
        onPress={handlePress}
        style={[styles.compactContainer, style]}
        accessibilityLabel={`Network status: ${getStatusText()}`}
        accessibilityRole="button"
      >
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: getStatusColor(), opacity: pulseAnim },
          ]}
        />
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {pendingCount > 99 ? '99+' : pendingCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Full status bar (shown when offline or syncing)
  if (!isConnected || isSyncing || hasErrors) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        style={[
          styles.fullContainer,
          { backgroundColor: getStatusColor() },
          style,
        ]}
        accessibilityLabel={`Network status: ${getStatusText()}`}
        accessibilityRole="button"
      >
        <Animated.View style={[styles.dotSmall, { opacity: pulseAnim }]} />
        <Text style={styles.statusText}>{getStatusText()}</Text>
        {isConnected && !isSyncing && (
          <Text style={styles.tapText}>Tap to sync</Text>
        )}
      </TouchableOpacity>
    );
  }

  // Hidden when all is good (or show compact dot)
  return null;
}

/**
 * Offline Banner Component
 * 
 * Shows a prominent banner when offline
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    return subscribeNetworkStatus((state) => {
      setIsOffline(!state.isConnected);
    });
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.offlineBanner}>
      <View style={styles.offlineDot} />
      <Text style={styles.offlineText}>
        You're offline. Changes will sync when connection is restored.
      </Text>
    </View>
  );
}

/**
 * Sync Status Badge Component
 * 
 * Shows pending sync count as a badge
 */
export function SyncBadge({ style }: { style?: any }) {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    return subscribeSyncStatus((status) => {
      setPendingCount(status.pendingCount + status.failedCount);
    });
  }, []);

  if (pendingCount === 0) return null;

  return (
    <View style={[styles.syncBadge, style]}>
      <Text style={styles.syncBadgeText}>
        {pendingCount > 99 ? '99+' : pendingCount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    position: 'relative',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  dotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 8,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  fullContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    margin: 8,
  },
  statusText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  tapText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginLeft: 8,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 10,
  },
  offlineText: {
    color: '#9ca3af',
    fontSize: 13,
    flex: 1,
  },
  syncBadge: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  syncBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
});

export default NetworkStatusIndicator;

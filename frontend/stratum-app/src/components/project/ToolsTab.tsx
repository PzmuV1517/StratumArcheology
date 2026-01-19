import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Alert,
  Animated,
  Easing,
} from 'react-native';

// Types for expo-location (dynamically imported)
type LocationSubscription = { remove: () => void };
type HeadingObject = { trueHeading: number; magHeading: number };
type LocationObject = {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
};

interface ToolsTabProps {
  projectId: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export default function ToolsTab({ projectId: _projectId }: ToolsTabProps) {
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [acquiringGPS, setAcquiringGPS] = useState(false); // True when getting fresh GPS fix
  const [watchingLocation, setWatchingLocation] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [LocationModule, setLocationModule] = useState<any>(null);
  
  const compassRotation = useRef(new Animated.Value(0)).current;
  const locationSubscription = useRef<LocationSubscription | null>(null);
  const headingSubscription = useRef<{ remove: () => void } | null>(null);

  // Load expo-location dynamically on native only
  useEffect(() => {
    if (Platform.OS !== 'web') {
      import('expo-location')
        .then((module) => {
          setLocationModule(module);
        })
        .catch((err) => {
          console.warn('expo-location not available:', err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (LocationModule && Platform.OS !== 'web') {
      requestPermissions();
    }
    
    return () => {
      // Cleanup subscriptions
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (headingSubscription.current) {
        headingSubscription.current.remove();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LocationModule]);

  useEffect(() => {
    // Animate compass rotation
    Animated.timing(compassRotation, {
      toValue: -heading,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [heading, compassRotation]);

  const requestPermissions = async () => {
    if (!LocationModule) return;
    
    try {
      const { status: foregroundStatus } = await LocationModule.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        setLocationPermission(false);
        setLoading(false);
        return;
      }
      
      setLocationPermission(true);
      setAcquiringGPS(true);
      
      // Get fresh location with high accuracy (not cached)
      // Using maximumAge: 0 forces a fresh GPS fix instead of cached data
      const currentLocation: LocationObject = await LocationModule.getCurrentPositionAsync({
        accuracy: LocationModule.Accuracy.BestForNavigation,
        maximumAge: 0, // Don't use cached location
        timeout: 15000, // 15 second timeout
      });
      
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        altitude: currentLocation.coords.altitude,
        accuracy: currentLocation.coords.accuracy,
        heading: currentLocation.coords.heading,
        speed: currentLocation.coords.speed,
        timestamp: currentLocation.timestamp,
      });
      
      setAcquiringGPS(false);
      
      // Start heading updates for compass (mobile only)
      if (Platform.OS !== 'web') {
        const headingSub = await LocationModule.watchHeadingAsync((headingData: HeadingObject) => {
          setHeading(headingData.trueHeading || headingData.magHeading || 0);
        });
        headingSubscription.current = headingSub;
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error getting location:', error);
      setAcquiringGPS(false);
      setLocationPermission(false);
      setLoading(false);
    }
  };

  const startWatching = async () => {
    if (!locationPermission || !LocationModule) return;
    
    try {
      setWatchingLocation(true);
      
      locationSubscription.current = await LocationModule.watchPositionAsync(
        {
          accuracy: LocationModule.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (newLocation: LocationObject) => {
          setLocation({
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            altitude: newLocation.coords.altitude,
            accuracy: newLocation.coords.accuracy,
            heading: newLocation.coords.heading,
            speed: newLocation.coords.speed,
            timestamp: newLocation.timestamp,
          });
        }
      );
    } catch (error) {
      console.error('Error watching location:', error);
      setWatchingLocation(false);
    }
  };

  const stopWatching = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setWatchingLocation(false);
  };

  const refreshLocation = async () => {
    if (!LocationModule) return;
    
    try {
      setAcquiringGPS(true);
      const currentLocation: LocationObject = await LocationModule.getCurrentPositionAsync({
        accuracy: LocationModule.Accuracy.BestForNavigation,
        maximumAge: 0, // Force fresh GPS fix
        timeout: 15000,
      });
      
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        altitude: currentLocation.coords.altitude,
        accuracy: currentLocation.coords.accuracy,
        heading: currentLocation.coords.heading,
        speed: currentLocation.coords.speed,
        timestamp: currentLocation.timestamp,
      });
    } catch (error) {
      console.error('Error refreshing location:', error);
      Alert.alert('Error', 'Failed to refresh location. Make sure GPS is enabled.');
    } finally {
      setAcquiringGPS(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      // Use dynamic import for expo-clipboard
      const Clipboard = await import('expo-clipboard').catch(() => null);
      if (Clipboard) {
        await Clipboard.setStringAsync(text);
        setCopyFeedback(label);
        setTimeout(() => setCopyFeedback(null), 2000);
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const formatCoordinate = (value: number, isLatitude: boolean): string => {
    const direction = isLatitude
      ? value >= 0 ? 'N' : 'S'
      : value >= 0 ? 'E' : 'W';
    const absValue = Math.abs(value);
    const degrees = Math.floor(absValue);
    const minutes = Math.floor((absValue - degrees) * 60);
    const seconds = ((absValue - degrees - minutes / 60) * 3600).toFixed(2);
    
    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
  };

  const getCardinalDirection = (degrees: number): string => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  // Web-only message
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <Text style={styles.webIcon}>📱</Text>
        <Text style={styles.webTitle}>Mobile Only Feature</Text>
        <Text style={styles.webSubtitle}>
          The Tools tab with compass and GPS is only available on mobile devices.
        </Text>
        <Text style={styles.webHint}>
          Open the app on your phone or tablet to access these features.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF2A2A" />
        <Text style={styles.loadingText}>Initializing GPS...</Text>
      </View>
    );
  }

  if (!locationPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionIcon}>📍</Text>
        <Text style={styles.permissionTitle}>Location Access Required</Text>
        <Text style={styles.permissionText}>
          Enable location services to use the compass and GPS coordinate locator.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const compassStyle = {
    transform: [
      { rotate: compassRotation.interpolate({
          inputRange: [-360, 360],
          outputRange: ['-360deg', '360deg'],
        })
      }
    ],
  };

  return (
    <View style={styles.container}>
      {/* Compass Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Compass</Text>
        <View style={styles.compassContainer}>
          <Animated.View style={[styles.compass, compassStyle]}>
            {/* Compass Rose */}
            <View style={styles.compassRose}>
              <Text style={[styles.compassDirection, styles.compassN]}>N</Text>
              <Text style={[styles.compassDirection, styles.compassE]}>E</Text>
              <Text style={[styles.compassDirection, styles.compassS]}>S</Text>
              <Text style={[styles.compassDirection, styles.compassW]}>W</Text>
            </View>
            <View style={styles.compassNeedle}>
              <View style={styles.needleRed} />
              <View style={styles.needleWhite} />
            </View>
          </Animated.View>
          <View style={styles.compassCenter} />
        </View>
        <View style={styles.headingInfo}>
          <Text style={styles.headingValue}>{Math.round(heading)}°</Text>
          <Text style={styles.headingDirection}>{getCardinalDirection(heading)}</Text>
        </View>
      </View>

      {/* GPS Coordinates Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>GPS Coordinates</Text>
          <TouchableOpacity
            style={[styles.watchButton, watchingLocation && styles.watchButtonActive]}
            onPress={watchingLocation ? stopWatching : startWatching}
          >
            <Text style={[styles.watchButtonText, watchingLocation && styles.watchButtonTextActive]}>
              {watchingLocation ? '⏸ Pause' : '▶ Live'}
            </Text>
          </TouchableOpacity>
        </View>

        {location && (
          <View style={styles.coordinatesContainer}>
            {/* Latitude */}
            <TouchableOpacity
              style={styles.coordinateRow}
              onPress={() => copyToClipboard(location.latitude.toFixed(8), 'Latitude')}
            >
              <View style={styles.coordinateLabel}>
                <Text style={styles.coordinateLabelText}>Latitude</Text>
                {copyFeedback === 'Latitude' && (
                  <Text style={styles.copyFeedback}>Copied!</Text>
                )}
              </View>
              <Text style={styles.coordinateValue}>
                {formatCoordinate(location.latitude, true)}
              </Text>
              <Text style={styles.coordinateDecimal}>
                {location.latitude.toFixed(8)}
              </Text>
            </TouchableOpacity>

            {/* Longitude */}
            <TouchableOpacity
              style={styles.coordinateRow}
              onPress={() => copyToClipboard(location.longitude.toFixed(8), 'Longitude')}
            >
              <View style={styles.coordinateLabel}>
                <Text style={styles.coordinateLabelText}>Longitude</Text>
                {copyFeedback === 'Longitude' && (
                  <Text style={styles.copyFeedback}>Copied!</Text>
                )}
              </View>
              <Text style={styles.coordinateValue}>
                {formatCoordinate(location.longitude, false)}
              </Text>
              <Text style={styles.coordinateDecimal}>
                {location.longitude.toFixed(8)}
              </Text>
            </TouchableOpacity>

            {/* Altitude */}
            {location.altitude !== null && (
              <TouchableOpacity
                style={styles.coordinateRow}
                onPress={() => copyToClipboard(location.altitude!.toFixed(2), 'Altitude')}
              >
                <View style={styles.coordinateLabel}>
                  <Text style={styles.coordinateLabelText}>Altitude</Text>
                  {copyFeedback === 'Altitude' && (
                    <Text style={styles.copyFeedback}>Copied!</Text>
                  )}
                </View>
                <Text style={styles.coordinateValue}>
                  {location.altitude.toFixed(2)} m
                </Text>
              </TouchableOpacity>
            )}

            {/* Accuracy */}
            {location.accuracy !== null && (
              <View style={styles.coordinateRow}>
                <Text style={styles.coordinateLabelText}>Accuracy</Text>
                <Text style={[
                  styles.coordinateValue,
                  location.accuracy < 10 ? styles.accuracyGood : 
                  location.accuracy < 50 ? styles.accuracyModerate : 
                  styles.accuracyPoor
                ]}>
                  ±{location.accuracy.toFixed(1)} m
                </Text>
              </View>
            )}

            {/* Copy All Button */}
            <TouchableOpacity
              style={styles.copyAllButton}
              onPress={() => {
                const coords = `${location.latitude.toFixed(8)}, ${location.longitude.toFixed(8)}`;
                copyToClipboard(coords, 'Coordinates');
              }}
            >
              <Text style={styles.copyAllButtonText}>
                {copyFeedback === 'Coordinates' ? '✓ Copied!' : '📋 Copy Coordinates'}
              </Text>
            </TouchableOpacity>
            
            {/* Last Updated Timestamp */}
            <Text style={styles.timestampText}>
              Last updated: {new Date(location.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        )}
        
        {/* Acquiring GPS indicator */}
        {acquiringGPS && (
          <View style={styles.acquiringContainer}>
            <ActivityIndicator size="small" color="#FF2A2A" />
            <Text style={styles.acquiringText}>Acquiring GPS signal...</Text>
          </View>
        )}

        {/* Refresh Button */}
        {!watchingLocation && (
          <TouchableOpacity 
            style={[styles.refreshButton, acquiringGPS && styles.refreshButtonDisabled]} 
            onPress={refreshLocation}
            disabled={acquiringGPS}
          >
            <Text style={styles.refreshButtonText}>
              {acquiringGPS ? '📡 Acquiring...' : '🔄 Refresh Location'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },
  loadingText: {
    marginTop: 16,
    color: '#9A9A9A',
    fontSize: 14,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 32,
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F5F5F5',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: '#9A9A9A',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: '#FF2A2A',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#F5F5F5',
    fontSize: 16,
    fontWeight: '600',
  },
  webContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 32,
  },
  webIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  webTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F5F5F5',
    marginBottom: 12,
  },
  webSubtitle: {
    fontSize: 14,
    color: '#9A9A9A',
    textAlign: 'center',
    marginBottom: 8,
  },
  webHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F5F5F5',
    marginBottom: 16,
  },
  compassContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    position: 'relative',
  },
  compass: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#0E0E0E',
    borderWidth: 3,
    borderColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  compassRose: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  compassDirection: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: '700',
    color: '#9A9A9A',
  },
  compassN: {
    top: 12,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -6,
    color: '#FF2A2A',
  },
  compassE: {
    right: 12,
    top: '50%',
    marginTop: -10,
  },
  compassS: {
    bottom: 12,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -5,
  },
  compassW: {
    left: 12,
    top: '50%',
    marginTop: -10,
  },
  compassNeedle: {
    width: 6,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  needleRed: {
    width: 6,
    height: 60,
    backgroundColor: '#FF2A2A',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  needleWhite: {
    width: 6,
    height: 60,
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  compassCenter: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    borderWidth: 2,
    borderColor: '#FF2A2A',
  },
  headingInfo: {
    alignItems: 'center',
    marginTop: 16,
  },
  headingValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#F5F5F5',
  },
  headingDirection: {
    fontSize: 18,
    color: '#FF2A2A',
    fontWeight: '600',
    marginTop: 4,
  },
  watchButton: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  watchButtonActive: {
    backgroundColor: '#FF2A2A',
  },
  watchButtonText: {
    color: '#9A9A9A',
    fontSize: 13,
    fontWeight: '600',
  },
  watchButtonTextActive: {
    color: '#F5F5F5',
  },
  coordinatesContainer: {
    marginTop: 8,
  },
  coordinateRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  coordinateLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coordinateLabelText: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  copyFeedback: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 8,
    fontWeight: '600',
  },
  coordinateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5F5F5',
    marginTop: 4,
  },
  coordinateDecimal: {
    fontSize: 12,
    color: '#9A9A9A',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  accuracyGood: {
    color: '#4CAF50',
  },
  accuracyModerate: {
    color: '#FFC107',
  },
  accuracyPoor: {
    color: '#FF9800',
  },
  copyAllButton: {
    backgroundColor: '#2A2A2A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  copyAllButtonText: {
    color: '#F5F5F5',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshButton: {
    backgroundColor: '#FF2A2A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  refreshButtonDisabled: {
    backgroundColor: '#4A2020',
    opacity: 0.7,
  },
  refreshButtonText: {
    color: '#F5F5F5',
    fontSize: 14,
    fontWeight: '600',
  },
  timestampText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
  acquiringContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  acquiringText: {
    fontSize: 13,
    color: '#FF2A2A',
    fontWeight: '500',
  },
});

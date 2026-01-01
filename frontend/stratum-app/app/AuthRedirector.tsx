// app/AuthRedirector.tsx
import React, { useEffect, useState } from 'react';
import { useRouter, useSegments, usePathname } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useAuth } from '../src/contexts/AuthContext';

/**
 * AuthRedirector handles auth-based navigation:
 * - Mobile: Never shows landing page, redirects to login/tabs based on auth
 * - Web: Landing page allowed, auth check only for protected routes
 */
const AuthRedirector: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  // Wait for layout to mount before navigating
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Don't navigate until mounted and auth state is resolved
    if (!mounted || loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const isLandingPage = pathname === '/' || pathname === '';
    const isWeb = Platform.OS === 'web';

    if (isWeb) {
      // Web behavior: landing page allowed, protect other routes
      if (!user && inTabsGroup) {
        // Trying to access protected tabs without auth
        router.replace('/(auth)/login');
      } else if (user && inAuthGroup) {
        // Already authenticated, redirect from auth screens to tabs
        router.replace('/(tabs)');
      }
    } else {
      // Mobile behavior: never show landing page
      if (isLandingPage) {
        if (user) {
          router.replace('/(tabs)');
        } else {
          router.replace('/(auth)/login');
        }
      } else if (!user && inTabsGroup) {
        router.replace('/(auth)/login');
      } else if (user && inAuthGroup) {
        router.replace('/(tabs)');
      }
    }
  }, [mounted, loading, user, segments, pathname, router]);

  // Show loading while checking auth
  if (loading || (!mounted && Platform.OS !== 'web')) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF2A2A" />
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111111',
  },
});

export default AuthRedirector;
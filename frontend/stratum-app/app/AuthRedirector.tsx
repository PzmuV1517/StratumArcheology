/**
 * @file
 * Authentication redirect component.
 *
 * Automatically redirects users to the appropriate screen
 * based on their authentication status.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
// app/AuthRedirector.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSegments, usePathname } from "expo-router";
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

/**
 * AuthRedirector handles auth-based navigation:
 * - Mobile: Never shows landing page, redirects to login/tabs based on auth
 * - Web: Landing page allowed, auth check only for protected routes
 * - Handles session expiry by redirecting to login
 */
const AuthRedirector: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const { user, loading, sessionExpired, clearSessionExpired } = useAuth();
  const [mounted, setMounted] = useState(false);

  // Wait for layout to mount before navigating
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle session expiry - redirect to login
  useEffect(() => {
    if (sessionExpired && mounted) {
      console.log("[AuthRedirector] Session expired, redirecting to login");
      clearSessionExpired();
      router.replace("/(auth)/login");
    }
  }, [sessionExpired, mounted, clearSessionExpired, router]);

  useEffect(() => {
    // Don't navigate until mounted and auth state is resolved
    if (!mounted || loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inTabsGroup = segments[0] === "(tabs)";
    const isLandingPage = pathname === "/" || pathname === "";
    const isWeb = Platform.OS === "web";

    if (isWeb) {
      // Web behavior: landing page allowed, protect other routes
      if (!user && inTabsGroup) {
        // Trying to access protected tabs without auth
        router.replace("/(auth)/login");
      } else if (user && inAuthGroup) {
        // Already authenticated, redirect from auth screens to tabs
        router.replace("/(tabs)");
      }
    } else {
      // Mobile behavior: never show landing page
      if (isLandingPage) {
        if (user) {
          router.replace("/(tabs)");
        } else {
          router.replace("/(auth)/login");
        }
      } else if (!user && inTabsGroup) {
        router.replace("/(auth)/login");
      } else if (user && inAuthGroup) {
        router.replace("/(tabs)");
      }
    }
  }, [mounted, loading, user, segments, pathname, router]);

  // Show loading while checking auth
  if (loading || (!mounted && Platform.OS !== "web")) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF2A2A" />
      </View>
    );
  }

  return <>{children}</>;
};

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
  });

export default AuthRedirector;

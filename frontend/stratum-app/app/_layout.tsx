import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import UniversalNavbar from '../src/components/UniversalNavbar';

import { AuthProvider, useAuth } from '../src/contexts/AuthContext';

// Custom STRATUM Dark Theme
const StratumDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#FF2A2A',
    background: '#111111',
    card: '#1A1A1A',
    text: '#F5F5F5',
    border: '#2A2A2A',
    notification: '#FF2A2A',
  },
};

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

  const inAuthGroup = segments[0] === '(auth)';
  const atRoot = pathname === '/'; // '/' landing page

    if (!user && !inAuthGroup && !atRoot) {
      // If unauthenticated, allow the root landing page ('/') but
      // redirect any other non-auth route to the login screen.
      router.replace('/(auth)/login');
    } else if (user && (inAuthGroup || atRoot)) {
      // If authenticated and currently in auth screens or at root, go to the app tabs
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  // Web-only: keep dark inputs even when browser autofill applies
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const STYLE_ID = 'stratum-autofill-dark';
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      textarea:-webkit-autofill,
      textarea:-webkit-autofill:hover,
      textarea:-webkit-autofill:focus,
      select:-webkit-autofill,
      select:-webkit-autofill:hover,
      select:-webkit-autofill:focus {
        -webkit-text-fill-color: #F5F5F5 !important;
        caret-color: #FF2A2A !important;
        transition: background-color 9999s ease-in-out 0s !important;
        box-shadow: 0 0 0px 1000px #111111 inset !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Apply CSS variables for light theme on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const cls = 'stratum-light-theme';
    const root = document.documentElement;
    if (theme === 'light') root.classList.add(cls); else root.classList.remove(cls);
  }, [theme]);

  const navTheme = theme === 'dark' ? StratumDarkTheme : {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: '#79b8ff',
      background: '#ffffff',
      card: '#f7fbff',
      text: '#0b1e2d',
      border: '#cde7ff',
      notification: '#79b8ff',
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <UniversalNavbar theme={theme} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

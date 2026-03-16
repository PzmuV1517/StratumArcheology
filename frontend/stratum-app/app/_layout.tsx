/**
 * @file
 * Root application layout.
 *
 * Configures the navigation stack, theme provider, font loading,
 * and global context providers.
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
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { useEffect } from "react";
import { View, Platform, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthRedirector from "./AuthRedirector";

import { AuthProvider } from "@/contexts/AuthContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import ConnectionStatusIndicator from "@/components/common/OfflineBanner";
import CustomAlertOverride from "@/components/common/AndroidAlertOverride";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";

// Custom STRATUM Dark Theme
const StratumDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#FF2A2A",
    background: "#111111",
    card: "#1A1A1A",
    text: "#F5F5F5",
    border: "#2A2A2A",
    notification: "#FF2A2A",
  },
};

function RootLayoutNav() {
  // Web-only: register the precaching service worker
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Immediately activate any waiting worker
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        reg.onupdatefound = () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.onstatechange = () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              // New content is available – activate immediately
              installing.postMessage({ type: "SKIP_WAITING" });
            }
          };
        };
      })
      .catch(() => {
        // SW file not present in dev mode – silently ignore
      });
  }, []);

  // Web-only: keep dark inputs even when browser autofill applies
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const STYLE_ID = "stratum-autofill-dark";
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
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

  // Use AuthRedirector to handle navigation gating after mount
  return (
    <AuthRedirector>
      <ThemeProvider value={StratumDarkTheme}>
        <View style={styles.container}>
          <Stack
            screenOptions={{
              headerShown: false,
              // Enable iOS swipe-back gesture from anywhere on screen
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="dm/[userId]"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", title: "Modal" }}
            />
          </Stack>
          <ConnectionStatusIndicator />
        </View>
        <StatusBar style="light" />
      </ThemeProvider>
    </AuthRedirector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <WebSocketProvider>
            <OnboardingProvider>
              <RootLayoutNav />
              <OnboardingOverlay />
              <CustomAlertOverride />
            </OnboardingProvider>
          </WebSocketProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

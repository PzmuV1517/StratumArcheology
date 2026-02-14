import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { useEffect } from "react";
import { View, Platform, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthRedirector from "./AuthRedirector";

import { AuthProvider } from "../src/contexts/AuthContext";
import { WebSocketProvider } from "../src/contexts/WebSocketContext";
import { OnboardingProvider } from "../src/contexts/OnboardingContext";
import ConnectionStatusIndicator from "../src/components/common/OfflineBanner";
import CustomAlertOverride from "../src/components/common/AndroidAlertOverride";
import { OnboardingOverlay } from "../src/components/onboarding/OnboardingOverlay";

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

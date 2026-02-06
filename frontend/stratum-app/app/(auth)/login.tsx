import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { FaEyeSlash, FaEye } from "react-icons/fa";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../src/services/api";
import { showAlert } from "../../src/utils/alert";
import { config } from "../../src/config/config";
import RAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing as REasing,
  interpolate,
} from "react-native-reanimated";

const FaultyTerminal = require("../../components/FaultyTerminal.jsx").default;
// Prevent unnecessary re-renders of the heavy background
const MemoFaultyTerminal = React.memo(FaultyTerminal);
import NativeTerminalBg from "../../components/NativeTerminalBg";
// Load component CSS only on web
if (Platform.OS === "web") {
  // @ts-ignore - CSS handled by web bundler
  require("../../components/FaultyTerminal.css");
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ fadeDelay?: string }>();
  const fadeDelayMs = useMemo(() => {
    const v = params.fadeDelay ? parseInt(String(params.fadeDelay), 10) : NaN;
    return Number.isFinite(v) ? v : 1200; // default, changeable
  }, [params.fadeDelay]);

  const fade = useRef(new Animated.Value(0)).current;
  const translate = fade.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, fadeDelayMs);
    return () => clearTimeout(t);
  }, [fade, fadeDelayMs]);

  const { login, register } = useAuth();

  // Card swap animation: 0 = login in front, 1 = register in front
  const SWAP_DURATION = 500;
  const SWAP_EASING = REasing.bezier(0.4, 0.0, 0.2, 1);
  const cardProgress = useSharedValue(0);
  const [activeCard, setActiveCard] = useState<"login" | "register">("login");
  const [isAnimating, setIsAnimating] = useState(false);

  // Measure card heights so the stack can animate its own height
  const loginHeightSV = useSharedValue(400);
  const registerHeightSV = useSharedValue(500);

  const onLoginLayout = useCallback((e: any) => {
    loginHeightSV.value = e.nativeEvent.layout.height;
  }, [loginHeightSV]);
  const onRegisterLayout = useCallback((e: any) => {
    registerHeightSV.value = e.nativeEvent.layout.height;
  }, [registerHeightSV]);

  const stackAnimStyle = useAnimatedStyle(() => ({
    height: interpolate(cardProgress.value, [0, 1], [loginHeightSV.value, registerHeightSV.value]),
  }));

  const switchToRegister = useCallback(() => {
    if (isAnimating || activeCard === "register") return;
    setIsAnimating(true);
    setActiveCard("register");
    cardProgress.value = withTiming(1, { duration: SWAP_DURATION, easing: SWAP_EASING });
    setTimeout(() => { setIsAnimating(false); }, SWAP_DURATION);
  }, [isAnimating, activeCard, cardProgress]);

  const switchToLogin = useCallback(() => {
    if (isAnimating || activeCard === "login") return;
    setIsAnimating(true);
    setActiveCard("login");
    cardProgress.value = withTiming(0, { duration: SWAP_DURATION, easing: SWAP_EASING });
    setTimeout(() => { setIsAnimating(false); }, SWAP_DURATION);
  }, [isAnimating, activeCard, cardProgress]);

  // Login card: front at 0, behind at 1
  const loginCardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(cardProgress.value, [0, 1], [1, 0.92]) },
      { translateY: interpolate(cardProgress.value, [0, 1], [0, -20]) },
    ],
    opacity: interpolate(cardProgress.value, [0, 0.5, 1], [1, 0.5, 0]),
    zIndex: cardProgress.value < 0.5 ? 2 : 1,
  }));

  // Register card: behind at 0, front at 1
  const registerCardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(cardProgress.value, [0, 1], [0.92, 1]) },
      { translateY: interpolate(cardProgress.value, [0, 1], [20, 0]) },
    ],
    opacity: interpolate(cardProgress.value, [0, 0.5, 1], [0, 0.5, 1]),
    zIndex: cardProgress.value >= 0.5 ? 2 : 1,
  }));

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Register form state
  const [regDisplayName, setRegDisplayName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  const [showDevModal, setShowDevModal] = useState(false);
  const [apiInput, setApiInput] = useState("");
  const [savingApi, setSavingApi] = useState(false);

  // Stable props for FaultyTerminal so typing doesn't restart its animation
  const terminalGridMul = useMemo(() => [2, 1] as [number, number], []);
  const terminalStyle = useMemo(
    () => ({ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }) as const,
    [],
  );
  const terminalProps = useMemo(
    () => ({
      scale: 1.5,
      timeScale: 1,
      gridMul: terminalGridMul,
      digitSize: 1.2,
      pause: false,
      scanlineIntensity: 0.5,
      glitchAmount: 1,
      flickerAmount: 1,
      noiseAmp: 1,
      chromaticAberration: 0,
      dither: 0,
      curvature: 0.1,
      tint: "#ff0000",
      mouseReact: true,
      mouseStrength: 0.5,
      pageLoadAnimation: true,
      brightness: 0.6,
      style: terminalStyle,
    }),
    [terminalGridMul, terminalStyle],
  );

  useEffect(() => {
    (async () => {
      const override = await AsyncStorage.getItem("apiBaseUrlOverride");
      const current = override || config.apiBaseUrl;
      setApiInput(current);
      if (override) api.defaults.baseURL = override;
    })();
  }, []);

  const validateUrl = (url: string) => /^https?:\/\//i.test(url);

  const saveApiOverride = async () => {
    if (!validateUrl(apiInput)) {
      showAlert(
        "Invalid URL",
        "Please enter a valid http(s) URL, e.g. http://192.168.1.10:8000/api",
      );
      return;
    }
    try {
      setSavingApi(true);
      await AsyncStorage.setItem("apiBaseUrlOverride", apiInput);
      api.defaults.baseURL = apiInput;
      setShowDevModal(false);
      showAlert("Applied", "Backend API base URL updated for this app.");
    } catch (e) {
      showAlert("Error", "Failed to save API URL override");
    } finally {
      setSavingApi(false);
    }
  };

  const resetApiOverride = async () => {
    try {
      setSavingApi(true);
      await AsyncStorage.removeItem("apiBaseUrlOverride");
      api.defaults.baseURL = config.apiBaseUrl;
      setApiInput(config.apiBaseUrl);
      setShowDevModal(false);
      showAlert("Reset", "Reverted to default backend API URL.");
    } catch (e) {
      showAlert("Error", "Failed to reset API URL override");
    } finally {
      setSavingApi(false);
    }
  };

  // Email validation helper
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert("Error", "Please fill in all fields");
      return;
    }
    if (!isValidEmail(email)) {
      showAlert("Invalid Email", "Please enter a valid email address (e.g., user@example.com)");
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) {
      showAlert("Login Failed", result.error || "Unknown error");
    }
  };

  const handleRegister = async () => {
    if (!regEmail || !regPassword || !regDisplayName) {
      showAlert("Error", "Please fill in all fields");
      return;
    }
    if (!isValidEmail(regEmail)) {
      showAlert("Invalid Email", "Please enter a valid email address (e.g., user@example.com)");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      showAlert("Error", "Passwords do not match");
      return;
    }
    if (regPassword.length < 6) {
      showAlert("Error", "Password must be at least 6 characters");
      return;
    }
    setRegLoading(true);
    const result = await register(regEmail, regPassword, regDisplayName);
    setRegLoading(false);
    if (!result.success) {
      showAlert("Registration Failed", result.error);
    }
  };

  const EyeToggle = ({ visible, onPress, disabled }: { visible: boolean; onPress: () => void; disabled?: boolean }) => (
    <TouchableOpacity
      style={styles.passwordToggle}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={visible ? "Hide password" : "Show password"}
    >
      {Platform.OS === "web" ? (
        visible ? <FaEyeSlash size={18} color="#FF2A2A" /> : <FaEye size={18} color="#FF2A2A" />
      ) : (
        <Ionicons name={visible ? "eye-off" : "eye"} size={20} color="#FF2A2A" />
      )}
    </TouchableOpacity>
  );

  const renderForm = () => (
    <View style={styles.form}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          placeholderTextColor="#4A4A4A"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="username"
          textContentType="username"
          importantForAutofill="yes"
          returnKeyType="next"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>PASSWORD</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Enter your password"
            placeholderTextColor="#4A4A4A"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="password"
            textContentType="password"
            importantForAutofill="yes"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
          <EyeToggle visible={showPassword} onPress={() => setShowPassword((v) => !v)} disabled={loading} />
        </View>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#F5F5F5" />
        ) : (
          <Text style={styles.buttonText}>LOGIN</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.devButton}
        onPress={() => setShowDevModal(true)}
      >
        <Text style={styles.devButtonText}>Dev: API Base URL</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRegisterForm = () => (
    <View style={styles.form}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>DISPLAY NAME</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your full name"
          placeholderTextColor="#4A4A4A"
          value={regDisplayName}
          onChangeText={setRegDisplayName}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          placeholderTextColor="#4A4A4A"
          value={regEmail}
          onChangeText={setRegEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>PASSWORD</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="At least 6 characters"
            placeholderTextColor="#4A4A4A"
            value={regPassword}
            onChangeText={setRegPassword}
            secureTextEntry={!showRegPassword}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
          />
          <EyeToggle visible={showRegPassword} onPress={() => setShowRegPassword((v) => !v)} />
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>CONFIRM PASSWORD</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Re-enter password"
            placeholderTextColor="#4A4A4A"
            value={regConfirmPassword}
            onChangeText={setRegConfirmPassword}
            secureTextEntry={!showRegConfirmPassword}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleRegister}
          />
          <EyeToggle visible={showRegConfirmPassword} onPress={() => setShowRegConfirmPassword((v) => !v)} />
        </View>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={regLoading}>
        {regLoading ? (
          <ActivityIndicator color="#F5F5F5" />
        ) : (
          <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const wrapForm = (content: React.ReactNode, onSubmit: () => void, isLoading: boolean) =>
    Platform.OS === "web" ? (
      <form onSubmit={(e: any) => { e.preventDefault(); if (!isLoading) onSubmit(); }} style={{ display: "contents" }}>
        {content}
      </form>
    ) : content;

  return (
    <View style={styles.container}>
      {Platform.OS === "web" ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            {React.createElement(MemoFaultyTerminal as any, terminalProps as any)}
          </div>
        </div>
      ) : (
        <NativeTerminalBg />
      )}

      {/* Card stack with fade-up entrance */}
      <Animated.View
        style={[
          styles.cardStack,
          { opacity: fade, transform: [{ translateY: translate }] },
        ]}
      >
        <RAnimated.View style={stackAnimStyle}>
        {/* Login card */}
        <RAnimated.View
          onLayout={onLoginLayout}
          style={[styles.card, styles.cardAbsolute, loginCardStyle]}
          pointerEvents={activeCard === "login" ? "auto" : "none"}
        >
          <ScrollView contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.logo}>STRATUM</Text>
            </View>
            {wrapForm(renderForm(), handleLogin, loading)}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account?</Text>
              <TouchableOpacity onPress={switchToRegister}>
                <Text style={styles.linkText}>Register</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </RAnimated.View>

        {/* Register card */}
        <RAnimated.View
          onLayout={onRegisterLayout}
          style={[styles.card, styles.cardAbsolute, registerCardStyle]}
          pointerEvents={activeCard === "register" ? "auto" : "none"}
        >
          <ScrollView contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.logo}>STRATUM</Text>
            </View>
            {wrapForm(renderRegisterForm(), handleRegister, regLoading)}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity onPress={switchToLogin}>
                <Text style={styles.linkText}>Login</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </RAnimated.View>
      </RAnimated.View>
      </Animated.View>

      {/* Dev modal for API override */}
      <Modal
        visible={showDevModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDevModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Backend API Base URL</Text>
            <Text style={styles.modalText}>
              Enter the full API url including /api. Example:
              http://192.168.1.100:8000/api
            </Text>
            <TextInput
              style={styles.input}
              placeholder="http://host:port/api"
              placeholderTextColor="#777"
              value={apiInput}
              onChangeText={setApiInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowDevModal(false)}
                disabled={savingApi}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: "#3A0C0C",
                    borderWidth: 1,
                    borderColor: "#FF4444",
                  },
                ]}
                onPress={resetApiOverride}
                disabled={savingApi}
              >
                {savingApi ? (
                  <ActivityIndicator color="#F5F5F5" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: "#FF4444" }]}>
                    Reset
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#FF2A2A" }]}
                onPress={saveApiOverride}
                disabled={savingApi}
              >
                {savingApi ? (
                  <ActivityIndicator color="#F5F5F5" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: "#F5F5F5" }]}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles: any = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    color: "#ffffff",
    opacity: 0.9,
    fontSize: 14,
    letterSpacing: 6,
    fontWeight: "800",
    marginBottom: 25,
    textAlign: "center",
  },
  cardStack: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  card: {
    backgroundColor: "#0A0A0A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 16,
    padding: 20,
    width: "100%",
  },
  cardAbsolute: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
  },
  cardContent: {
    flexGrow: 1,
  },
  header: {
    minHeight: 80,
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 48,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: "#9A9A9A",
    letterSpacing: 0.5,
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: "#9A9A9A",
    marginBottom: 8,
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: "#F5F5F5",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 48,
  },
  passwordToggle: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  button: {
    backgroundColor: "#FF2A2A",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#FF2A2A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  buttonText: {
    color: "#F5F5F5",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
  },
  footerText: {
    fontSize: 14,
    color: "#9A9A9A",
    marginRight: 8,
    letterSpacing: 0.5,
  },
  linkText: {
    fontSize: 14,
    color: "#FF2A2A",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  devButton: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  devButtonText: {
    color: "#F5F5F5",
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333",
    width: "100%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: "#CCCCCC",
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#2A2A2A",
  },
  modalButtonText: {
    color: "#F5F5F5",
    fontSize: 14,
    fontWeight: "600",
  },
});

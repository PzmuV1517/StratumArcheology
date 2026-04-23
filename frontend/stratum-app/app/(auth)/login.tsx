/**
 * @file
 * Login screen.
 *
 * User authentication form with email/password fields
 * and sign-in action.
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
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  Animated,
  Easing,
  ScrollView,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "@/services/api";
import { showAlert } from "@/utils/alert";
import { config } from "@/config/config";
import { useColorScheme } from "@/hooks/use-color-scheme";
import RAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing as REasing,
  interpolate,
} from "react-native-reanimated";

import NativeTerminalBg from "@/components/effects/NativeTerminalBg";

WebBrowser.maybeCompleteAuthSession();

// Web-only: lazy-load react-icons and FaultyTerminal (they use DOM/SVG/WebGL)
let FaEyeSlash: any = null;
let FaEye: any = null;
let MemoFaultyTerminal: any = null;

if (Platform.OS === "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fa = require("react-icons/fa");
    FaEyeSlash = fa.FaEyeSlash;
    FaEye = fa.FaEye;
  } catch {}
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const FaultyTerminal =
      require("@/components/effects/FaultyTerminal.jsx").default;
    /* eslint-enable @typescript-eslint/no-require-imports */
    MemoFaultyTerminal = React.memo(FaultyTerminal);
    // @ts-ignore - CSS handled by web bundler
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@/components/effects/FaultyTerminal.css");
  } catch {}
}

type PendingVerification = {
  email: string;
  password: string;
};

type ExtraConfig = {
  googleWebClientId?: string;
  googleIosClientId?: string;
  googleAndroidClientId?: string;
};

const GOOGLE_LOGO = require("../../assets/images/google.png");

export default function LoginScreen() {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const placeholderTextColor = isDarkMode ? "#4A4A4A" : "#7A7A7A";
  const modalPlaceholderTextColor = isDarkMode ? "#777777" : "#888888";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const router = useRouter();

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

  const { login, register, loginWithGoogle } = useAuth();

  const runtimeExtra =
    ((Constants.expoConfig?.extra ??
      Constants.manifest2?.extra ??
      (Constants as any).manifest?.extra) as ExtraConfig | undefined) ?? {};
  const isExpoGoClient =
    Constants.executionEnvironment === "storeClient" ||
    (Constants as any).appOwnership === "expo";

  // Card swap animation: 0 = login in front, 1 = register in front
  const SWAP_DURATION = 500;
  const SWAP_EASING = REasing.bezier(0.4, 0.0, 0.2, 1);
  const cardProgress = useSharedValue(0);
  const [activeCard, setActiveCard] = useState<"login" | "register">("login");
  const [isAnimating, setIsAnimating] = useState(false);

  // Measure card heights so the stack can animate its own height
  const loginHeightSV = useSharedValue(400);
  const registerHeightSV = useSharedValue(500);

  const onLoginLayout = useCallback(
    (e: any) => {
      loginHeightSV.value = e.nativeEvent.layout.height;
    },
    [loginHeightSV],
  );
  const onRegisterLayout = useCallback(
    (e: any) => {
      registerHeightSV.value = e.nativeEvent.layout.height;
    },
    [registerHeightSV],
  );

  const stackAnimStyle = useAnimatedStyle(() => ({
    height: interpolate(
      cardProgress.value,
      [0, 1],
      [loginHeightSV.value, registerHeightSV.value],
    ),
  }));

  const switchToRegister = useCallback(() => {
    if (isAnimating || activeCard === "register") return;
    setIsAnimating(true);
    setActiveCard("register");
    cardProgress.value = withTiming(1, {
      duration: SWAP_DURATION,
      easing: SWAP_EASING,
    });
    setTimeout(() => {
      setIsAnimating(false);
    }, SWAP_DURATION);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnimating, activeCard, cardProgress]);

  const switchToLogin = useCallback(() => {
    if (isAnimating || activeCard === "login") return;
    setIsAnimating(true);
    setActiveCard("login");
    cardProgress.value = withTiming(0, {
      duration: SWAP_DURATION,
      easing: SWAP_EASING,
    });
    setTimeout(() => {
      setIsAnimating(false);
    }, SWAP_DURATION);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [googleLoading, setGoogleLoading] = useState(false);

  const [googleRequest, , promptGoogleAsync] = Google.useIdTokenAuthRequest({
    webClientId: config.googleOAuth.webClientId || runtimeExtra.googleWebClientId,
    iosClientId: config.googleOAuth.iosClientId || runtimeExtra.googleIosClientId,
    androidClientId:
      config.googleOAuth.androidClientId || runtimeExtra.googleAndroidClientId,
    scopes: ["openid", "profile", "email"],
  });

  // Refs for iOS AutoFill focus chaining
  const loginPasswordRef = useRef<TextInput>(null);
  const regUsernameRef = useRef<TextInput>(null);
  const regEmailRef = useRef<TextInput>(null);
  const regPasswordRef = useRef<TextInput>(null);
  const regConfirmRef = useRef<TextInput>(null);

  // Register form state
  const [regDisplayName, setRegDisplayName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [pendingVerification, setPendingVerification] =
    useState<PendingVerification | null>(null);
  const [verificationCheckLoading, setVerificationCheckLoading] = useState(false);
  const [verificationStatusText, setVerificationStatusText] = useState<
    string | null
  >(null);

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
    } catch (_e) {
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
    } catch (_e) {
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
      showAlert(
        "Invalid Email",
        "Please enter a valid email address (e.g., user@example.com)",
      );
      return;
    }
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    console.log("[Login] Calling login...");
    const result = await login(normalizedEmail, password);
    console.log("[Login] Result:", result);
    setLoading(false);
    if (!result.success) {
      showAlert("Login Failed", result.error || "Unknown error");
    }
  };

  const getGoogleClientIdForCurrentPlatform = () => {
    if (Platform.OS === "ios") {
      return (
        config.googleOAuth.iosClientId || runtimeExtra.googleIosClientId
      )?.trim();
    }
    if (Platform.OS === "android") {
      return (
        config.googleOAuth.androidClientId || runtimeExtra.googleAndroidClientId
      )?.trim();
    }
    return (
      config.googleOAuth.webClientId || runtimeExtra.googleWebClientId
    )?.trim();
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading) {
      return;
    }

    if (Platform.OS !== "web" && isExpoGoClient) {
      showAlert(
        "Google Sign-In Requires Dev Build",
        "Google OAuth on native cannot complete in Expo Go for this flow. Use a development build (npx expo run:ios / npx expo run:android) and then start with npx expo start --dev-client.",
      );
      return;
    }

    const platformClientId = getGoogleClientIdForCurrentPlatform();
    if (!platformClientId) {
      showAlert(
        "Google Sign-In Unavailable",
        "Google OAuth client ID is missing for this platform. Configure it in app.json extra settings.",
      );
      return;
    }

    if (!googleRequest) {
      showAlert(
        "Google Sign-In Unavailable",
        "Google authentication is still initializing. Please try again.",
      );
      return;
    }

    console.log("[GoogleAuth] runtime", {
      platform: Platform.OS,
      executionEnvironment: (Constants as any).executionEnvironment,
      appOwnership: (Constants as any).appOwnership,
      redirectUri: googleRequest.redirectUri,
      hasPlatformClientId: Boolean(platformClientId),
    });

    setGoogleLoading(true);
    try {
      const promptResult = await promptGoogleAsync();
      if (promptResult.type !== "success") {
        if (promptResult.type === "error") {
          const mismatchError =
            (promptResult as any)?.params?.error === "redirect_uri_mismatch" ||
            String((promptResult as any)?.params?.error_description || "")
              .toLowerCase()
              .includes("redirect_uri_mismatch");

          if (mismatchError) {
            showAlert(
              "Google Redirect URI Mismatch",
              `Allowed redirect URI is missing in Google Cloud OAuth config. Add this URI to your Web client authorized redirect URIs: ${googleRequest.redirectUri}`,
            );
            return;
          }

          showAlert(
            "Google Sign-In Failed",
            "Could not complete Google authentication.",
          );
        }
        return;
      }

      const idTokenFromAuthentication = promptResult.authentication?.idToken ?? null;
      const idTokenFromParams =
        typeof (promptResult as any)?.params?.id_token === "string"
          ? (promptResult as any).params.id_token
          : null;
      const accessTokenFromAuthentication =
        promptResult.authentication?.accessToken ?? null;
      const accessTokenFromParams =
        typeof (promptResult as any)?.params?.access_token === "string"
          ? (promptResult as any).params.access_token
          : null;
      const googleIdToken = idTokenFromAuthentication || idTokenFromParams;
      const googleAccessToken =
        accessTokenFromAuthentication || accessTokenFromParams;

      if (!googleIdToken && !googleAccessToken) {
        showAlert(
          "Google Sign-In Failed",
          "Google did not return an identity or access token.",
        );
        return;
      }

      const result = await loginWithGoogle(
        googleIdToken || undefined,
        googleAccessToken || undefined,
      );
      if (!result.success) {
        showAlert("Google Sign-In Failed", result.error || "Unknown error");
      }
    } catch (error: any) {
      showAlert(
        "Google Sign-In Failed",
        error?.message || "Could not complete Google authentication.",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regEmail || !regPassword || !regDisplayName || !regUsername) {
      showAlert("Error", "Please fill in all fields");
      return;
    }
    if (!isValidEmail(regEmail)) {
      showAlert(
        "Invalid Email",
        "Please enter a valid email address (e.g., user@example.com)",
      );
      return;
    }
    const trimmedUsername = regUsername.trim().toLowerCase();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      showAlert("Error", "Username must be 3-30 characters");
      return;
    }
    if (!/^[a-z0-9_.-]+$/.test(trimmedUsername)) {
      showAlert(
        "Error",
        "Username can only contain lowercase letters, numbers, dots, hyphens, and underscores",
      );
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
    const result = await register(
      regEmail,
      regPassword,
      regDisplayName,
      trimmedUsername,
    );
    setRegLoading(false);
    if (result.success) {
      if (result.message) {
        setPendingVerification({
          email: regEmail.trim().toLowerCase(),
          password: regPassword,
        });
        setVerificationStatusText(
          `${result.message} Check inbox and spam for the verification link.`,
        );
        setRegPassword("");
        setRegConfirmPassword("");
        setShowRegPassword(false);
        setShowRegConfirmPassword(false);
      }
      return;
    }

    if (!result.success) {
      showAlert("Registration Failed", result.error);
    }
  };

  const checkVerificationStatus = useCallback(
    async (silent = false) => {
      if (!pendingVerification || verificationCheckLoading) {
        return;
      }

      setVerificationCheckLoading(true);
      if (!silent) {
        setVerificationStatusText("Checking verification status...");
      }

      try {
        await api.post("/auth/login", {
          email: pendingVerification.email,
          password: pendingVerification.password,
        });

        setPendingVerification(null);
        setVerificationStatusText(null);
        setEmail(pendingVerification.email);
        setPassword("");
        switchToLogin();
      } catch (error: any) {
        const detail = error?.response?.data?.detail;
        const detailText =
          typeof detail === "string"
            ? detail
            : "Could not check verification status right now.";
        const normalized = detailText.toLowerCase();
        const isNotVerified =
          normalized.includes("not verified") || normalized.includes("verification");

        if (!silent || !isNotVerified) {
          setVerificationStatusText(
            isNotVerified
              ? "Not verified yet. Check inbox and spam, then try again."
              : detailText,
          );
        }
      } finally {
        setVerificationCheckLoading(false);
      }
    },
    [
      pendingVerification,
      verificationCheckLoading,
      switchToLogin,
      setEmail,
      setPassword,
    ],
  );

  useEffect(() => {
    if (activeCard !== "register" || !pendingVerification) {
      return;
    }

    const interval = setInterval(() => {
      void checkVerificationStatus(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [activeCard, pendingVerification, checkVerificationStatus]);

  const EyeToggle = ({
    visible,
    onPress,
    disabled,
  }: {
    visible: boolean;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.passwordToggle}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={visible ? "Hide password" : "Show password"}
    >
      {Platform.OS === "web" ? (
        visible ? (
          <FaEyeSlash size={18} color="#FF2A2A" />
        ) : (
          <FaEye size={18} color="#FF2A2A" />
        )
      ) : (
        <Ionicons name={visible ? "eye-off" : "eye"} size={20} color="#FF2A2A" />
      )}
    </TouchableOpacity>
  );

  const renderLegalNotice = () => (
    <View style={styles.legalNotice}>
      <Text style={styles.legalWarningTitle}>Privacy Notice</Text>
      <Text style={styles.legalWarningText}>
        STRATUM uses required cookies for sign-in, secure sessions, and account
        protection. These cookies are mandatory, and the app cannot be used without
        them. By using STRATUM, you acknowledge and accept the Terms of Service and
        Privacy Policy.
      </Text>
      <View style={styles.legalLinksRow}>
        <TouchableOpacity
          onPress={() => router.push("/privacy-policy")}
          accessibilityRole="button"
          accessibilityLabel="Open Privacy Policy"
        >
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </TouchableOpacity>
        <Text style={styles.legalDot}>•</Text>
        <TouchableOpacity
          onPress={() => router.push("/terms-of-service")}
          accessibilityRole="button"
          accessibilityLabel="Open Terms of Service"
        >
          <Text style={styles.legalLink}>Terms of Service</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderForm = () => (
    <View style={styles.form}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          placeholderTextColor={placeholderTextColor}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="username"
          {...(Platform.OS === "android" && {
            importantForAutofill: "yes",
          })}
          returnKeyType="next"
          onSubmitEditing={() => loginPasswordRef.current?.focus()}
          blurOnSubmit={false}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>PASSWORD</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={loginPasswordRef}
            style={[styles.input, styles.passwordInput]}
            placeholder="Enter your password"
            placeholderTextColor={placeholderTextColor}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            textContentType="password"
            {...(Platform.OS === "android" && {
              importantForAutofill: "yes",
            })}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
          <EyeToggle
            visible={showPassword}
            onPress={() => setShowPassword((v) => !v)}
            disabled={loading}
          />
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

      <View style={styles.oauthDivider}>
        <View style={styles.oauthDividerLine} />
        <Text style={styles.oauthDividerText}>OR</Text>
        <View style={styles.oauthDividerLine} />
      </View>

      <TouchableOpacity
        style={[
          styles.googleButton,
          (googleLoading || !googleRequest) && styles.googleButtonDisabled,
        ]}
        onPress={() => void handleGoogleSignIn()}
        disabled={googleLoading || !googleRequest}
      >
        {googleLoading ? (
          <ActivityIndicator color={isDarkMode ? "#F5F5F5" : "#1A1A1A"} />
        ) : (
          <>
            <View style={styles.googleIconBadge}>
              <Image
                source={GOOGLE_LOGO}
                style={styles.googleIconImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.googleButtonText}>CONTINUE WITH GOOGLE</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.devButton}
        onPress={() => setShowDevModal(true)}
      >
        <Text style={styles.devButtonText}>Dev: API Base URL</Text>
      </TouchableOpacity>

      {renderLegalNotice()}
    </View>
  );

  const renderRegisterForm = () => (
    <View style={styles.form}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>DISPLAY NAME</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your full name"
          placeholderTextColor={placeholderTextColor}
          value={regDisplayName}
          onChangeText={setRegDisplayName}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => regUsernameRef.current?.focus()}
          blurOnSubmit={false}
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>USERNAME</Text>
        <TextInput
          ref={regUsernameRef}
          style={styles.input}
          placeholder="e.g. john.doe (unique, lowercase)"
          placeholderTextColor={placeholderTextColor}
          value={regUsername}
          onChangeText={(text) =>
            setRegUsername(text.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))
          }
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="username"
          textContentType="username"
          maxLength={30}
          returnKeyType="next"
          onSubmitEditing={() => regEmailRef.current?.focus()}
          blurOnSubmit={false}
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          ref={regEmailRef}
          style={styles.input}
          placeholder="Enter your email"
          placeholderTextColor={placeholderTextColor}
          value={regEmail}
          onChangeText={setRegEmail}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => regPasswordRef.current?.focus()}
          blurOnSubmit={false}
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>PASSWORD</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={regPasswordRef}
            style={[styles.input, styles.passwordInput]}
            placeholder="At least 6 characters"
            placeholderTextColor={placeholderTextColor}
            value={regPassword}
            onChangeText={setRegPassword}
            secureTextEntry={!showRegPassword}
            autoComplete="new-password"
            textContentType="newPassword"
            {...(Platform.OS === "android" && {
              importantForAutofill: "yes",
            })}
            returnKeyType="next"
            onSubmitEditing={() => regPasswordRef.current?.focus()}
            blurOnSubmit={false}
          />
          <EyeToggle
            visible={showRegPassword}
            onPress={() => setShowRegPassword((v) => !v)}
          />
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>CONFIRM PASSWORD</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={regConfirmRef}
            style={[styles.input, styles.passwordInput]}
            placeholder="Re-enter password"
            placeholderTextColor={placeholderTextColor}
            value={regConfirmPassword}
            onChangeText={setRegConfirmPassword}
            secureTextEntry={!showRegConfirmPassword}
            autoComplete="new-password"
            textContentType="newPassword"
            {...(Platform.OS === "android" && {
              importantForAutofill: "yes",
            })}
            returnKeyType="go"
            onSubmitEditing={handleRegister}
          />
          <EyeToggle
            visible={showRegConfirmPassword}
            onPress={() => setShowRegConfirmPassword((v) => !v)}
          />
        </View>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleRegister}
        disabled={regLoading}
      >
        {regLoading ? (
          <ActivityIndicator color="#F5F5F5" />
        ) : (
          <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
        )}
      </TouchableOpacity>

      <View style={styles.oauthDivider}>
        <View style={styles.oauthDividerLine} />
        <Text style={styles.oauthDividerText}>OR</Text>
        <View style={styles.oauthDividerLine} />
      </View>

      <TouchableOpacity
        style={[
          styles.googleButton,
          (googleLoading || !googleRequest) && styles.googleButtonDisabled,
        ]}
        onPress={() => void handleGoogleSignIn()}
        disabled={googleLoading || !googleRequest}
      >
        {googleLoading ? (
          <ActivityIndicator color={isDarkMode ? "#F5F5F5" : "#1A1A1A"} />
        ) : (
          <>
            <View style={styles.googleIconBadge}>
              <Image
                source={GOOGLE_LOGO}
                style={styles.googleIconImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.googleButtonText}>CONTINUE WITH GOOGLE</Text>
          </>
        )}
      </TouchableOpacity>

      {renderLegalNotice()}
    </View>
  );

  const renderVerificationCard = () => (
    <View style={styles.form}>
      <View style={styles.verifyCard}>
        <Text style={styles.verifyTitle}>Check Your Email</Text>
        <Text style={styles.verifyText}>
          We sent a verification email to
          {"\n"}
          <Text style={styles.verifyEmail}>{pendingVerification?.email}</Text>
        </Text>
        <Text style={styles.verifyText}>
          Check your inbox. If you don't see the email, please check your spam
          folder. Once verified, this card moves you to login.
        </Text>
        {verificationStatusText ? (
          <Text style={styles.verifyStatusText}>{verificationStatusText}</Text>
        ) : null}

        <TouchableOpacity
          style={styles.button}
          onPress={() => void checkVerificationStatus(false)}
          disabled={verificationCheckLoading}
        >
          {verificationCheckLoading ? (
            <ActivityIndicator color="#F5F5F5" />
          ) : (
            <Text style={styles.buttonText}>I VERIFIED, CHECK NOW</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryActionButton}
          onPress={() => {
            setPendingVerification(null);
            setVerificationStatusText(null);
          }}
          disabled={verificationCheckLoading}
        >
          <Text style={styles.secondaryActionButtonText}>Use a Different Email</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const wrapForm = (
    content: React.ReactNode,
    onSubmit: () => void,
    isLoading: boolean,
  ) =>
    Platform.OS === "web" ? (
      <form
        onSubmit={(e: any) => {
          e.preventDefault();
          if (!isLoading) onSubmit();
        }}
        style={{ display: "contents" }}
      >
        {content}
      </form>
    ) : (
      content
    );

  return (
    <View style={styles.container}>
      {Platform.OS === "web" && MemoFaultyTerminal ? (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
        >
          <div style={{ position: "absolute", inset: 0 }}>
            {React.createElement(MemoFaultyTerminal as any, terminalProps as any)}
          </div>
        </div>
      ) : Platform.OS !== "web" ? (
        <NativeTerminalBg />
      ) : null}

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
            <ScrollView
              contentContainerStyle={styles.cardContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.header}>
                <Text style={styles.logo}>STRATUM</Text>
              </View>
              {activeCard === "login"
                ? wrapForm(renderForm(), handleLogin, loading)
                : null}
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
            <ScrollView
              contentContainerStyle={styles.cardContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.header}>
                <Text style={styles.logo}>STRATUM</Text>
              </View>
              {activeCard === "register"
                ? pendingVerification
                  ? renderVerificationCard()
                  : wrapForm(renderRegisterForm(), handleRegister, regLoading)
                : null}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account?</Text>
                <TouchableOpacity onPress={switchToLogin}>
                  <Text style={styles.linkText}>Login</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.docsLink}
                onPress={() => Linking.openURL("https://stratumapp.readthedocs.io")}
                activeOpacity={0.7}
              >
                <Text style={styles.docsLinkText}>Begin Now →</Text>
              </TouchableOpacity>
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
              placeholderTextColor={modalPlaceholderTextColor}
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

const createStyles = (isDarkMode: boolean): any =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "transparent",
      justifyContent: "center",
      padding: 24,
    },
    logo: {
      color: isDarkMode ? "#FFFFFF" : "#1A1A1A",
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
      backgroundColor: isDarkMode ? "#0A0A0A" : "#FFFFFF",
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
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
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 8,
      letterSpacing: 1,
    },
    subtitle: {
      fontSize: 14,
      color: isDarkMode ? "#9A9A9A" : "#666666",
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
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginBottom: 8,
      letterSpacing: 0.5,
      fontWeight: "600",
    },
    input: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
      borderRadius: 16,
      padding: 16,
      fontSize: 16,
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
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
    oauthDivider: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 14,
      marginBottom: 10,
      gap: 10,
    },
    oauthDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    oauthDividerText: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      color: isDarkMode ? "#8A8A8A" : "#7A7A7A",
    },
    googleButton: {
      marginTop: 2,
      borderWidth: 1,
      borderColor: isDarkMode ? "#3A3A3A" : "#CFCFCF",
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: isDarkMode ? "#101010" : "#FFFFFF",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    googleButtonDisabled: {
      opacity: 0.6,
    },
    googleIconBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: isDarkMode ? "#FFFFFF" : "#F5F5F5",
      alignItems: "center",
      justifyContent: "center",
    },
    googleIconImage: {
      width: 16,
      height: 16,
    },
    googleButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      letterSpacing: 0.4,
    },
    verifyCard: {
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
      borderRadius: 16,
      padding: 16,
      backgroundColor: isDarkMode ? "#111111" : "#FAFAFA",
      gap: 12,
    },
    verifyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
    },
    verifyText: {
      fontSize: 14,
      lineHeight: 21,
      color: isDarkMode ? "#CCCCCC" : "#4D4D4D",
    },
    verifyEmail: {
      color: isDarkMode ? "#FFFFFF" : "#1A1A1A",
      fontWeight: "700",
    },
    verifyStatusText: {
      fontSize: 13,
      lineHeight: 18,
      color: "#FF2A2A",
      fontWeight: "600",
    },
    secondaryActionButton: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? "#3A3A3A" : "#D0D0D0",
      backgroundColor: "transparent",
    },
    secondaryActionButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: isDarkMode ? "#DDDDDD" : "#333333",
      letterSpacing: 0.3,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    footerText: {
      fontSize: 14,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginRight: 8,
      letterSpacing: 0.5,
    },
    linkText: {
      fontSize: 14,
      color: "#FF2A2A",
      fontWeight: "600",
      letterSpacing: 0.5,
    },
    legalNotice: {
      marginTop: 16,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
      backgroundColor: isDarkMode ? "#111111" : "#FAFAFA",
    },
    legalWarningTitle: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.3,
      marginBottom: 6,
    },
    legalWarningText: {
      color: isDarkMode ? "#C9C9C9" : "#555555",
      fontSize: 12,
      lineHeight: 18,
    },
    legalLinksRow: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    legalLink: {
      color: "#FF2A2A",
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    legalDot: {
      color: isDarkMode ? "#888888" : "#777777",
      fontSize: 12,
      fontWeight: "600",
    },
    devButton: {
      marginTop: 12,
      padding: 10,
      borderRadius: 12,
      alignItems: "center",
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    devButtonText: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontWeight: "600",
    },
    docsLink: {
      marginTop: 16,
      alignItems: "center",
    },
    docsLinkText: {
      color: "#FF2A2A",
      fontSize: 13,
      fontWeight: "600",
      letterSpacing: 0.3,
      opacity: 0.8,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: isDarkMode ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.24)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalCard: {
      backgroundColor: isDarkMode ? "#1E1E1E" : "#FFFFFF",
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? "#333333" : "#D9D9D9",
      width: "100%",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 8,
    },
    modalText: {
      fontSize: 14,
      color: isDarkMode ? "#CCCCCC" : "#4D4D4D",
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
      backgroundColor: isDarkMode ? "#2A2A2A" : "#EFEFEF",
    },
    modalButtonText: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 14,
      fontWeight: "600",
    },
  });

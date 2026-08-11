/**
 * @file
 * QR code scanner screen.
 *
 * Provides camera-based QR code scanning and resolves
 * scanned codes to application resources.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
  Modal,
  Dimensions,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from "expo-camera";
import { useRouter, Stack, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { projectService } from "@/services/projectService";
import { qrService } from "@/services/qrService";
import { useColorScheme } from "@/hooks/use-color-scheme";

const isIOS = Platform.OS === "ios";
const VIEWPORT_SIZE = 250;
const VIEWPORT_LOCKED_SIZE = 160;
const SCREEN_WIDTH = Dimensions.get("window").width;

// ─── Result Modal ───────────────────────────────────────────────────

type ResultModalData = {
  title: string;
  message: string;
  buttons: {
    text: string;
    onPress?: () => void;
    style?: "default" | "destructive" | "cancel";
  }[];
} | null;

function ResultModal({
  data,
  onDismiss,
  modalStyles,
}: {
  data: ResultModalData;
  onDismiss: () => void;
  modalStyles: ReturnType<typeof createModalStyles>;
}) {
  if (!data) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.card}>
          <Text style={modalStyles.title}>{data.title}</Text>
          <Text style={modalStyles.message}>{data.message}</Text>
          <View style={modalStyles.buttonRow}>
            {data.buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  modalStyles.button,
                  btn.style === "destructive" && modalStyles.destructiveBtn,
                  data.buttons.length === 1 && { flex: 1 },
                ]}
                onPress={() => {
                  onDismiss();
                  btn.onPress?.();
                }}
              >
                <Text
                  style={[
                    modalStyles.buttonText,
                    btn.style === "destructive" && modalStyles.destructiveBtnText,
                    btn.style === "cancel" && modalStyles.cancelBtnText,
                  ]}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Scanner Screen ─────────────────────────────────────────────────

export default function ScanQRScreen() {
  // Redirect away on web
  if (Platform.OS === "web") {
    return <Redirect href="/(tabs)/profile" />;
  }

  return <ScannerContent />;
}

function ScannerContent() {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const modalStyles = useMemo(() => createModalStyles(isDarkMode), [isDarkMode]);
  const pageBackground = isDarkMode ? "#111111" : "#F7F7F7";
  const textPrimary = isDarkMode ? "#F5F5F5" : "#1A1A1A";

  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [resultModal, setResultModal] = useState<ResultModalData>(null);
  const lastScannedRef = useRef<string>("");

  // Animation values
  const viewportScale = useRef(new Animated.Value(1)).current;
  const lockOpacity = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  const stackScreenOpts = {
    title: "Scan QR Code",
    headerTransparent: isIOS,
    headerBlurEffect: isIOS ? ("systemChromeMaterial" as const) : undefined,
    headerStyle: isIOS ? {} : { backgroundColor: pageBackground },
    headerTintColor: "#FF2A2A",
    headerTitleStyle: { color: textPrimary, fontWeight: "600" as const },
    headerBackTitle: "Back",
    headerShown: true,
  };

  // Spin animation for loading indicator
  useEffect(() => {
    if (showLoading) {
      spinAnim.setValue(0);
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    }
  }, [showLoading, spinAnim]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const resetScanner = useCallback(() => {
    setScanned(false);
    setProcessing(false);
    setShowLoading(false);
    setResultModal(null);
    lastScannedRef.current = "";
    viewportScale.setValue(1);
    lockOpacity.setValue(0);
  }, [viewportScale, lockOpacity]);

  const runScanAnimation = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      // 1) Darken overlay (camera "pause" effect)
      // 2) Shrink viewport corners toward center
      Animated.parallel([
        Animated.timing(lockOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: false,
        }),
        Animated.timing(viewportScale, {
          toValue: VIEWPORT_LOCKED_SIZE / VIEWPORT_SIZE,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start(() => {
        // 3) Short loading beat
        setShowLoading(true);
        setTimeout(() => {
          setShowLoading(false);
          resolve();
        }, 700);
      });
    });
  }, [lockOpacity, viewportScale]);

  const handleBarCodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      const data = result.data;
      if (scanned || processing || data === lastScannedRef.current) return;

      lastScannedRef.current = data;
      setScanned(true);
      setProcessing(true);

      // Run the detect animation first
      await runScanAnimation();

      try {
        // ── 1. Try resolving via the unified QR-code registry ──────────
        try {
          const resolved = await qrService.resolve(data);

          if (resolved.type === "artefact" && resolved.resource_id) {
            router.replace({
              pathname: "/artefact/[id]" as any,
              params: { id: resolved.resource_id },
            });
            return;
          }

          if (resolved.type === "invite" && resolved.resource_id) {
            // resource_id is the invite token
            try {
              const joinResult = await projectService.acceptInvite(
                resolved.resource_id,
              );
              setResultModal({
                title: "Joined!",
                message: `You've joined the project as ${joinResult.role}.`,
                buttons: [
                  {
                    text: "Open Project",
                    onPress: () =>
                      router.replace({
                        pathname: "/project/[id]",
                        params: { id: joinResult.project_id },
                      }),
                  },
                ],
              });
            } catch (err: any) {
              const msg =
                err?.detail ||
                err?.message ||
                "Failed to join project. The invite may have expired.";
              setResultModal({
                title: "Error",
                message: msg,
                buttons: [{ text: "OK", onPress: resetScanner }],
              });
            }
            setProcessing(false);
            return;
          }

          // Unknown type from registry - show what we got
          setResultModal({
            title: `QR: ${resolved.type}`,
            message: `Resource: ${resolved.resource_id}`,
            buttons: [{ text: "OK", onPress: resetScanner }],
          });
          setProcessing(false);
          return;
        } catch {
          // Code not found in registry - fall through to legacy handling
        }

        // ── 2. Legacy: stratum:artefact: prefix ────────────────────────
        if (data.startsWith("stratum:artefact:")) {
          const parts = data.split(":");
          const folderId = parts[3];
          if (folderId) {
            router.replace({
              pathname: "/artefact/[id]" as any,
              params: { id: folderId },
            });
            return;
          }
        }

        // ── 3. Legacy: stratum:invite: prefix ──────────────────────────
        if (data.startsWith("stratum:invite:")) {
          const code = data.substring("stratum:invite:".length);
          if (code) {
            try {
              const joinResult = await projectService.joinByCode(code);
              setResultModal({
                title: "Joined!",
                message: `You've joined "${joinResult.project_name}" as ${joinResult.role}.`,
                buttons: [
                  {
                    text: "Open Project",
                    onPress: () =>
                      router.replace({
                        pathname: "/project/[id]",
                        params: { id: joinResult.project_id },
                      }),
                  },
                ],
              });
            } catch (err: any) {
              const msg =
                err?.detail ||
                err?.message ||
                "Failed to join project. The invite may have expired.";
              setResultModal({
                title: "Error",
                message: msg,
                buttons: [{ text: "OK", onPress: resetScanner }],
              });
            }
            setProcessing(false);
            return;
          }
        }

        // ── 4. Plain invite code fallback ───────────────────────────────
        if (data.length >= 6 && !data.includes("://") && !data.includes(" ")) {
          try {
            const joinResult = await projectService.joinByCode(data);
            setResultModal({
              title: "Joined!",
              message: `You've joined "${joinResult.project_name}" as ${joinResult.role}.`,
              buttons: [
                {
                  text: "Open Project",
                  onPress: () =>
                    router.replace({
                      pathname: "/project/[id]",
                      params: { id: joinResult.project_id },
                    }),
                },
              ],
            });
            setProcessing(false);
            return;
          } catch {
            // Fall through to unrecognized
          }
        }

        setResultModal({
          title: "Unrecognized QR Code",
          message: data.length > 100 ? `${data.substring(0, 100)}…` : data,
          buttons: [{ text: "OK", onPress: resetScanner }],
        });
      } finally {
        setProcessing(false);
      }
    },
    [scanned, processing, router, runScanAnimation, resetScanner],
  );

  if (!permission) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={stackScreenOpts} />
        <ActivityIndicator size="large" color="#FF2A2A" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={stackScreenOpts} />
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#FF2A2A" />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            Allow camera access to scan QR codes for project invites and artefacts.
          </Text>
          <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
            <Text style={styles.grantButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Animated viewport size
  const animatedSize = viewportScale.interpolate({
    inputRange: [VIEWPORT_LOCKED_SIZE / VIEWPORT_SIZE, 1],
    outputRange: [VIEWPORT_LOCKED_SIZE, VIEWPORT_SIZE],
  });

  // The side overlay width adjusts as viewportScale changes
  const sideOverlayWidth = viewportScale.interpolate({
    inputRange: [VIEWPORT_LOCKED_SIZE / VIEWPORT_SIZE, 1],
    outputRange: [
      (SCREEN_WIDTH - VIEWPORT_LOCKED_SIZE) / 2,
      (SCREEN_WIDTH - VIEWPORT_SIZE) / 2,
    ],
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={stackScreenOpts} />
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        {/* Overlay with square viewport cutout */}
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.overlayTop} />
          <Animated.View style={[styles.overlayMiddle, { height: animatedSize }]}>
            <Animated.View
              style={[styles.overlaySide, { width: sideOverlayWidth }]}
            />
            <Animated.View
              style={{
                width: animatedSize,
                height: animatedSize,
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              {/* Corner markers - rounded */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Loading spinner centered in viewport */}
              {showLoading && (
                <View style={styles.loadingCenter}>
                  <Animated.View
                    style={{ transform: [{ rotate: spinInterpolate }] }}
                  >
                    <Ionicons name="sync" size={36} color="#FF2A2A" />
                  </Animated.View>
                </View>
              )}
            </Animated.View>
            <Animated.View
              style={[styles.overlaySide, { width: sideOverlayWidth }]}
            />
          </Animated.View>
          <View style={styles.overlayBottom}>
            <Text style={styles.instructions}>
              {processing
                ? "Processing…"
                : scanned
                  ? ""
                  : "Point your camera at a Stratum QR code"}
            </Text>
            {scanned && !processing && !resultModal && (
              <TouchableOpacity style={styles.rescanButton} onPress={resetScanner}>
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.rescanText}>Scan Again</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* "Freeze" overlay - darkens camera when QR is detected */}
        <Animated.View
          style={[styles.freezeOverlay, { opacity: lockOpacity }]}
          pointerEvents="none"
        />
      </CameraView>

      {/* Result modal (replaces native Alert) */}
      <ResultModal
        data={resultModal}
        onDismiss={resetScanner}
        modalStyles={modalStyles}
      />
    </View>
  );
}

const createModalStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDarkMode ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.24)",
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    card: {
      backgroundColor: isDarkMode ? "#1C1C1E" : "#FFFFFF",
      borderRadius: 20,
      padding: 24,
      width: "100%",
      maxWidth: 320,
      alignItems: "center",
      borderWidth: 1,
      borderColor: isDarkMode ? "#333333" : "#D9D9D9",
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      textAlign: "center",
      marginBottom: 8,
    },
    message: {
      fontSize: 15,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 20,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
    },
    button: {
      flex: 1,
      backgroundColor: "#FF2A2A",
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: "center",
    },
    buttonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
    },
    destructiveBtn: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: "#FF4444",
    },
    destructiveBtnText: {
      color: "#FF4444",
    },
    cancelBtnText: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
    },
  });

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: isDarkMode ? "#111111" : "#F7F7F7" },
    camera: { flex: 1 },
    // Permission
    permissionContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
      gap: 16,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    permissionTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      textAlign: "center",
    },
    permissionText: {
      fontSize: 15,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      textAlign: "center",
      lineHeight: 22,
      maxWidth: 300,
    },
    grantButton: {
      backgroundColor: "#FF2A2A",
      paddingVertical: 14,
      paddingHorizontal: 32,
      borderRadius: 14,
      marginTop: 8,
    },
    grantButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
    },
    backButton: { paddingVertical: 14, paddingHorizontal: 32 },
    backButtonText: { color: isDarkMode ? "#9A9A9A" : "#666666", fontSize: 16 },
    // Overlay
    overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center" },
    overlayTop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
    overlayMiddle: { flexDirection: "row", alignSelf: "center" },
    overlaySide: { backgroundColor: "rgba(0,0,0,0.55)" },
    overlayBottom: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      paddingTop: 32,
    },
    instructions: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
      paddingHorizontal: 24,
    },
    rescanButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#FF2A2A",
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 14,
      marginTop: 20,
    },
    rescanText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
    // Corner markers - rounded
    corner: {
      position: "absolute",
      width: 36,
      height: 36,
      borderColor: "#FF2A2A",
    },
    cornerTL: {
      top: 0,
      left: 0,
      borderTopWidth: 3,
      borderLeftWidth: 3,
      borderTopLeftRadius: 20,
    },
    cornerTR: {
      top: 0,
      right: 0,
      borderTopWidth: 3,
      borderRightWidth: 3,
      borderTopRightRadius: 20,
    },
    cornerBL: {
      bottom: 0,
      left: 0,
      borderBottomWidth: 3,
      borderLeftWidth: 3,
      borderBottomLeftRadius: 20,
    },
    cornerBR: {
      bottom: 0,
      right: 0,
      borderBottomWidth: 3,
      borderRightWidth: 3,
      borderBottomRightRadius: 20,
    },
    // Loading center
    loadingCenter: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    // Freeze overlay
    freezeOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
  });

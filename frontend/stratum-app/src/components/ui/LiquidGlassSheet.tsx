/**
 * LiquidGlassSheet
 *
 * iOS: A helper that configures a Stack.Screen with `presentation: "formSheet"`
 * or `"modal"` — on iOS 26+ these natively render with Liquid Glass material,
 * increased corner radius, and inset half-sheets. Zero custom rendering on iOS.
 *
 * Android: Custom bottom sheet modal with drag-to-dismiss.
 *
 * Usage (preferred — as a Stack.Screen route):
 *   <Stack.Screen name="my-sheet" options={getLiquidGlassSheetOptions()} />
 *
 * Usage (standalone component — Android only, iOS uses native):
 *   <LiquidGlassSheet visible={show} onClose={() => setShow(false)}>
 *     <Content />
 *   </LiquidGlassSheet>
 *
 * Apple reference: UISheetPresentationController with Liquid Glass material.
 */
import React, { useEffect, useRef, useCallback } from "react";
import {
  View,
  Modal,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  Animated,
  Dimensions,
  PanResponder,
  StyleProp,
  ViewStyle,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Stack.Screen options helper (preferred approach for iOS) ────────────────

export type SheetDetent = "medium" | "large";

export interface LiquidGlassSheetOptionsConfig {
  title?: string;
  /** Detent: "medium" = half sheet, "large" = full (default: "medium") */
  detent?: SheetDetent;
}

/**
 * Returns Stack.Screen options that produce a native iOS sheet with
 * Liquid Glass on iOS 26+. On Android uses "modal" presentation.
 */
export function getLiquidGlassSheetOptions(config?: LiquidGlassSheetOptionsConfig) {
  const isIOS = Platform.OS === "ios";
  return {
    presentation: isIOS ? ("formSheet" as const) : ("modal" as const),
    sheetAllowedDetents: config?.detent === "large" ? [1.0] : [0.5, 1.0],
    sheetGrabberVisible: true,
    sheetCornerRadius: 24,
    headerShown: !!config?.title,
    title: config?.title,
    headerTransparent: isIOS,
    headerBlurEffect: isIOS ? ("systemChromeMaterial" as const) : undefined,
    headerStyle: isIOS ? undefined : { backgroundColor: "#1A1A1A" },
    headerTintColor: "#FF2A2A",
    headerTitleStyle: { color: "#F5F5F5", fontWeight: "600" as const },
  };
}

// ── Standalone component (for imperative use / Android) ─────────────────────

export type SheetSnapPoint = "quarter" | "half" | "threeQuarter" | "full";

const SNAP_FRACTIONS: Record<SheetSnapPoint, number> = {
  quarter: 0.25,
  half: 0.5,
  threeQuarter: 0.75,
  full: 0.92,
};

export interface LiquidGlassSheetProps {
  visible: boolean;
  onClose: () => void;
  snapPoint?: SheetSnapPoint;
  dragToDismiss?: boolean;
  showHandle?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function LiquidGlassSheet({
  visible,
  onClose,
  snapPoint = "half",
  dragToDismiss = true,
  showHandle = true,
  children,
  style,
}: LiquidGlassSheetProps) {
  const insets = useSafeAreaInsets();
  const sheetHeight = SCREEN_HEIGHT * SNAP_FRACTIONS[snapPoint];
  const translateY = useRef(new Animated.Value(sheetHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const open = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 200, friction: 22 }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [translateY, backdropOpacity]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: sheetHeight, useNativeDriver: true, tension: 200, friction: 22 }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [translateY, backdropOpacity, sheetHeight, onClose]);

  useEffect(() => {
    if (visible) { translateY.setValue(sheetHeight); open(); }
  }, [visible, open, sheetHeight, translateY]);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => dragToDismiss && g.dy > 5,
    onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > sheetHeight * 0.3 || g.vy > 0.8) close();
      else Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 300, friction: 25 }).start();
    },
  });

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalContainer}>
        <TouchableWithoutFeedback onPress={close}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>
        <Animated.View
          style={[styles.sheet, { height: sheetHeight, borderTopLeftRadius: 24, borderTopRightRadius: 24, transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          {showHandle && (
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>
          )}
          <View style={[styles.content, { paddingBottom: insets.bottom + 16 }, style]}>
            {children}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    overflow: "hidden",
    backgroundColor: "rgba(30,30,30,0.97)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    borderBottomWidth: 0,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 16 },
      android: { elevation: 16 },
      default: {},
    }),
  },
  handleContainer: { alignItems: "center", paddingTop: 10, paddingBottom: 6, zIndex: 1 },
  handle: { width: 40, height: 5, borderRadius: 2.5, backgroundColor: "rgba(255,255,255,0.3)" },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
});

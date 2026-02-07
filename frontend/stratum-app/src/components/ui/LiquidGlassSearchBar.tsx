/**
 * LiquidGlassSearchBar
 *
 * iOS: Uses the native `headerSearchBarOptions` from react-navigation /
 * expo-router which renders a real UISearchBar. On iOS 26+ this
 * automatically adopts Liquid Glass in the toolbar placement.
 *
 * Also exports a standalone component for non-header search fields that
 * uses a plain TextInput with dark styling (no callstack glass wrapping).
 *
 * Apple reference: UISearchBar in toolbar — auto Liquid Glass on iOS 26+.
 *
 * Usage (preferred — as Stack.Screen header search):
 *   <Stack.Screen options={{
 *     ...getLiquidGlassNavBarOptions({ title: "Projects" }),
 *     headerSearchBarOptions: getLiquidGlassSearchBarOptions({
 *       placeholder: "Search projects…",
 *       onChangeText: setQuery,
 *     }),
 *   }} />
 *
 * Usage (standalone):
 *   <LiquidGlassSearchBar value={q} onChangeText={setQ} />
 */
import React, { useState, useRef, useCallback } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
  Animated,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ── Native header search bar options helper ─────────────────────────────────

export interface SearchBarOptionsConfig {
  placeholder?: string;
  onChangeText?: (text: string) => void;
  onSearchButtonPress?: (text: string) => void;
  onCancelButtonPress?: () => void;
  autoCapitalize?: "none" | "words" | "sentences" | "characters";
}

/**
 * Returns `headerSearchBarOptions` for Stack.Screen that renders a real
 * native UISearchBar on iOS (auto Liquid Glass on 26+).
 */
export function getLiquidGlassSearchBarOptions(config?: SearchBarOptionsConfig) {
  return {
    placeholder: config?.placeholder ?? "Search…",
    onChangeText: (e: { nativeEvent: { text: string } }) =>
      config?.onChangeText?.(e.nativeEvent.text),
    onSearchButtonPress: config?.onSearchButtonPress,
    onCancelButtonPress: config?.onCancelButtonPress,
    autoCapitalize: config?.autoCapitalize ?? "none",
    tintColor: "#FF2A2A",
    textColor: "#F5F5F5",
    headerIconColor: "#9A9A9A",
    hideWhenScrolling: false,
  };
}

// ── Standalone search bar component ─────────────────────────────────────────

export interface LiquidGlassSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  placeholder?: string;
  showCancelButton?: boolean;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  disabled?: boolean;
}

export function LiquidGlassSearchBar({
  value,
  onChangeText,
  onSubmit,
  onCancel,
  placeholder = "Search…",
  showCancelButton = true,
  height = 44,
  borderRadius = 14,
  style,
  haptic = true,
  disabled = false,
}: LiquidGlassSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const cancelAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (haptic && Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (showCancelButton) {
      Animated.spring(cancelAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 25 }).start();
    }
  }, [haptic, showCancelButton, cancelAnim]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (showCancelButton && !value) {
      Animated.spring(cancelAnim, { toValue: 0, useNativeDriver: true, tension: 300, friction: 25 }).start();
    }
  }, [showCancelButton, value, cancelAnim]);

  const handleCancel = useCallback(() => {
    onChangeText("");
    inputRef.current?.blur();
    Keyboard.dismiss();
    Animated.spring(cancelAnim, { toValue: 0, useNativeDriver: true, tension: 300, friction: 25 }).start();
    onCancel?.();
  }, [onChangeText, cancelAnim, onCancel]);

  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.barContainer, { height, borderRadius }]}>
        <View style={styles.inputRow}>
          <Ionicons name="search" size={18} color={isFocused ? "#FF2A2A" : "#9A9A9A"} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.35)"
            selectionColor="#FF2A2A"
            returnKeyType="search"
            onSubmitEditing={onSubmit}
            onFocus={handleFocus}
            onBlur={handleBlur}
            editable={!disabled}
            style={styles.input}
          />
          {value.length > 0 && (
            <TouchableOpacity onPress={() => onChangeText("")} style={styles.clearButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#9A9A9A" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {showCancelButton && (
        <Animated.View style={{ opacity: cancelAnim, transform: [{ translateX: cancelAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }} pointerEvents={isFocused || value ? "auto" : "none"}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: "row", alignItems: "center" },
  barContainer: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  inputRow: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, color: "#F5F5F5", paddingVertical: Platform.OS === "ios" ? 10 : 8 },
  clearButton: { marginLeft: 8 },
  cancelButton: { marginLeft: 12, paddingVertical: 8 },
  cancelText: { fontSize: 16, color: "#FF2A2A", fontWeight: "500" },
});

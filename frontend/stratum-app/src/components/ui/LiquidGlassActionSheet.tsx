/**
 * LiquidGlassActionSheet
 *
 * iOS: Uses the real native ActionSheetIOS which automatically adopts
 * Liquid Glass styling on iOS 26+ — zero custom rendering on iOS.
 * Android: Custom modal with dark theme styling.
 *
 * Apple reference: UIAlertController (.actionSheet)
 */
import React, { useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  Animated,
  ActionSheetIOS,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

export interface ActionSheetAction {
  key: string;
  label: string;
  /** Icon name (Android only — native iOS sheet uses system chrome) */
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  cancel?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export interface LiquidGlassActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: ActionSheetAction[];
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}

// ── iOS: delegate entirely to native ActionSheetIOS ─────────────────────────
function showNativeActionSheet({
  title,
  message,
  actions,
  onClose,
  haptic,
}: LiquidGlassActionSheetProps) {
  const options = actions.map((a) => a.label);
  const cancelIndex = actions.findIndex((a) => a.cancel);
  const destructiveIndex = actions.findIndex((a) => a.destructive);

  if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

  ActionSheetIOS.showActionSheetWithOptions(
    {
      title,
      message,
      options,
      cancelButtonIndex: cancelIndex >= 0 ? cancelIndex : undefined,
      destructiveButtonIndex:
        destructiveIndex >= 0 ? destructiveIndex : undefined,
    },
    (buttonIndex) => {
      actions[buttonIndex]?.onPress();
      onClose();
    },
  );
}

// ── Android: custom modal ───────────────────────────────────────────────────
function AndroidActionSheet({
  visible,
  onClose,
  title,
  message,
  actions,
  style,
  haptic = true,
}: LiquidGlassActionSheetProps) {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const regularActions = actions.filter((a) => !a.cancel);
  const cancelAction = actions.find((a) => a.cancel);

  const open = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 20 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 150, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [scaleAnim, opacityAnim, onClose]);

  useEffect(() => {
    if (visible) { scaleAnim.setValue(0.95); opacityAnim.setValue(0); open(); }
  }, [visible, open, scaleAnim, opacityAnim]);

  const handlePress = (action: ActionSheetAction) => {
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action.onPress();
    close();
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <TouchableWithoutFeedback onPress={close}>
        <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]} />
      </TouchableWithoutFeedback>
      <Animated.View style={[styles.container, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }, style]} pointerEvents="box-none">
        <View style={styles.group}>
          {(title || message) && (
            <View style={styles.header}>
              {title && <Text style={styles.title}>{title}</Text>}
              {message && <Text style={styles.message}>{message}</Text>}
            </View>
          )}
          {(title || message) && regularActions.length > 0 && <View style={styles.sep} />}
          {regularActions.map((action, idx) => (
            <React.Fragment key={action.key}>
              {idx > 0 && <View style={styles.sep} />}
              <TouchableOpacity onPress={() => handlePress(action)} disabled={action.disabled} style={[styles.actionItem, action.disabled && styles.disabled]} activeOpacity={0.6}>
                {action.icon && <Ionicons name={action.icon} size={22} color={action.destructive ? "#FF4444" : "#F5F5F5"} style={styles.actionIcon} />}
                <Text style={[styles.actionLabel, action.destructive && styles.destructiveLabel]}>{action.label}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
        {cancelAction && (
          <View style={[styles.group, styles.cancelGroup]}>
            <TouchableOpacity onPress={() => handlePress(cancelAction)} style={styles.cancelItem} activeOpacity={0.6}>
              <Text style={styles.cancelLabel}>{cancelAction.label}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Public component ────────────────────────────────────────────────────────
export function LiquidGlassActionSheet(props: LiquidGlassActionSheetProps) {
  const { visible, haptic = true } = props;

  // iOS: fire native sheet when visible flips to true
  useEffect(() => {
    if (Platform.OS === "ios" && visible) {
      showNativeActionSheet({ ...props, haptic });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (Platform.OS === "ios") return null;
  return <AndroidActionSheet {...props} />;
}

// ── Styles (Android only) ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  container: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 10, paddingBottom: 24 },
  group: { overflow: "hidden", backgroundColor: "rgba(30,30,30,0.97)", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.1)", elevation: 8 },
  header: { alignItems: "center", paddingHorizontal: 16, paddingVertical: 16 },
  title: { fontSize: 14, fontWeight: "600", color: "#9A9A9A", textAlign: "center" },
  message: { fontSize: 13, color: "#777", textAlign: "center", marginTop: 4 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.12)" },
  actionItem: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, paddingHorizontal: 20 },
  disabled: { opacity: 0.4 },
  actionIcon: { marginRight: 10 },
  actionLabel: { fontSize: 20, color: "#F5F5F5" },
  destructiveLabel: { color: "#FF4444" },
  cancelGroup: { marginTop: 10 },
  cancelItem: { alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  cancelLabel: { fontSize: 20, fontWeight: "600", color: "#FF2A2A" },
});

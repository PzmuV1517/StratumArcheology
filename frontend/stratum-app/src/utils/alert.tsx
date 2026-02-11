import { Alert, Platform } from "react-native";

/**
 * Platform-aware alert function.
 * On Android: Alert.alert is monkey-patched by AndroidAlertOverride
 *             to show a custom styled in-app notification.
 * On Web:     Dispatches a DOM CustomEvent that CustomAlertOverride listens for.
 *             This bypasses Alert.alert entirely (avoids window.alert fallback).
 * On iOS:     Uses native Alert.alert as-is.
 *
 * This wrapper exists so all existing call-sites keep working.
 */
export const showAlert = (
  title: string,
  message?: string,
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: "default" | "cancel" | "destructive";
  }>,
): void => {
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    typeof CustomEvent !== "undefined"
  ) {
    // Dispatch a DOM event that CustomAlertOverride picks up.
    // This avoids React Native Web's Alert.alert → window.alert() fallback.
    window.dispatchEvent(
      new CustomEvent("stratum-alert", {
        detail: {
          title,
          message,
          buttons:
            buttons && buttons.length > 0 ? buttons : [{ text: "OK" }],
        },
      }),
    );
    return;
  }

  // Android (monkey-patched) and iOS (native)
  Alert.alert(title, message, buttons as any);
};

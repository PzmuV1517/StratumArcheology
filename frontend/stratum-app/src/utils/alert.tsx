import { Alert } from "react-native";

/**
 * Platform-aware alert function.
 * On Android: Alert.alert is monkey-patched by AndroidAlertOverride
 *             to show a custom styled in-app notification.
 * On iOS/Web: Uses native Alert.alert as-is.
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
  Alert.alert(title, message, buttons as any);
};

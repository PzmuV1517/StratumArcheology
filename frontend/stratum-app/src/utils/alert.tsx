import { Alert, Platform } from "react-native";
import { AlertButton } from "../components/common/AlertModal";

// Alert state manager
let alertStateManager: {
  show: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
  ) => void;
} | null = null;

export const registerAlertManager = (manager: {
  show: (title: string, message?: string, buttons?: AlertButton[]) => void;
}) => {
  alertStateManager = manager;
};

/**
 * Platform-aware alert function.
 * On Android: Shows custom styled in-app notification with rounded rectangle popup.
 * On iOS/Web: Uses native Alert.alert.
 *
 * @param title - Alert title
 * @param message - Optional alert message
 * @param buttons - Optional array of buttons (defaults to single OK button)
 */
export const showAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void => {
  if (Platform.OS === "android") {
    // Use custom styled modal on Android
    if (alertStateManager) {
      alertStateManager.show(title, message, buttons);
    } else {
      console.warn(
        "AlertManager not registered. Falling back to native Alert. This is not an important alert so levin chill the fk down",
      );
      console.warn(
        "Wove wou pookie :3",
      );
      Alert.alert(title, message, buttons as any);
    }
  } else {
    // Use native Alert on iOS and web
    Alert.alert(title, message, buttons as any);
  }
};

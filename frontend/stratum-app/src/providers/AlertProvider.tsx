import React, { useState, useEffect } from "react";
import { Platform } from "react-native";
import { AlertModal, AlertButton } from "../components/common/AlertModal";
import { registerAlertManager } from "../utils/alert";

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface AlertProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that manages custom alert state for Android.
 * This wraps the app and displays the AlertModal when showAlert is called on Android.
 */
export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: "",
    message: undefined,
    buttons: undefined,
  });

  useEffect(() => {
    // Only register on Android
    if (Platform.OS === "android") {
      registerAlertManager({
        show: (title: string, message?: string, buttons?: AlertButton[]) => {
          setAlertState({
            visible: true,
            title,
            message,
            buttons,
          });
        },
      });
    }
  }, []);

  const handleDismiss = () => {
    setAlertState({
      visible: false,
      title: "",
      message: undefined,
      buttons: undefined,
    });
  };

  return (
    <>
      {children}
      {Platform.OS === "android" && (
        <AlertModal
          visible={alertState.visible}
          title={alertState.title}
          message={alertState.message}
          buttons={alertState.buttons}
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
};

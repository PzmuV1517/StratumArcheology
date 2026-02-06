import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface AlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onDismiss: () => void;
}

/**
 * Custom styled alert modal for Android.
 * Displays a rounded rectangle popup with consistent styling.
 */
export const AlertModal: React.FC<AlertModalProps> = ({
  visible,
  title,
  message,
  buttons = [],
  onDismiss,
}) => {
  // Default to OK button if none provided
  const alertButtons: AlertButton[] =
    buttons.length > 0
      ? buttons
      : [{ text: "OK", onPress: onDismiss, style: "default" }];

  const handleButtonPress = (button: AlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onDismiss}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.alertContainer}>
            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Message */}
            {message ? <Text style={styles.message}>{message}</Text> : null}

            {/* Buttons */}
            <View
              style={[
                styles.buttonContainer,
                alertButtons.length === 2 && styles.buttonContainerRow,
              ]}
            >
              {alertButtons.map((button, index) => {
                const isCancel = button.style === "cancel";
                const isDestructive = button.style === "destructive";

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      alertButtons.length === 2 && styles.buttonHalf,
                      isCancel && styles.buttonCancel,
                      isDestructive && styles.buttonDestructive,
                      index === 0 && alertButtons.length > 1 && styles.buttonFirst,
                    ]}
                    onPress={() => handleButtonPress(button)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isCancel && styles.buttonTextCancel,
                        isDestructive && styles.buttonTextDestructive,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  alertContainer: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 24,
    minWidth: Math.min(Dimensions.get("window").width - 80, 320),
    maxWidth: 400,
    ...Platform.select({
      android: {
        elevation: 8,
      },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FF2A2A",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#F5F5F5",
    lineHeight: 22,
    marginBottom: 24,
    textAlign: "center",
  },
  buttonContainer: {
    gap: 12,
  },
  buttonContainerRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    backgroundColor: "#FF2A2A",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  buttonHalf: {
    flex: 1,
  },
  buttonFirst: {
    // Add any first button specific styles if needed
  },
  buttonCancel: {
    backgroundColor: "#2C2C2C",
    borderWidth: 1,
    borderColor: "#444444",
  },
  buttonDestructive: {
    backgroundColor: "#D32F2F",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  buttonTextCancel: {
    color: "#AAAAAA",
  },
  buttonTextDestructive: {
    color: "#FFFFFF",
  },
});

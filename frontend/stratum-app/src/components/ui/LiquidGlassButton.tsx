/**
 * LiquidGlassButton
 *
 * A button component with iOS 26 Liquid Glass styling on supported devices.
 * Falls back to a standard styled button on unsupported platforms.
 */
import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  ViewStyle,
  TextStyle,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LiquidGlassView, isLiquidGlassSupported } from "@/src/utils/liquidGlass";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface LiquidGlassButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  style?: ViewStyle;
  textStyle?: TextStyle;
  haptic?: boolean;
}

export function LiquidGlassButton({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  icon,
  iconPosition = "left",
  style,
  textStyle,
  haptic = true,
}: LiquidGlassButtonProps) {
  const handlePress = () => {
    if (haptic && Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const sizeStyles = SIZE_STYLES[size];
  const variantStyles = VARIANT_STYLES[variant];

  // Use real Liquid Glass on iOS 26+, BlurView on older iOS, solid on Android
  const useNativeLiquidGlass = Platform.OS === "ios" && isLiquidGlassSupported;
  const useBlurFallback = Platform.OS === "ios" && !isLiquidGlassSupported;

  const content = (
    <>
      {icon && iconPosition === "left" && (
        <View style={styles.iconLeft}>{icon}</View>
      )}
      <Text
        style={[
          styles.text,
          sizeStyles.text,
          variantStyles.text,
          disabled && styles.textDisabled,
          textStyle,
        ]}
      >
        {title}
      </Text>
      {icon && iconPosition === "right" && (
        <View style={styles.iconRight}>{icon}</View>
      )}
    </>
  );

  if (useNativeLiquidGlass && variant !== "destructive") {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.7}
        style={[
          styles.touchable,
          sizeStyles.container,
          disabled && styles.disabled,
          style,
        ]}
      >
        <LiquidGlassView
          style={[
            styles.glassContainer,
            sizeStyles.container,
            variantStyles.container,
          ]}
          effect="regular"
        >
          {content}
        </LiquidGlassView>
      </TouchableOpacity>
    );
  }

  if (useBlurFallback && variant !== "destructive") {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.7}
        style={[
          styles.touchable,
          sizeStyles.container,
          disabled && styles.disabled,
          style,
        ]}
      >
        <BlurView
          intensity={40}
          tint="dark"
          style={[
            styles.blurContainer,
            sizeStyles.container,
            variantStyles.blurContainer,
          ]}
        >
          {content}
        </BlurView>
      </TouchableOpacity>
    );
  }

  // Android / destructive fallback
  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.solidContainer,
        sizeStyles.container,
        variantStyles.solidContainer,
        disabled && styles.disabled,
        style,
      ]}
    >
      {content}
    </TouchableOpacity>
  );
}

const SIZE_STYLES: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
    },
    text: {
      fontSize: 13,
    },
  },
  md: {
    container: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 14,
    },
    text: {
      fontSize: 15,
    },
  },
  lg: {
    container: {
      paddingVertical: 16,
      paddingHorizontal: 28,
      borderRadius: 18,
    },
    text: {
      fontSize: 17,
    },
  },
};

const VARIANT_STYLES: Record<
  ButtonVariant,
  {
    container?: ViewStyle;
    blurContainer?: ViewStyle;
    solidContainer: ViewStyle;
    text: TextStyle;
  }
> = {
  primary: {
    container: {},
    blurContainer: {
      backgroundColor: "rgba(255, 42, 42, 0.3)",
    },
    solidContainer: {
      backgroundColor: "#FF2A2A",
    },
    text: {
      color: "#FFFFFF",
    },
  },
  secondary: {
    container: {},
    blurContainer: {
      backgroundColor: "rgba(255, 255, 255, 0.15)",
    },
    solidContainer: {
      backgroundColor: "rgba(255, 255, 255, 0.12)",
    },
    text: {
      color: "#F5F5F5",
    },
  },
  ghost: {
    container: {},
    blurContainer: {
      backgroundColor: "transparent",
    },
    solidContainer: {
      backgroundColor: "transparent",
    },
    text: {
      color: "#FF2A2A",
    },
  },
  destructive: {
    solidContainer: {
      backgroundColor: "#FF4444",
    },
    text: {
      color: "#FFFFFF",
    },
  },
};

const styles = StyleSheet.create({
  touchable: {
    overflow: "hidden",
  },
  glassContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  blurContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  solidContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  textDisabled: {
    opacity: 0.5,
  },
  disabled: {
    opacity: 0.5,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});

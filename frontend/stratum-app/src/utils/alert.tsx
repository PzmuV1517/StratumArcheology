/**
 * @file
 * Cross-platform alert utility.
 *
 * Provides a unified alert dialog API that works across
 * web and native platforms.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
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
  buttons?: {
    text: string;
    onPress?: () => void;
    style?: "default" | "cancel" | "destructive";
  }[],
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
          buttons: buttons && buttons.length > 0 ? buttons : [{ text: "OK" }],
        },
      }),
    );
    return;
  }

  // Android (monkey-patched) and iOS (native)
  Alert.alert(title, message, buttons as any);
};

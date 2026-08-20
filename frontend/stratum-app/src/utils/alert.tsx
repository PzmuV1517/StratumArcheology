/**
 * @file
 * Cross-platform alert utility.
 *
 * Provides a unified alert dialog API that works across
 * web and native platforms.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { Alert, Platform } from "react-native";

/**
 * Converts any error thrown by a service call into a human-readable string.
 *
 * FastAPI/Pydantic v2 returns 422 bodies shaped as:
 *   { detail: [{ type, loc, msg, input, ctx }, ...] }
 *
 * Calling `error?.detail` in a catch block yields that array, which React
 * refuses to render as a child.  This helper always returns a plain string.
 */
export function extractErrorMessage(
  error: unknown,
  fallback = "Something went wrong.",
): string {
  if (!error) return fallback;
  if (typeof error === "string") return error || fallback;

  const e = error as any;

  // Pydantic v2 array: [{ msg, loc, type, ... }]
  if (Array.isArray(e)) {
    const msgs = e
      .map((item: any) => {
        if (item && typeof item === "object") {
          const loc = Array.isArray(item.loc) ? item.loc.join(" → ") : "";
          const msg = typeof item.msg === "string" ? item.msg : "";
          return loc ? `${loc}: ${msg}` : msg;
        }
        return String(item);
      })
      .filter(Boolean);
    return msgs.length ? msgs.join("\n") : fallback;
  }

  // { detail: [...] }  or  { detail: "string" }
  if (e.detail !== undefined) return extractErrorMessage(e.detail, fallback);

  // Plain Error or { message }
  if (typeof e.message === "string" && e.message) return e.message;

  return fallback;
}

/**
 * Platform-aware alert function.
 * On Android: Alert.alert is monkey-patched by AndroidAlertOverride
 *             to show a custom styled in-app notification.
 * On Web:     Dispatches a DOM CustomEvent that CustomAlertOverride listens for.
 *             This bypasses Alert.alert entirely (avoids window.alert fallback).
 * On iOS:     Uses native Alert.alert as-is.
 *
 * This wrapper exists so all existing call-sites keep working.
 * The `message` parameter is coerced to a string so non-string values
 * (e.g. Pydantic validation error arrays) never reach React's renderer.
 */
export const showAlert = (
  title: string,
  message?: unknown,
  buttons?: {
    text: string;
    onPress?: () => void;
    style?: "default" | "cancel" | "destructive";
  }[],
): void => {
  const safeMessage =
    message === undefined || message === null
      ? undefined
      : typeof message === "string"
        ? message
        : extractErrorMessage(message);

  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    typeof CustomEvent !== "undefined"
  ) {
    window.dispatchEvent(
      new CustomEvent("stratum-alert", {
        detail: {
          title,
          message: safeMessage,
          buttons: buttons && buttons.length > 0 ? buttons : [{ text: "OK" }],
        },
      }),
    );
    return;
  }

  Alert.alert(title, safeMessage, buttons as any);
};

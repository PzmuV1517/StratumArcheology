/**
 * @file
 * Onboarding prompt component.
 *
 * Displays a contextual help tooltip during the user's
 * first-time experience.
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
import React from "react";
import { Platform } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";

/* ─────────────────────────────────────────────────────────────
 *  OnboardingPrompt
 *
 *  A centred modal popup (web-only) that appears once for new
 *  users asking whether they'd like an app tour.
 *
 *  If they decline they're told about Settings → Replay Tutorial.
 * ────────────────────────────────────────────────────────────── */

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const OnboardingPrompt: React.FC<Props> = ({
  visible,
  onAccept,
  onDecline,
}) => {
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const overlayColor = isDarkMode ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.2)";
  const cardBackground = isDarkMode ? "#1A1A1A" : "#FFFFFF";
  const cardBorder = isDarkMode ? "#2A2A2A" : "#D9D9D9";
  const cardShadow = isDarkMode ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.18)";
  const titleColor = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const subtitleColor = isDarkMode ? "#999" : "#5F5F5F";
  const skipBorderColor = isDarkMode ? "#333" : "#CFCFCF";
  const skipTextColor = isDarkMode ? "#AAA" : "#666";
  const hintColor = isDarkMode ? "#666" : "#6F6F6F";

  if (!visible || Platform.OS !== "web") return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: overlayColor,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div
        style={{
          width: "90%",
          maxWidth: 420,
          backgroundColor: cardBackground,
          borderRadius: 20,
          padding: 32,
          textAlign: "center",
          border: `1px solid ${cardBorder}`,
          boxShadow: `0 12px 48px ${cardShadow}`,
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>

        {/* Title */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: titleColor,
            marginBottom: 8,
          }}
        >
          Welcome to STRATUM!
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 15,
            color: subtitleColor,
            lineHeight: "22px",
            marginBottom: 28,
          }}
        >
          Would you like a quick tour of the app? It only takes a minute and you can
          replay it any time from{" "}
          <span style={{ color: "#FF2A2A", fontWeight: 600 }}>Settings</span>.
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onDecline}
            style={{
              flex: 1,
              padding: "12px 0",
              border: `1px solid ${skipBorderColor}`,
              borderRadius: 12,
              background: "transparent",
              color: skipTextColor,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Skip for now
          </button>
          <button
            onClick={onAccept}
            style={{
              flex: 1,
              padding: "12px 0",
              border: "none",
              borderRadius: 12,
              background: "#FF2A2A",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Show me around
          </button>
        </div>

        {/* Hint */}
        <div
          style={{
            fontSize: 12,
            color: hintColor,
            marginTop: 16,
          }}
        >
          You can always start the tutorial from the Settings tab.
        </div>
      </div>
    </div>
  );
};

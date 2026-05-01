/**
 * @file
 * Reusable card component.
 *
 * A themed container with shadow, border radius, and
 * consistent padding.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React from "react";
import { View, Text, StyleSheet, ViewStyle, TouchableOpacity } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  footer?: React.ReactNode;
}

/**
 * Themed card container with optional title, subtitle, footer, and press action.
 * @param props - Component props
 * @returns The rendered component
 */
export default function Card({
  title,
  subtitle,
  children,
  style,
  onPress,
  footer,
}: CardProps) {
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const cardBackground = isDarkMode ? "#1C1C1E" : "#FFFFFF";
  const borderColor = isDarkMode ? "#2C2C2E" : "#D9D9D9";
  const titleColor = isDarkMode ? "#FFFFFF" : "#1A1A1A";
  const subtitleColor = isDarkMode ? "#8E8E93" : "#666666";
  const footerBackground = isDarkMode ? "#0C0C0E" : "#F3F3F3";

  const content = (
    <View
      style={[styles.card, { backgroundColor: cardBackground, borderColor }, style]}
    >
      {(title || subtitle) && (
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          {title && (
            <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
          )}
          {subtitle && (
            <Text style={[styles.subtitle, { color: subtitleColor }]}>
              {subtitle}
            </Text>
          )}
        </View>
      )}
      <View style={styles.body}>{children}</View>
      {footer && (
        <View
          style={[
            styles.footer,
            { borderTopColor: borderColor, backgroundColor: footerBackground },
          ]}
        >
          {footer}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  body: {
    padding: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});

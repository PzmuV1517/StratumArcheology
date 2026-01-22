import React from "react";
import { View, Text, StyleSheet, ViewStyle, TouchableOpacity } from "react-native";

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  footer?: React.ReactNode;
}

export default function Card({
  title,
  subtitle,
  children,
  style,
  onPress,
  footer,
}: CardProps) {
  const content = (
    <View style={[styles.card, style]}>
      {(title || subtitle) && (
        <View style={styles.header}>
          {title && <Text style={styles.title}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}
      <View style={styles.body}>{children}</View>
      {footer && <View style={styles.footer}>{footer}</View>}
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
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2C2C2E",
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 4,
  },
  body: {
    padding: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#2C2C2E",
    backgroundColor: "#0C0C0E",
  },
});

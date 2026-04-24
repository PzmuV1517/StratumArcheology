/**
 * @file
 * Single chat message bubble.
 *
 * Renders a message with sender name, avatar, timestamp,
 * edit/delete actions for own messages, @mention highlights,
 * and clickable sender avatar/name for profile navigation.
 *
 * Copyright (c) 2026 Andrei Banu & Levin Mircea
 */
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ChatMessage } from "../../services/chatService.types";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface ChatBubbleProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  isGrouped?: boolean;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onReply?: (message: ChatMessage) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return time;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

export default function ChatBubble({
  message,
  isOwnMessage,
  isGrouped,
  onEdit,
  onDelete,
  onReply,
}: ChatBubbleProps) {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const lockIconColor = isOwnMessage
    ? "rgba(255,255,255,0.65)"
    : isDarkMode
      ? "rgba(255,255,255,0.55)"
      : "rgba(0,0,0,0.4)";

  const [showActions, setShowActions] = useState(false);
  const router = useRouter();

  /** Render message content with @mention highlights */
  const renderedContent = useMemo(() => {
    if (!message.mentions?.length) {
      return (
        <Text style={[styles.content, isOwnMessage && styles.contentOwn]}>
          {message.content}
        </Text>
      );
    }
    // Build a regex from mention names to highlight them
    const mentionNames = message.mentions.map((m) => `@${m.name}`);
    const pattern = new RegExp(
      `(${mentionNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
      "gi",
    );
    const parts = message.content.split(pattern);
    return (
      <Text style={[styles.content, isOwnMessage && styles.contentOwn]}>
        {parts.map((part, i) => {
          const isMention = mentionNames.some(
            (n) => n.toLowerCase() === part.toLowerCase(),
          );
          if (isMention) {
            return (
              <Text
                key={i}
                style={[styles.mention, isOwnMessage && styles.mentionOwn]}
              >
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  }, [isOwnMessage, message.content, message.mentions, styles]);

  const navigateToProfile = () => {
    router.push({
      pathname: "/profile/[userId]",
      params: { userId: message.sender_id },
    });
  };

  if (message.is_deleted) {
    return (
      <View style={[styles.row, isOwnMessage && styles.rowOwn]}>
        <View style={[styles.bubble, styles.bubbleDeleted]}>
          <Text style={styles.deletedText}>This message was deleted</Text>
        </View>
      </View>
    );
  }

  const handleLongPress = () => {
    if (Platform.OS === "web") {
      setShowActions((p) => !p);
      return;
    }
    const buttons: any[] = [];
    if (onReply) buttons.push({ text: "Reply", onPress: () => onReply(message) });
    if (isOwnMessage && onEdit)
      buttons.push({
        text: "Edit",
        onPress: () => onEdit(message.id, message.content),
      });
    if (isOwnMessage && onDelete)
      buttons.push({
        text: "Delete",
        style: "destructive",
        onPress: () => onDelete(message.id),
      });
    buttons.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Message", undefined, buttons);
  };

  const initial = (message.sender_name ?? "?")[0].toUpperCase();

  return (
    <View
      style={[
        styles.row,
        isOwnMessage && styles.rowOwn,
        isGrouped && styles.rowGrouped,
      ]}
    >
      {/* Avatar — tap to view profile (hidden when grouped) */}
      {!isOwnMessage &&
        (isGrouped ? (
          <View style={styles.avatarSpacer} />
        ) : (
          <TouchableOpacity onPress={navigateToProfile} style={styles.avatar}>
            {message.sender_photo ? (
              <Image
                source={{ uri: message.sender_photo }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </TouchableOpacity>
        ))}

      <TouchableOpacity
        onLongPress={handleLongPress}
        onPress={Platform.OS === "web" ? handleLongPress : undefined}
        activeOpacity={0.8}
        style={[
          styles.bubble,
          isOwnMessage ? styles.bubbleOwn : styles.bubbleOther,
          // Only first message in group gets the tail; grouped = fully rounded
          isGrouped &&
            (isOwnMessage ? styles.bubbleOwnGrouped : styles.bubbleOtherGrouped),
        ]}
      >
        {!isOwnMessage && !isGrouped && (
          <TouchableOpacity onPress={navigateToProfile}>
            <Text style={styles.senderName}>{message.sender_name ?? "Unknown"}</Text>
          </TouchableOpacity>
        )}
        {renderedContent}
        <View style={styles.meta}>
          {message._e2ee && (
            <Ionicons name="lock-closed" size={10} color={lockIconColor} />
          )}
          <Text style={[styles.time, isOwnMessage && styles.timeOwn]}>
            {formatTime(message.created_at)}
          </Text>
          {message.edited_at && (
            <Text style={[styles.edited, isOwnMessage && styles.editedOwn]}>
              (edited)
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Inline actions (web) */}
      {showActions && Platform.OS === "web" && (
        <View style={styles.actionsRow}>
          {onReply && (
            <TouchableOpacity
              onPress={() => {
                onReply(message);
                setShowActions(false);
              }}
            >
              <Text style={styles.actionBtn}>Reply</Text>
            </TouchableOpacity>
          )}
          {isOwnMessage && onEdit && (
            <TouchableOpacity
              onPress={() => {
                onEdit(message.id, message.content);
                setShowActions(false);
              }}
            >
              <Text style={styles.actionBtn}>Edit</Text>
            </TouchableOpacity>
          )}
          {isOwnMessage && onDelete && (
            <TouchableOpacity
              onPress={() => {
                onDelete(message.id);
                setShowActions(false);
              }}
            >
              <Text style={[styles.actionBtn, { color: "#FF3B30" }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      marginBottom: 8,
      paddingHorizontal: 8,
      alignItems: "flex-end",
    },
    rowOwn: {
      justifyContent: "flex-end",
    },
    rowGrouped: {
      marginBottom: 2,
    },
    avatarSpacer: {
      width: 32, // 24 avatar + 8 marginRight
    },
    avatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: isDarkMode ? "#2A2A2A" : "#E8E8E8",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    avatarText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "600",
    },
    avatarImage: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    bubble: {
      maxWidth: "75%",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleOwn: {
      backgroundColor: "#FF2A2A",
      borderBottomRightRadius: 2,
    },
    bubbleOwnGrouped: {
      borderBottomRightRadius: 16,
    },
    bubbleOther: {
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderBottomLeftRadius: 2,
      borderWidth: isDarkMode ? 0 : 1,
      borderColor: isDarkMode ? "transparent" : "#D9D9D9",
    },
    bubbleOtherGrouped: {
      borderBottomLeftRadius: 16,
    },
    bubbleDeleted: {
      backgroundColor: isDarkMode ? "#0E0E0E" : "#F0F0F0",
      opacity: 0.6,
    },
    senderName: {
      fontSize: 12,
      fontWeight: "600",
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginBottom: 2,
    },
    content: {
      fontSize: 15,
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      lineHeight: 20,
    },
    contentOwn: {
      color: "#FFFFFF",
    },
    meta: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      gap: 6,
    },
    time: {
      fontSize: 11,
      color: isDarkMode ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)",
    },
    timeOwn: {
      color: "rgba(255,255,255,0.75)",
    },
    edited: {
      fontSize: 11,
      color: isDarkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)",
      fontStyle: "italic",
    },
    editedOwn: {
      color: "rgba(255,255,255,0.65)",
    },
    deletedText: {
      fontSize: 14,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontStyle: "italic",
    },
    mention: {
      color: "#FF2A2A",
      fontWeight: "600",
    },
    mentionOwn: {
      color: "#FFE3E3",
      textDecorationLine: "underline",
    },
    actionsRow: {
      flexDirection: "row",
      gap: 8,
      marginLeft: 8,
      alignItems: "center",
    },
    actionBtn: {
      fontSize: 13,
      color: "#FF2A2A",
      paddingVertical: 4,
      paddingHorizontal: 6,
    },
  });

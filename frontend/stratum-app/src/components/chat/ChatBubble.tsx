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
import { useRouter } from "expo-router";
import type { ChatMessage, MentionRef } from "../../services/chatService.types";

interface ChatBubbleProps {
  message: ChatMessage;
  isOwnMessage: boolean;
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
  onEdit,
  onDelete,
  onReply,
}: ChatBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const router = useRouter();

  /** Render message content with @mention highlights */
  const renderedContent = useMemo(() => {
    if (!message.mentions?.length) {
      return <Text style={styles.content}>{message.content}</Text>;
    }
    // Build a regex from mention names to highlight them
    const mentionNames = message.mentions.map((m) => `@${m.name}`);
    const pattern = new RegExp(`(${mentionNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})`, "gi");
    const parts = message.content.split(pattern);
    return (
      <Text style={styles.content}>
        {parts.map((part, i) => {
          const isMention = mentionNames.some(
            (n) => n.toLowerCase() === part.toLowerCase()
          );
          if (isMention) {
            return (
              <Text key={i} style={styles.mention}>
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  }, [message.content, message.mentions]);

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
      buttons.push({ text: "Edit", onPress: () => onEdit(message.id, message.content) });
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
    <View style={[styles.row, isOwnMessage && styles.rowOwn]}>
      {/* Avatar — tap to view profile */}
      {!isOwnMessage && (
        <TouchableOpacity onPress={navigateToProfile} style={styles.avatar}>
          {message.sender_photo ? (
            <Image source={{ uri: message.sender_photo }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initial}</Text>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onLongPress={handleLongPress}
        onPress={Platform.OS === "web" ? handleLongPress : undefined}
        activeOpacity={0.8}
        style={[styles.bubble, isOwnMessage ? styles.bubbleOwn : styles.bubbleOther]}
      >
        {!isOwnMessage && (
          <TouchableOpacity onPress={navigateToProfile}>
            <Text style={styles.senderName}>{message.sender_name ?? "Unknown"}</Text>
          </TouchableOpacity>
        )}
        {renderedContent}
        <View style={styles.meta}>
          {message._e2ee && <Text style={styles.e2eeBadge}>🔒</Text>}
          <Text style={styles.time}>{formatTime(message.created_at)}</Text>
          {message.edited_at && <Text style={styles.edited}>(edited)</Text>}
        </View>
      </TouchableOpacity>

      {/* Inline actions (web) */}
      {showActions && Platform.OS === "web" && (
        <View style={styles.actionsRow}>
          {onReply && (
            <TouchableOpacity onPress={() => { onReply(message); setShowActions(false); }}>
              <Text style={styles.actionBtn}>↩ Reply</Text>
            </TouchableOpacity>
          )}
          {isOwnMessage && onEdit && (
            <TouchableOpacity
              onPress={() => { onEdit(message.id, message.content); setShowActions(false); }}
            >
              <Text style={styles.actionBtn}>✏️ Edit</Text>
            </TouchableOpacity>
          )}
          {isOwnMessage && onDelete && (
            <TouchableOpacity
              onPress={() => { onDelete(message.id); setShowActions(false); }}
            >
              <Text style={[styles.actionBtn, { color: "#FF3B30" }]}>🗑 Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginBottom: 8,
    paddingHorizontal: 12,
    alignItems: "flex-end",
  },
  rowOwn: {
    justifyContent: "flex-end",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  bubble: {
    maxWidth: "75%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    backgroundColor: "#FF2A2A",
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: "#1A1A1A",
    borderBottomLeftRadius: 4,
  },
  bubbleDeleted: {
    backgroundColor: "#0E0E0E",
    opacity: 0.6,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9A9A9A",
    marginBottom: 2,
  },
  content: {
    fontSize: 15,
    color: "#F5F5F5",
    lineHeight: 20,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  time: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
  },
  edited: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontStyle: "italic",
  },
  e2eeBadge: {
    fontSize: 10,
  },
  deletedText: {
    fontSize: 14,
    color: "#9A9A9A",
    fontStyle: "italic",
  },
  mention: {
    color: "#FF2A2A",
    fontWeight: "600",
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

/**
 * @file
 * Single chat message bubble.
 *
 * Renders a message with sender name, avatar initial, timestamp,
 * edit/delete actions for own messages, and reply-to preview.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 */
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import type { ChatMessage } from "../../services/chatService.types";

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
      {/* Avatar */}
      {!isOwnMessage && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      )}

      <TouchableOpacity
        onLongPress={handleLongPress}
        onPress={Platform.OS === "web" ? handleLongPress : undefined}
        activeOpacity={0.8}
        style={[styles.bubble, isOwnMessage ? styles.bubbleOwn : styles.bubbleOther]}
      >
        {!isOwnMessage && (
          <Text style={styles.senderName}>{message.sender_name ?? "Unknown"}</Text>
        )}
        <Text style={styles.content}>{message.content}</Text>
        <View style={styles.meta}>
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
    backgroundColor: "#3A3A3C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  bubble: {
    maxWidth: "75%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: "#2C2C2E",
    borderBottomLeftRadius: 4,
  },
  bubbleDeleted: {
    backgroundColor: "#1C1C1E",
    opacity: 0.6,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    marginBottom: 2,
  },
  content: {
    fontSize: 15,
    color: "#FFFFFF",
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
  deletedText: {
    fontSize: 14,
    color: "#8E8E93",
    fontStyle: "italic",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginLeft: 8,
    alignItems: "center",
  },
  actionBtn: {
    fontSize: 13,
    color: "#007AFF",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
});

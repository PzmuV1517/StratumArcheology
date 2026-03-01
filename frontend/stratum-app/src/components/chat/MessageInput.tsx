/**
 * @file
 * Chat message input bar with send button.
 *
 * Features: typing indicator emission, reply-to preview,
 * multiline expansion, and send on Enter.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 */
import React, { useState, useRef } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from "react-native";
import type { ChatMessage } from "../../services/chatService.types";

interface MessageInputProps {
  onSend: (content: string, replyToId?: string) => void;
  onTyping?: () => void;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
  placeholder?: string;
}

export default function MessageInput({
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
  placeholder = "Type a message…",
}: MessageInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleSend = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t, replyTo?.id);
    setText("");
    onCancelReply?.();
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    // Send on Enter (desktop), Shift+Enter for newline
    if (Platform.OS === "web" && e.nativeEvent.key === "Enter") {
      // @ts-ignore — web-only shiftKey
      if (!(e.nativeEvent as any).shiftKey) {
        e.preventDefault?.();
        handleSend();
      }
    }
  };

  const handleChange = (t: string) => {
    setText(t);
    onTyping?.();
  };

  return (
    <View style={styles.wrapper}>
      {/* Reply preview banner */}
      {replyTo && (
        <View style={styles.replyBanner}>
          <View style={styles.replyBar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.replyName}>{replyTo.sender_name ?? "Someone"}</Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {replyTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={onCancelReply} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.replyCancel}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.row}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={handleChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          placeholderTextColor="#8E8E93"
          multiline
          maxLength={4000}
          selectionColor="#007AFF"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!text.trim()}
          style={[styles.sendBtn, !!text.trim() && styles.sendBtnActive]}
        >
          <Text style={[styles.sendText, !!text.trim() && styles.sendTextActive]}>
            ↑
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#3A3A3C",
    backgroundColor: "#1C1C1E",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#2C2C2E",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: "#FFFFFF",
    maxHeight: 120,
    ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}),
  } as any,
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3A3A3C",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnActive: {
    backgroundColor: "#007AFF",
  },
  sendText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#8E8E93",
  },
  sendTextActive: {
    color: "#FFFFFF",
  },
  // Reply banner
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#2C2C2E",
    gap: 8,
  },
  replyBar: {
    width: 3,
    height: "100%",
    backgroundColor: "#007AFF",
    borderRadius: 2,
  } as any,
  replyName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#007AFF",
  },
  replyText: {
    fontSize: 13,
    color: "#8E8E93",
  },
  replyCancel: {
    fontSize: 16,
    color: "#8E8E93",
    paddingHorizontal: 4,
  },
});

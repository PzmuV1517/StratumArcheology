/**
 * @file
 * Chat message input bar with @mention autocomplete.
 *
 * Features: typing indicator emission, reply-to preview,
 * multiline expansion, @mention popup, and send on Enter.
 *
 * Copyright (c) 2026 Andrei Banu & Levin Mircea
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  FlatList,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from "react-native";
import type { ChatMessage, MentionRef, Mentionable } from "../../services/chatService.types";
import { chatService } from "../../services/chatService";

interface MessageInputProps {
  onSend: (content: string, replyToId?: string, mentions?: MentionRef[]) => void;
  onTyping?: () => void;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
  placeholder?: string;
  /** Required for @mention autocomplete. */
  projectId?: string;
  /** Disable input and send button (e.g. while channels are loading). */
  disabled?: boolean;
}

export default function MessageInput({
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
  placeholder = "Type a message…",
  projectId,
  disabled = false,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);
  /** @mention autocomplete state */
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<Mentionable>({ users: [], groups: [] });
  const [pendingMentions, setPendingMentions] = useState<MentionRef[]>([]);
  const mentionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Detect @ trigger in text */
  const detectMention = useCallback((input: string) => {
    // Find the last @ that starts after a space or at the beginning
    const match = input.match(/@(\w{0,30})$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  }, []);

  /** Fetch mentionables when query changes */
  useEffect(() => {
    if (mentionQuery === null || !projectId) {
      setMentionResults({ users: [], groups: [] });
      return;
    }
    if (mentionDebounce.current) clearTimeout(mentionDebounce.current);
    mentionDebounce.current = setTimeout(async () => {
      const results = await chatService.getMentionables(projectId, mentionQuery);
      setMentionResults(results);
    }, 200);
  }, [mentionQuery, projectId]);

  /** Insert a mention into the text */
  const insertMention = useCallback((name: string, ref: MentionRef) => {
    setText((prev) => {
      const atIndex = prev.lastIndexOf("@");
      if (atIndex === -1) return prev;
      return prev.substring(0, atIndex) + `@${name} `;
    });
    setPendingMentions((prev) => [...prev, ref]);
    setMentionQuery(null);
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t, replyTo?.id, pendingMentions.length > 0 ? pendingMentions : undefined);
    setText("");
    setPendingMentions([]);
    onCancelReply?.();
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
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
    detectMention(t);
    onTyping?.();
  };

  const showMentions =
    mentionQuery !== null &&
    (mentionResults.users.length > 0 || mentionResults.groups.length > 0);

  return (
    <View style={styles.wrapper}>
      {/* @mention autocomplete popup */}
      {showMentions && (
        <View style={styles.mentionPopup}>
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={[
              ...mentionResults.users.map((u) => ({
                key: `user-${u.id}`,
                label: u.display_name + (u.username ? ` (@${u.username})` : ""),
                ref: { type: "user" as const, id: u.id, name: u.username || u.display_name },
              })),
              ...mentionResults.groups.map((g) => ({
                key: `group-${g.id}`,
                label: `group: ${g.name}`,
                ref: { type: "group" as const, id: g.id, name: g.name },
              })),
            ]}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.mentionItem}
                onPress={() => insertMention(item.ref.name, item.ref)}
              >
                <Text style={styles.mentionText}>{item.label}</Text>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 180 }}
          />
        </View>
      )}

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

      <View style={[styles.row, disabled && styles.rowDisabled]}>
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
          editable={!disabled}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!text.trim() || disabled}
          style={[styles.sendBtn, !!text.trim() && !disabled && styles.sendBtnActive]}
        >
          <Text style={[styles.sendText, !!text.trim() && !disabled && styles.sendTextActive]}>
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
  rowDisabled: {
    opacity: 0.4,
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
  /* Reply banner */
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
  /* @mention popup */
  mentionPopup: {
    backgroundColor: "#2C2C2E",
    borderTopWidth: 1,
    borderTopColor: "#3A3A3C",
    borderRadius: 12,
    marginHorizontal: 8,
    marginBottom: 4,
    overflow: "hidden",
  },
  mentionItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#3A3A3C",
  },
  mentionText: {
    fontSize: 14,
    color: "#F5F5F5",
  },
});

/**
 * @file
 * Direct message conversation screen.
 *
 * Full-screen 1-on-1 chat view, identified by the other user's ID
 * in the route param. Accessible from the Messages tab.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { useChat } from "@/src/hooks/useChat";
import { ChatBubble, MessageInput, TypingIndicator } from "@/src/components/chat";
import type { ChatMessage } from "@/src/services/chatService.types";
import api from "@/src/services/api";

export default function DirectMessageScreen() {
  const { userId: otherUserId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const {
    messages,
    isLoading,
    hasMore,
    typingUsers,
    sendMessage,
    editMessage,
    deleteMessage,
    loadMore,
    sendTyping,
  } = useChat({ otherUserId });

  const listRef = useRef<FlatList>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [otherUserName, setOtherUserName] = useState<string>("…");

  // Resolve other user's display name
  useEffect(() => {
    if (!otherUserId) return;
    (async () => {
      try {
        const res = await api.get(`/users/${otherUserId}`);
        setOtherUserName(res.data.display_name || res.data.email || "User");
      } catch {
        setOtherUserName("User");
      }
    })();
  }, [otherUserId]);

  const handleSend = useCallback(
    (content: string, replyToId?: string) => {
      sendMessage(content, replyToId);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    },
    [sendMessage],
  );

  const handleEdit = useCallback(
    (messageId: string, currentContent: string) => {
      if (Platform.OS !== "web") {
        const { Alert } = require("react-native");
        Alert.prompt?.(
          "Edit message",
          undefined,
          (text: string) => {
            if (text?.trim()) editMessage(messageId, text.trim());
          },
          "plain-text",
          currentContent,
        );
      } else {
        const text = window.prompt("Edit message", currentContent);
        if (text?.trim()) editMessage(messageId, text.trim());
      }
    },
    [editMessage],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <ChatBubble
        message={item}
        isOwnMessage={item.sender_id === user?.id}
        onEdit={handleEdit}
        onDelete={deleteMessage}
        onReply={setReplyTo}
      />
    ),
    [user?.id, handleEdit, deleteMessage],
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {(otherUserName ?? "?")[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.headerName} numberOfLines={1}>
            {otherUserName}
          </Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onScroll={(e) => {
            if (e.nativeEvent.contentOffset.y < 50 && hasMore && !isLoading) {
              loadMore();
            }
          }}
          scrollEventThrottle={200}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          ListHeaderComponent={
            isLoading ? (
              <ActivityIndicator color="#8E8E93" style={{ marginVertical: 12 }} />
            ) : null
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>👋</Text>
                <Text style={styles.emptyTitle}>
                  Start a conversation with {otherUserName}
                </Text>
              </View>
            ) : null
          }
        />

        <TypingIndicator names={typingUsers} />

        <MessageInput
          onSend={handleSend}
          onTyping={sendTyping}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          placeholder={`Message ${otherUserName}…`}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#111111",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2A2A2A",
    backgroundColor: "#1A1A1A",
  },
  backBtn: {
    fontSize: 32,
    color: "#007AFF",
    paddingRight: 8,
    lineHeight: 32,
  },
  headerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2C2C2E",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  headerName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#F5F5F5",
    maxWidth: 200,
  },
  list: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 120,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 22,
  },
});

/**
 * @file
 * Per-project chat room (Slack #channel equivalent).
 *
 * Full-screen chat view embedded as a project tab.
 * Uses Socket.IO for real-time messages and REST for
 * paginated history on scroll.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 */
import React, { useCallback, useRef, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useAuth } from "@/src/contexts/AuthContext";
import { useChat } from "@/src/hooks/useChat";
import { ChatBubble, MessageInput, TypingIndicator } from "@/src/components/chat";
import type { ChatMessage } from "@/src/services/chatService.types";

export default function ProjectChatScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
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
  } = useChat({ projectId });

  const listRef = useRef<FlatList>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const handleSend = useCallback(
    (content: string, replyToId?: string) => {
      sendMessage(content, replyToId);
      // Scroll to bottom after send
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    },
    [sendMessage],
  );

  const handleEdit = useCallback(
    (messageId: string, _currentContent: string) => {
      // For simplicity, prompt with an alert on native; inline on web later
      if (Platform.OS !== "web") {
        const { Alert } = require("react-native");
        Alert.prompt?.(
          "Edit message",
          undefined,
          (text: string) => {
            if (text?.trim()) editMessage(messageId, text.trim());
          },
          "plain-text",
          _currentContent,
        );
      } else {
        const text = window.prompt("Edit message", _currentContent);
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
    <KeyboardAvoidingView
      style={[styles.container, { paddingBottom: tabBarHeight }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Messages list */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onStartReached={() => {
          if (hasMore && !isLoading) loadMore();
        }}
        onStartReachedThreshold={0.3}
        // Fallback: detect scroll near top
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
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>Project Chat</Text>
              <Text style={styles.emptyText}>
                Send the first message to your team!
              </Text>
            </View>
          ) : null
        }
      />

      {/* Typing indicator */}
      <TypingIndicator names={typingUsers} />

      {/* Input bar */}
      <MessageInput
        onSend={handleSend}
        onTyping={sendTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        placeholder="Message your team…"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  list: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 20,
  },
});

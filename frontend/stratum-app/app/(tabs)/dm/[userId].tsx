/**
 * @file
 * Direct message conversation screen.
 *
 * 1-on-1 chat view within the tab layout, identified by the other user's ID.
 * Integrated with the sidebar navigation.
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
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/hooks/useChat";
import { ChatBubble, MessageInput, TypingIndicator } from "@/components/chat";
import type { ChatMessage } from "@/services/chatService.types";
import api from "@/services/api";

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
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [otherUserName, setOtherUserName] = useState<string>("…");
  const [otherUserPhoto, setOtherUserPhoto] = useState<string | null>(null);

  // Resolve other user's display name and photo
  useEffect(() => {
    if (!otherUserId) return;
    (async () => {
      try {
        const res = await api.get(`/users/${otherUserId}`);
        setOtherUserName(res.data.display_name || res.data.email || "User");
        setOtherUserPhoto(res.data.profile_photo || null);
      } catch {
        setOtherUserName("User");
        setOtherUserPhoto(null);
      }
    })();
  }, [otherUserId]);

  const handleSend = useCallback(
    (content: string, replyToId?: string) => {
      if (editingMessage) {
        // Edit existing message
        editMessage(editingMessage.id, content);
        setEditingMessage(null);
      } else {
        // Send new message
        sendMessage(content, replyToId);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    [sendMessage, editMessage, editingMessage],
  );

  const handleEdit = useCallback(
    (messageId: string, currentContent: string) => {
      // Find the message and set it for editing
      const msg = messages.find(m => m.id === messageId);
      if (msg) {
        setEditingMessage(msg);
        setReplyTo(null); // Clear reply when editing
      }
    },
    [messages],
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
    <View style={styles.container}>
      <View style={styles.contentWrapper}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.push("/(tabs)/messages" as any)} hitSlop={12}>
              <Text style={styles.backButton}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{otherUserName}</Text>
            <View style={{ width: 32 }} />
          </View>
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
                <ActivityIndicator color="#9A9A9A" style={{ marginVertical: 12 }} />
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
            editingMessage={editingMessage}
            onCancelEdit={() => setEditingMessage(null)}
            placeholder={`Message ${otherUserName}…`}
          />
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  contentWrapper: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 1200 : undefined,
    alignSelf: "center",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "web" ? 8 : 60,
    paddingBottom: 16,
    backgroundColor: "#111111",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    fontSize: 32,
    color: "#FF2A2A",
    lineHeight: 32,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#F5F5F5",
    letterSpacing: 0.5,
  },
  list: {
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
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
    color: "#9A9A9A",
    textAlign: "center",
    lineHeight: 22,
  },
});

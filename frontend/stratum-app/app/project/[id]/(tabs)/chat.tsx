/**
 * @file
 * Per-project chat with Slack-like channels.
 *
 * Shows a channel list sidebar (drawer) and the active channel's
 * messages. Default #general channel is auto-created. Admins
 * (project leaders) can create new channels.
 *
 * Copyright (c) 2026 Andrei Banu & Levin Mircea
 */
import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useAuth } from "@/src/contexts/AuthContext";
import { useChat } from "@/src/hooks/useChat";
import { ChatBubble, MessageInput, TypingIndicator } from "@/src/components/chat";
import { chatService } from "@/src/services/chatService";
import type { ChatMessage } from "@/src/services/chatService.types";
import type { Channel } from "@/src/services/chatService.types";

export default function ProjectChatScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const tabBarHeight = React.useContext(BottomTabBarHeightContext) ?? 0;

  /* ── Channel state ───────────────────────────────── */
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsError, setChannelsError] = useState(false);
  const [showChannelList, setShowChannelList] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [creating, setCreating] = useState(false);

  /* ── Load channels on mount ──────────────────────── */
  const loadChannels = useCallback(async () => {
    if (!projectId) return;
    setChannelsLoading(true);
    setChannelsError(false);
    const chs = await chatService.getChannels(projectId);
    setChannels(chs);
    if (chs.length > 0) {
      // Default: select #general (is_default) or first channel
      const def = chs.find((c) => c.is_default) || chs[0];
      setActiveChannel(def);
      setChannelsError(false);
    } else {
      setChannelsError(true);
    }
    setChannelsLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  /* ── Chat hook — uses channel if available, else project room ── */
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
  } = useChat({
    projectId,
    channelId: activeChannel?.id,
  });

  const listRef = useRef<FlatList>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const handleSend = useCallback(
    (content: string, replyToId?: string, mentions?: any[]) => {
      sendMessage(content, replyToId, mentions);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    },
    [sendMessage],
  );

  const handleEdit = useCallback(
    (messageId: string, _currentContent: string) => {
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

  /* ── Create channel ──────────────────────────────── */
  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !projectId) return;
    setCreating(true);
    const ch = await chatService.createChannel(
      projectId,
      newChannelName.trim(),
      newChannelDesc.trim() || undefined,
    );
    if (ch) {
      setChannels((prev) => [...prev, ch]);
      setActiveChannel(ch);
      setShowCreateModal(false);
      setNewChannelName("");
      setNewChannelDesc("");
    }
    setCreating(false);
  };

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
      {/* ── Channel header bar ──────────────────────── */}
      <View style={styles.channelBar}>
        {channelsLoading ? (
          <View style={styles.channelToggle}>
            <ActivityIndicator size="small" color="#FF2A2A" />
            <Text style={[styles.channelName, { marginLeft: 8, color: "#9A9A9A" }]}>Loading channels…</Text>
          </View>
        ) : channelsError ? (
          <TouchableOpacity style={styles.channelToggle} onPress={loadChannels}>
            <Text style={styles.channelHash}>!</Text>
            <Text style={[styles.channelName, { color: "#FF9500" }]}>
              Failed to load channels — tap to retry
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.channelToggle}
            onPress={() => setShowChannelList((p) => !p)}
          >
            <Text style={styles.channelHash}>#</Text>
            <Text style={styles.channelName} numberOfLines={1}>
              {activeChannel?.name || "general"}
            </Text>
            <Text style={styles.chevron}>{showChannelList ? "▲" : "▼"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Channel list dropdown ───────────────────── */}
      {showChannelList && (
        <View style={styles.channelDrawer}>
          <Text style={styles.drawerTitle}>Channels</Text>
          {channels.map((ch) => (
            <TouchableOpacity
              key={ch.id}
              style={[
                styles.channelItem,
                activeChannel?.id === ch.id && styles.channelItemActive,
              ]}
              onPress={() => {
                setActiveChannel(ch);
                setShowChannelList(false);
              }}
            >
              <Text
                style={[
                  styles.channelItemText,
                  activeChannel?.id === ch.id && styles.channelItemTextActive,
                ]}
              >
                # {ch.name}
              </Text>
              {ch.is_default && (
                <Text style={styles.defaultBadge}>default</Text>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.addChannelBtn}
            onPress={() => {
              setShowChannelList(false);
              setShowCreateModal(true);
            }}
          >
            <Text style={styles.addChannelText}>+ New Channel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Messages list ───────────────────────────── */}
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
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>
                #{activeChannel?.name || "general"}
              </Text>
              <Text style={styles.emptyText}>
                Send the first message in this channel!
              </Text>
            </View>
          ) : null
        }
      />

      <TypingIndicator names={typingUsers} />

      <MessageInput
        onSend={activeChannel ? handleSend : () => {}}
        onTyping={sendTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        placeholder={
          channelsLoading
            ? "Loading channels…"
            : channelsError
              ? "Cannot send — channel unavailable"
              : `Message #${activeChannel?.name || "general"}…`
        }
        projectId={projectId}
        disabled={!activeChannel}
      />

      {/* ── Create channel modal ────────────────────── */}
      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Channel</Text>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={newChannelName}
              onChangeText={(t) => setNewChannelName(t.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              placeholder="e.g. field-notes"
              placeholderTextColor="#666"
              autoCapitalize="none"
              maxLength={50}
            />
            <Text style={styles.fieldLabel}>Description (optional)</Text>
            <TextInput
              style={styles.input}
              value={newChannelDesc}
              onChangeText={setNewChannelDesc}
              placeholder="What is this channel about?"
              placeholderTextColor="#666"
              maxLength={200}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#FF2A2A" }, (!newChannelName.trim() || creating) && { opacity: 0.5 }]}
                onPress={handleCreateChannel}
                disabled={!newChannelName.trim() || creating}
              >
                {creating ? <ActivityIndicator color="#F5F5F5" /> : <Text style={[styles.modalButtonText, { color: "#F5F5F5" }]}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111111" },

  /* Channel header bar */
  channelBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#1A1A1A",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2A2A2A",
  },
  channelToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  channelHash: { fontSize: 20, fontWeight: "700", color: "#FF2A2A" },
  channelName: { fontSize: 17, fontWeight: "600", color: "#F5F5F5", maxWidth: 200 },
  chevron: { fontSize: 12, color: "#9A9A9A", marginLeft: 4 },

  /* Channel drawer */
  channelDrawer: {
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  drawerTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9A9A9A",
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 4,
  },
  channelItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
  },
  channelItemActive: { backgroundColor: "#2A2A2A" },
  channelItemText: { fontSize: 15, color: "#CFCFCF" },
  channelItemTextActive: { color: "#F5F5F5", fontWeight: "600" },
  defaultBadge: {
    fontSize: 10,
    color: "#9A9A9A",
    backgroundColor: "#2A2A2A",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  addChannelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  addChannelText: { fontSize: 14, color: "#FF2A2A", fontWeight: "600" },

  /* Messages */
  list: { flexGrow: 1, paddingTop: 12, paddingBottom: 8 },
  emptyContainer: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingTop: 100, paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#F5F5F5", marginBottom: 8 },
  emptyText: { fontSize: 14, color: "#9A9A9A", textAlign: "center", lineHeight: 20 },

  /* Modal */
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalCard: {
    backgroundColor: "#1A1A1A", borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: "#2A2A2A", width: "100%", maxWidth: 400,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#F5F5F5", marginBottom: 16 },
  fieldLabel: {
    fontSize: 12, fontWeight: "600", color: "#9A9A9A",
    marginBottom: 6, marginTop: 8, textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#0A0A0A", color: "#F5F5F5", padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: "#2A2A2A", fontSize: 16,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 20 },
  modalButton: {
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 12, backgroundColor: "#2A2A2A",
  },
  modalButtonText: { color: "#F5F5F5", fontSize: 14, fontWeight: "600" },
});

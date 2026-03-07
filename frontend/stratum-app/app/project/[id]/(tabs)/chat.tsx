/**
 * @file
 * Per-project Slack-style chat tab (iOS / Android / Web).
 *
 * Loads channels via REST, displays the active channel's messages via
 * useChat, and supports channel switching, creating new channels,
 * editing & deleting messages.
 *
 * Rebuilt from scratch — zero useCallback, refs for closures, primitive
 * effect deps only. Immune to React Compiler memoisation issues.
 *
 * Copyright (c) 2026 Andrei Banu & Levin Mircea
 */
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Text,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/contexts/AuthContext";
import { useProjectDetail } from "@/src/contexts/ProjectDetailContext";
import { useChat } from "@/src/hooks/useChat";
import {
  ChatBubble,
  MessageInput,
  TypingIndicator,
} from "@/src/components/chat";
import { chatService } from "@/src/services/chatService";
import { projectService } from "@/src/services/projectService";
import { ensureProjectKey } from "@/src/utils/e2ee";
import type { ChatMessage, Channel } from "@/src/services/chatService.types";

/* ================================================================== *
 *  Screen                                                            *
 * ================================================================== */

export default function ProjectChatScreen() {
  "use no memo";

  /* ── params & context ─────────────────────────────── */
  const { user } = useAuth();
  const { project, isOwner } = useProjectDetail();
  const projectId = project?.id;
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  /* ── keyboard tracking ────────────────────────────── */
  const [kbVisible, setKbVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKbVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKbVisible(false),
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  /* ── channel state ────────────────────────────────── */
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  /* ── create-channel modal ─────────────────────────── */
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  /* ── load channels ────────────────────────────────── */
  useEffect(() => {
    if (!projectId) {
      console.log("[Chat] no projectId, skipping channel load");
      return;
    }

    let cancelled = false;

    (async () => {
      console.log("[Chat] loading channels for project:", projectId);
      setChannelsLoading(true);
      setChannelsError(null);

      try {
        let data = await chatService.getChannels(projectId);
        console.log("[Chat] getChannels returned", data.length, "channels");

        // Backend auto-creates #general; tiny race → retry once
        if (data.length === 0) {
          console.log("[Chat] 0 channels, retrying after 800ms…");
          await new Promise((r) => setTimeout(r, 800));
          data = await chatService.getChannels(projectId);
          console.log("[Chat] retry returned", data.length, "channels");
        }

        if (cancelled) return;

        if (data.length === 0) {
          setChannelsError("No channels available");
          setChannelsLoading(false);
          return;
        }

        setChannels(data);
        setActiveChannel((prev) => {
          if (prev) {
            const still = data.find((c) => c.id === prev.id);
            if (still) return still;
          }
          return data.find((c) => c.is_default) ?? data[0];
        });
      } catch (e: any) {
        console.error("[Chat] loadChannels error:", e?.message ?? e);
        if (!cancelled) setChannelsError(e?.message ?? "Failed to load channels");
      } finally {
        if (!cancelled) setChannelsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  /* ── E2EE key provisioning ────────────────────────── */
  useEffect(() => {
    if (!projectId) return;
    ensureProjectKey(
      projectId,
      () => projectService.getE2eeKey(projectId),
      (key) => projectService.setE2eeKey(projectId, key),
    ).catch((e) => console.warn("[Chat] E2EE key error:", e));
  }, [projectId]);

  /* ── chat hook ────────────────────────────────────── */
  const effective = activeChannel ?? channels[0] ?? null;

  console.log("[Chat] render", {
    projectId,
    channelsLoading,
    channelCount: channels.length,
    activeId: activeChannel?.id,
    effectiveId: effective?.id,
  });

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
  } = useChat({ projectId, channelId: effective?.id });

  const listRef = useRef<FlatList>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  /* ── handlers ─────────────────────────────────────── */
  function handleSend(content: string, replyToId?: string, mentions?: any[]) {
    sendMessage(content, replyToId, mentions);
    // Inverted list: offset 0 = visual bottom
    setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), 120);
  }

  function handleEdit(messageId: string, current: string) {
    if (Platform.OS === "web") {
      const text = window.prompt("Edit message", current);
      if (text?.trim()) editMessage(messageId, text.trim());
    } else {
      Alert.prompt?.(
        "Edit message",
        undefined,
        (text: string) => {
          if (text?.trim()) editMessage(messageId, text.trim());
        },
        "plain-text",
        current,
      );
    }
  }

  async function handleCreate() {
    if (!newName.trim() || !projectId) return;
    setCreating(true);
    try {
      const ch = await chatService.createChannel(
        projectId,
        newName.trim(),
        newDesc.trim() || undefined,
      );
      if (ch) {
        setChannels((p) => [...p, ch]);
        setActiveChannel(ch);
        setShowCreateModal(false);
        setNewName("");
        setNewDesc("");
      } else {
        Alert.alert("Failed", "Only project leaders can create channels.");
      }
    } finally {
      setCreating(false);
    }
  }

  function retryChannels() {
    setChannelsLoading(true);
    setChannelsError(null);
    chatService
      .getChannels(projectId!)
      .then((data) => {
        setChannels(data);
        if (data.length > 0) {
          setActiveChannel(data.find((c) => c.is_default) ?? data[0]);
        } else {
          setChannelsError("No channels available");
        }
      })
      .catch((e) => setChannelsError(e?.message ?? "Retry failed"))
      .finally(() => setChannelsLoading(false));
  }

  /* ── derived ──────────────────────────────────────── */
  const inputDisabled = channelsLoading || !!channelsError || channels.length === 0;
  const channelName = effective?.name ?? "general";
  const reversedMessages = [...messages].reverse();

  /* ================================================================ *
   *  JSX                                                             *
   * ================================================================ */
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* ── channel header bar ─────────────────────── */}
      <View style={[s.bar, { marginTop: headerHeight }]}>
        {channelsLoading ? (
          <View style={s.barRow}>
            <ActivityIndicator size="small" color="#FF2A2A" />
            <Text style={s.barTextMuted}>Loading channels…</Text>
          </View>
        ) : channelsError ? (
          <TouchableOpacity style={s.barRow} onPress={retryChannels}>
            <Text style={s.hash}>!</Text>
            <Text style={s.barTextWarn}>
              Couldn't load channels — tap to retry
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={s.barRow}
            onPress={() => setShowDrawer((p) => !p)}
          >
            <Text style={s.hash}>#</Text>
            <Text style={s.barText} numberOfLines={1}>
              {channelName}
            </Text>
            <Text style={s.chevron}>{showDrawer ? "▲" : "▼"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── channel dropdown ───────────────────────── */}
      {showDrawer && (
        <View style={s.drawer}>
          <Text style={s.drawerTitle}>Channels</Text>
          {channels.map((ch) => {
            const active = activeChannel?.id === ch.id;
            return (
              <TouchableOpacity
                key={ch.id}
                style={[s.drawerItem, active && s.drawerItemActive]}
                onPress={() => {
                  setActiveChannel(ch);
                  setShowDrawer(false);
                }}
              >
                <Text
                  style={[
                    s.drawerItemText,
                    active && s.drawerItemTextActive,
                  ]}
                >
                  # {ch.name}
                </Text>
                {ch.is_default && <Text style={s.badge}>default</Text>}
              </TouchableOpacity>
            );
          })}
          {isOwner && (
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => {
                setShowDrawer(false);
                setShowCreateModal(true);
              }}
            >
              <Text style={s.addBtnText}>+ New Channel</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── messages ───────────────────────────────── */}
      <FlatList
        ref={listRef}
        inverted
        data={reversedMessages}
        keyExtractor={(m) => m.id}
        renderItem={({ item, index }) => {
          // In inverted list: visually-above message = index + 1
          const prevMsg = reversedMessages[index + 1];
          const isGrouped =
            !!prevMsg &&
            prevMsg.sender_id === item.sender_id &&
            !prevMsg.is_deleted;
          return (
            <ChatBubble
              message={item}
              isOwnMessage={item.sender_id === user?.id}
              isGrouped={isGrouped}
              onEdit={handleEdit}
              onDelete={deleteMessage}
              onReply={setReplyTo}
            />
          );
        }}
        style={s.list}
        contentContainerStyle={s.listContent}
        onEndReached={() => {
          if (hasMore && !isLoading) loadMore();
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isLoading ? (
            <ActivityIndicator
              color="#9A9A9A"
              style={{ marginVertical: 12 }}
            />
          ) : null
        }
        ListEmptyComponent={
          channelsLoading ? (
            <View style={s.emptyInverted}>
              <ActivityIndicator
                size="large"
                color="#FF2A2A"
                style={{ marginBottom: 16 }}
              />
              <Text style={s.emptyTitle}>Loading…</Text>
            </View>
          ) : !isLoading ? (
            <View style={s.emptyInverted}>
              <Text style={s.emptyIcon}>💬</Text>
              <Text style={s.emptyTitle}>#{channelName}</Text>
              <Text style={s.emptyBody}>
                Send the first message in this channel!
              </Text>
            </View>
          ) : null
        }
      />

      {/* ── input area ─────────────────────────────── */}
      <View style={{ paddingBottom: Platform.OS === "web" ? 12 : kbVisible ? 0 : 49 + insets.bottom }}>
        <TypingIndicator names={typingUsers} />
        <MessageInput
          onSend={handleSend}
          onTyping={sendTyping}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          placeholder={
            inputDisabled
              ? "Loading channels…"
              : `Message #${channelName}…`
          }
          projectId={projectId}
          disabled={inputDisabled}
        />
      </View>

      {/* ── create channel modal ───────────────────── */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Create Channel</Text>

            <Text style={s.label}>Name</Text>
            <TextInput
              style={s.input}
              value={newName}
              onChangeText={(t) =>
                setNewName(
                  t.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
                )
              }
              placeholder="e.g. field-notes"
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoFocus
              maxLength={50}
            />

            <Text style={s.label}>Description (optional)</Text>
            <TextInput
              style={s.input}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="What is this channel about?"
              placeholderTextColor="#666"
              maxLength={200}
            />

            <View style={s.modalRow}>
              <TouchableOpacity
                style={s.modalBtn}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={s.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.modalBtn,
                  { backgroundColor: "#FF2A2A" },
                  (!newName.trim() || creating) && { opacity: 0.5 },
                ]}
                onPress={handleCreate}
                disabled={!newName.trim() || creating}
              >
                {creating ? (
                  <ActivityIndicator color="#F5F5F5" />
                ) : (
                  <Text style={[s.modalBtnText, { color: "#F5F5F5" }]}>
                    Create
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* ================================================================== *
 *  Styles                                                            *
 * ================================================================== */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111111" },

  /* channel bar */
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#1A1A1A",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2A2A2A",
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hash: { fontSize: 20, fontWeight: "700", color: "#FF2A2A" },
  barText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#F5F5F5",
    maxWidth: 200,
  },
  barTextMuted: {
    fontSize: 15,
    color: "#9A9A9A",
    marginLeft: 8,
  },
  barTextWarn: {
    fontSize: 15,
    color: "#FF9500",
    marginLeft: 4,
  },
  chevron: { fontSize: 12, color: "#9A9A9A", marginLeft: 4 },

  /* channel drawer */
  drawer: {
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
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
  },
  drawerItemActive: { backgroundColor: "#2A2A2A" },
  drawerItemText: { fontSize: 15, color: "#CFCFCF" },
  drawerItemTextActive: { color: "#F5F5F5", fontWeight: "600" },
  badge: {
    fontSize: 10,
    color: "#9A9A9A",
    backgroundColor: "#2A2A2A",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  addBtn: { paddingVertical: 10, paddingHorizontal: 12, marginTop: 4 },
  addBtnText: { fontSize: 14, color: "#FF2A2A", fontWeight: "600" },

  /* messages */
  list: { flex: 1 },
  listContent: { paddingVertical: 8 },
  emptyInverted: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
    transform: [{ scaleY: -1 }],
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: "#9A9A9A",
    textAlign: "center",
    lineHeight: 20,
  },

  /* modal */
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9A9A9A",
    marginBottom: 6,
    marginTop: 8,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#0A0A0A",
    color: "#F5F5F5",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    fontSize: 16,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#2A2A2A",
  },
  modalBtnText: { color: "#F5F5F5", fontSize: 14, fontWeight: "600" },
});

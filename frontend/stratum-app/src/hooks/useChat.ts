/**
 * @file
 * Chat hook — real-time messaging with REST history.
 *
 * Manages message state, real-time Socket.IO events, initial history
 * fetching, and infinite scroll. Supports project rooms, channels, and DMs.
 *
 * Copyright (c) 2026 Andrei Banu & Levin Mircea
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useAuth } from "../contexts/AuthContext";
import { chatService } from "../services/chatService";
import type { ChatMessage, SendMessagePayload, MentionRef } from "../services/chatService.types";

interface UseChatOptions {
  /** Project room mode — pass a project ID. */
  projectId?: string;
  /** Channel mode — pass a channel ID (within a project). */
  channelId?: string | number;
  /** DM mode — pass the other user's ID. */
  otherUserId?: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  hasMore: boolean;
  typingUsers: string[];
  sendMessage: (content: string, replyToId?: string, mentions?: MentionRef[]) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  sendTyping: () => void;
}

/**
 * Hook for real-time chat in either project-room or DM mode.
 *
 * Usage:
 *   const chat = useChat({ projectId: "..." });     // project room
 *   const chat = useChat({ otherUserId: "..." });    // DM
 */
export function useChat({ projectId, channelId, otherUserId }: UseChatOptions): UseChatReturn {
  const { socket, isConnected } = useWebSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const cursorRef = useRef<string | null>(null);
  const identifiedRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Identify this socket to the server (for DM delivery) ────────────

  useEffect(() => {
    if (!socket || !isConnected || !user?.id || identifiedRef.current) return;
    socket.emit("identify", { user_id: user.id });
    identifiedRef.current = true;
  }, [socket, isConnected, user?.id]);

  // ── Join channel room on Socket.IO ──────────────────────────────────

  useEffect(() => {
    if (!socket || !isConnected || !channelId) return;
    socket.emit("join_channel", { channel_id: channelId });
    return () => {
      socket.emit("leave_channel", { channel_id: channelId });
    };
  }, [socket, isConnected, channelId]);

  // ── Fetch initial history ───────────────────────────────────────────

  const fetchHistory = useCallback(
    async (cursor?: string | null) => {
      setIsLoading(true);
      try {
        const page = channelId
          ? await chatService.getChannelMessages(channelId, cursor)
          : projectId
            ? await chatService.getProjectMessages(projectId, cursor)
            : otherUserId
              ? await chatService.getDmMessages(otherUserId, cursor)
              : null;

        if (!page) return;

        // Messages come newest-first from API; reverse so oldest is first for FlatList
        const incoming = [...page.messages].reverse();

        if (cursor) {
          // Prepend older messages
          setMessages((prev) => [...incoming, ...prev]);
        } else {
          setMessages(incoming);
        }
        cursorRef.current = page.next_cursor;
        setHasMore(page.has_more);
      } catch (e) {
        console.error("[useChat] history fetch failed:", e);
      } finally {
        setIsLoading(false);
      }
    },
    [channelId, projectId, otherUserId],
  );

  useEffect(() => {
    cursorRef.current = null;
    setMessages([]);
    setHasMore(true);
    fetchHistory();
  }, [fetchHistory]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    await fetchHistory(cursorRef.current);
  }, [fetchHistory, isLoading, hasMore]);

  // ── Real-time listeners ─────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: ChatMessage) => {
      // Filter — only accept messages for our current chat
      if (channelId && String(data.channel_id) !== String(channelId)) return;
      if (!channelId && projectId && data.project_id !== projectId) return;
      if (
        otherUserId &&
        data.sender_id !== otherUserId &&
        data.recipient_id !== otherUserId
      )
        return;

      setMessages((prev) => {
        // Deduplicate (REST + WS race)
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
    };

    const handleEdited = (data: { id: string; content: string; edited_at: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.id ? { ...m, content: data.content, edited_at: data.edited_at } : m,
        ),
      );
    };

    const handleDeleted = (data: { id: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.id ? { ...m, is_deleted: true, content: "" } : m,
        ),
      );
    };

    const handleTyping = (data: { user_id: string; display_name: string }) => {
      if (data.user_id === user?.id) return;
      const name = data.display_name || "Someone";
      setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
      // Auto-clear after 3s
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((n) => n !== name));
      }, 3000);
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_edited", handleEdited);
    socket.on("message_deleted", handleDeleted);
    socket.on("user_typing", handleTyping);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_edited", handleEdited);
      socket.off("message_deleted", handleDeleted);
      socket.off("user_typing", handleTyping);
    };
  }, [socket, channelId, projectId, otherUserId, user?.id]);

  // ── Actions ─────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string, replyToId?: string, mentions?: MentionRef[]) => {
      const payload: SendMessagePayload = {
        content,
        project_id: projectId ?? null,
        recipient_id: otherUserId ?? null,
        channel_id: channelId ? String(channelId) : null,
        reply_to_id: replyToId ?? null,
        mentions: mentions ?? null,
      };

      if (socket?.connected) {
        // Prefer WS for low latency
        socket.emit("send_message", payload);
      } else {
        // REST fallback
        const msg = await chatService.sendMessage(payload);
        if (msg) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      }
    },
    [socket, channelId, projectId, otherUserId],
  );

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      if (socket?.connected) {
        socket.emit("edit_message", { message_id: messageId, content });
      } else {
        const msg = await chatService.editMessage(messageId, content);
        if (msg) {
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
        }
      }
    },
    [socket],
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (socket?.connected) {
        socket.emit("delete_message", { message_id: messageId });
      } else {
        const ok = await chatService.deleteMessage(messageId);
        if (ok) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, is_deleted: true, content: "" } : m,
            ),
          );
        }
      }
    },
    [socket],
  );

  const sendTyping = useCallback(() => {
    if (!socket?.connected || !user) return;
    // Throttle: max once per 2s
    if (typingTimeoutRef.current) return;
    socket.emit("typing", {
      project_id: projectId ?? null,
      recipient_id: otherUserId ?? null,
      user_id: user.id,
      display_name: user.display_name ?? user.email,
    });
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  }, [socket, user, projectId, otherUserId]);

  return {
    messages,
    isLoading,
    hasMore,
    typingUsers,
    sendMessage,
    editMessage,
    deleteMessage,
    loadMore,
    sendTyping,
  };
}

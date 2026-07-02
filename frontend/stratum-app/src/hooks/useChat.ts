/**
 * @file
 * Chat hook — real-time messaging with REST history.
 *
 * Manages message state, real-time Socket.IO events, initial history
 * fetching, and infinite scroll. Supports project rooms, channels, and DMs.
 *
 * Architecture: all closures read from refs (never stale) and effects
 * depend only on primitive values. Zero useCallback — immune to React
 * Compiler memoisation bugs on native.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { useState, useEffect, useRef } from "react";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useAuth } from "../contexts/AuthContext";
import { chatService } from "../services/chatService";
import { encryptMessage, decryptMessage, isEncrypted } from "../utils/e2ee";
import type {
  ChatMessage,
  SendMessagePayload,
  MentionRef,
} from "../services/chatService.types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UseChatOptions {
  projectId?: string;
  channelId?: string | number;
  otherUserId?: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  hasMore: boolean;
  typingUsers: string[];
  sendMessage: (
    content: string,
    replyToId?: string,
    mentions?: MentionRef[],
  ) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  sendTyping: () => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useChat({
  projectId,
  channelId,
  otherUserId,
}: UseChatOptions): UseChatReturn {
  "use no memo";

  const { socket, isConnected } = useWebSocket();
  const { user } = useAuth();

  /* ── state ─────────────────────────────────────────────────────── */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  /* ── refs (all closures read from here — never stale) ──────────── */
  const socketRef = useRef(socket);
  const userRef = useRef(user);
  const channelIdRef = useRef(channelId);
  const projectIdRef = useRef(projectId);
  const otherUserIdRef = useRef(otherUserId);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const identifiedRef = useRef(false);
  const typingThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const e2eeScope = projectId ?? (otherUserId ? `dm_${otherUserId}` : null);
  const e2eeScopeRef = useRef(e2eeScope);

  // Keep refs in sync on every render
  socketRef.current = socket;
  userRef.current = user;
  channelIdRef.current = channelId;
  projectIdRef.current = projectId;
  otherUserIdRef.current = otherUserId;
  e2eeScopeRef.current = e2eeScope;

  /* ── E2EE helpers (read scope from ref) ────────────────────────── */

  async function tryDecryptMsg(msg: ChatMessage): Promise<ChatMessage> {
    const scope = e2eeScopeRef.current;
    if (!scope || !isEncrypted(msg.content)) return msg;
    try {
      const plaintext = await decryptMessage(msg.content, scope);
      return { ...msg, content: plaintext, _e2ee: true };
    } catch {
      return msg;
    }
  }

  async function decryptBatch(msgs: ChatMessage[]): Promise<ChatMessage[]> {
    return Promise.all(msgs.map((m) => tryDecryptMsg(m)));
  }

  /* ── helpers to set state + ref in lock-step ───────────────────── */

  function setLoadingState(v: boolean) {
    loadingRef.current = v;
    setIsLoading(v);
  }
  function setHasMoreState(v: boolean) {
    hasMoreRef.current = v;
    setHasMore(v);
  }

  /* ================================================================ *
   *  Effects                                                         *
   * ================================================================ */

  // 1. Identify socket to backend (once per connection)
  useEffect(() => {
    if (!socket || !isConnected || !user?.id) return;
    if (identifiedRef.current) return;
    console.log("[useChat] identify →", user.id);
    socket.emit("identify", { user_id: user.id });
    identifiedRef.current = true;
  }, [socket, isConnected, user?.id]);

  // Reset identified flag when socket changes
  useEffect(() => {
    identifiedRef.current = false;
  }, [socket]);

  // 2. Join / leave channel room
  useEffect(() => {
    if (!socket || !isConnected || !channelId) return;
    const cid = String(channelId);
    console.log("[useChat] join_channel →", cid);
    socket.emit("join_channel", { channel_id: cid });
    return () => {
      console.log("[useChat] leave_channel →", cid);
      socket.emit("leave_channel", { channel_id: cid });
    };
  }, [socket, isConnected, channelId]);

  // 3. Fetch initial history when target changes
  useEffect(() => {
    cursorRef.current = null;
    setMessages([]);
    setHasMoreState(true);

    const cid = channelId ? String(channelId) : undefined;
    const pid = projectId;
    const ouid = otherUserId;

    if (!cid && !pid && !ouid) {
      console.log("[useChat] no target, skipping history fetch");
      return;
    }

    let cancelled = false;

    (async () => {
      setLoadingState(true);
      try {
        console.log("[useChat] fetching history →", { cid, pid, ouid });
        const page = cid
          ? await chatService.getChannelMessages(cid)
          : pid
            ? await chatService.getProjectMessages(pid)
            : ouid
              ? await chatService.getDmMessages(ouid)
              : null;

        if (cancelled || !page) return;

        const incoming = [...page.messages].reverse();
        const decrypted = await decryptBatch(incoming);
        if (cancelled) return;

        setMessages(decrypted);
        cursorRef.current = page.next_cursor;
        setHasMoreState(page.has_more);
        console.log(
          "[useChat] loaded",
          decrypted.length,
          "msgs, hasMore:",
          page.has_more,
        );
      } catch (e) {
        console.error("[useChat] history fetch failed:", e);
      } finally {
        if (!cancelled) setLoadingState(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only primitive deps — no functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, projectId, otherUserId]);

  // 4. Real-time listeners (depend only on socket ref)
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = async (data: ChatMessage) => {
      const cid = channelIdRef.current;
      const pid = projectIdRef.current;
      const ouid = otherUserIdRef.current;

      // Filter — only accept messages for our current context
      if (cid && String(data.channel_id) !== String(cid)) return;
      if (!cid && pid && data.project_id !== pid) return;
      if (ouid && data.sender_id !== ouid && data.recipient_id !== ouid) return;

      // Decrypt before inserting into state
      const dec = await tryDecryptMsg(data);

      setMessages((prev) => {
        if (prev.some((m) => m.id === dec.id)) return prev;
        const tempIdx = prev.findIndex(
          (m) => m.id.startsWith("temp_") && m.sender_id === dec.sender_id,
        );
        if (tempIdx !== -1) {
          const next = [...prev];
          next[tempIdx] = dec;
          return next;
        }
        return [...prev, dec];
      });
    };

    const handleEdited = async (data: {
      id: string;
      content: string;
      edited_at: string;
    }) => {
      let content = data.content;
      const scope = e2eeScopeRef.current;
      if (scope && isEncrypted(content)) {
        try {
          content = await decryptMessage(content, scope);
        } catch {
          /* keep ciphertext */
        }
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.id ? { ...m, content, edited_at: data.edited_at } : m,
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
      if (data.user_id === userRef.current?.id) return;
      const name = data.display_name || "Someone";
      setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((n) => n !== name));
      }, 3_000);
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
    // Handlers read from refs so only socket identity matters
  }, [socket]);

  /* ================================================================ *
   *  Actions (plain functions — read everything from refs)           *
   * ================================================================ */

  async function loadMore(): Promise<void> {
    if (loadingRef.current || !hasMoreRef.current) return;

    setLoadingState(true);
    const cid = channelIdRef.current ? String(channelIdRef.current) : undefined;
    const pid = projectIdRef.current;
    const ouid = otherUserIdRef.current;
    const cursor = cursorRef.current;

    try {
      const page = cid
        ? await chatService.getChannelMessages(cid, cursor)
        : pid
          ? await chatService.getProjectMessages(pid, cursor)
          : ouid
            ? await chatService.getDmMessages(ouid, cursor)
            : null;
      if (!page) return;

      const incoming = [...page.messages].reverse();
      const decrypted = await decryptBatch(incoming);
      setMessages((prev) => [...decrypted, ...prev]);
      cursorRef.current = page.next_cursor;
      setHasMoreState(page.has_more);
    } catch (e) {
      console.error("[useChat] loadMore failed:", e);
    } finally {
      setLoadingState(false);
    }
  }

  async function sendMessage(
    content: string,
    replyToId?: string,
    mentions?: MentionRef[],
  ): Promise<void> {
    const u = userRef.current;
    if (!u) return;

    const scope = e2eeScopeRef.current;
    let encrypted: string;
    try {
      encrypted = scope ? await encryptMessage(content, scope) : content;
    } catch (e) {
      console.error("[useChat] encrypt failed, sending plaintext:", e);
      encrypted = content;
    }

    const cid = channelIdRef.current;
    const pid = projectIdRef.current;
    const ouid = otherUserIdRef.current;

    const payload: SendMessagePayload = {
      content: encrypted,
      project_id: pid ?? null,
      recipient_id: ouid ?? null,
      channel_id: cid ? String(cid) : null,
      reply_to_id: replyToId ?? null,
      mentions: mentions ?? null,
    };

    // Optimistic
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      sender_id: u.id,
      sender_name: u.display_name ?? u.email ?? null,
      sender_username: u.username ?? null,
      sender_photo: u.photo_url ?? null,
      project_id: pid ?? null,
      recipient_id: ouid ?? null,
      channel_id: cid ? String(cid) : null,
      content,
      reply_to_id: replyToId ?? null,
      mentions: mentions ?? null,
      created_at: new Date().toISOString(),
      edited_at: null,
      is_deleted: false,
      _e2ee: encrypted !== content,
    };
    setMessages((prev) => [...prev, optimistic]);

    const sendViaRest = async () => {
      const msg = await chatService.sendMessage(payload);
      if (msg) {
        const dec = await tryDecryptMsg(msg);
        setMessages((prev) => prev.map((m) => (m.id === tempId ? dec : m)));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        console.warn("[useChat] REST send failed");
      }
    };

    const sock = socketRef.current;
    if (sock?.connected) {
      sock.emit("send_message", payload, (ack: any) => {
        if (ack?.status === "error") {
          console.warn("[useChat] WS rejected:", ack.message);
          sendViaRest();
        }
      });
    } else {
      await sendViaRest();
    }
  }

  async function editMessage(messageId: string, content: string): Promise<void> {
    const scope = e2eeScopeRef.current;
    let encrypted: string;
    try {
      encrypted = scope ? await encryptMessage(content, scope) : content;
    } catch (e) {
      console.error("[useChat] edit encrypt failed, sending plaintext:", e);
      encrypted = content;
    }

    const sock = socketRef.current;
    if (sock?.connected) {
      sock.emit("edit_message", {
        message_id: messageId,
        content: encrypted,
      });
    } else {
      const msg = await chatService.editMessage(messageId, encrypted);
      if (msg) {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      }
    }
  }

  async function deleteMessage(messageId: string): Promise<void> {
    const sock = socketRef.current;
    if (sock?.connected) {
      sock.emit("delete_message", { message_id: messageId });
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
  }

  function sendTyping(): void {
    const sock = socketRef.current;
    const u = userRef.current;
    if (!sock?.connected || !u) return;
    if (typingThrottleRef.current) return;
    sock.emit("typing", {
      project_id: projectIdRef.current ?? null,
      recipient_id: otherUserIdRef.current ?? null,
      user_id: u.id,
      display_name: u.display_name ?? u.email,
    });
    typingThrottleRef.current = setTimeout(() => {
      typingThrottleRef.current = null;
    }, 2_000);
  }

  /* ── return ────────────────────────────────────────────────────── */

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

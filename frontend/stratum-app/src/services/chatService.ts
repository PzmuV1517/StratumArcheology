/**
 * @file
 * Chat / messaging REST service.
 *
 * Provides functions for fetching message history, conversation list,
 * and sending/editing/deleting messages via the REST API.
 * Real-time delivery is handled by Socket.IO events in useChat hook.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 */
import api from "./api";
import {
  ChatMessage,
  ChatMessagePage,
  ConversationPreview,
  SendMessagePayload,
} from "./chatService.types";

export const chatService = {
  // ── Project room messages ──────────────────────────────────────────────

  /** Fetch paginated project room messages (newest first). */
  getProjectMessages: async (
    projectId: string,
    cursor?: string | null,
    limit = 50,
  ): Promise<ChatMessagePage> => {
    try {
      const params: Record<string, any> = { limit };
      if (cursor) params.cursor = cursor;
      const res = await api.get(`/chat/project/${projectId}`, { params });
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch project messages:", error);
      return { messages: [], next_cursor: null, has_more: false };
    }
  },

  // ── DM messages ────────────────────────────────────────────────────────

  /** Fetch paginated DM messages with another user (newest first). */
  getDmMessages: async (
    otherUserId: string,
    cursor?: string | null,
    limit = 50,
  ): Promise<ChatMessagePage> => {
    try {
      const params: Record<string, any> = { limit };
      if (cursor) params.cursor = cursor;
      const res = await api.get(`/chat/dm/${otherUserId}`, { params });
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch DM messages:", error);
      return { messages: [], next_cursor: null, has_more: false };
    }
  },

  // ── Conversations list ─────────────────────────────────────────────────

  /** Fetch all DM conversations for the current user. */
  getConversations: async (): Promise<ConversationPreview[]> => {
    try {
      const res = await api.get("/chat/conversations");
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch conversations:", error);
      return [];
    }
  },

  // ── Send message (REST fallback) ───────────────────────────────────────

  /** Send a message via REST when WS is unavailable. */
  sendMessage: async (payload: SendMessagePayload): Promise<ChatMessage | null> => {
    try {
      const res = await api.post("/chat/messages", payload);
      return res.data;
    } catch (error: any) {
      console.error("Failed to send message:", error);
      return null;
    }
  },

  // ── Edit / delete ──────────────────────────────────────────────────────

  /** Edit a message. */
  editMessage: async (
    messageId: string,
    content: string,
  ): Promise<ChatMessage | null> => {
    try {
      const res = await api.patch(`/chat/messages/${messageId}`, { content });
      return res.data;
    } catch (error: any) {
      console.error("Failed to edit message:", error);
      return null;
    }
  },

  /** Soft-delete a message. */
  deleteMessage: async (messageId: string): Promise<boolean> => {
    try {
      await api.delete(`/chat/messages/${messageId}`);
      return true;
    } catch (error: any) {
      console.error("Failed to delete message:", error);
      return false;
    }
  },
};

/**
 * @file
 * Chat / messaging REST service.
 *
 * Provides functions for fetching message history, conversation list,
 * channels, mentionables, and sending/editing/deleting messages.
 *
 * Copyright (c) 2026 Andrei Banu & Levin Mircea
 */
import api from "./api";
import type {
  ChatMessage,
  ChatMessagePage,
  ConversationPreview,
  SendMessagePayload,
  Channel,
  Mentionable,
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

  // ── Channel messages ───────────────────────────────────────────────────

  /** Fetch paginated channel messages (newest first). */
  getChannelMessages: async (
    channelId: string | number,
    cursor?: string | null,
    limit = 50,
  ): Promise<ChatMessagePage> => {
    try {
      const params: Record<string, any> = { limit };
      if (cursor) params.cursor = cursor;
      const res = await api.get(`/chat/channel/${channelId}`, { params });
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch channel messages:", error);
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

  // ── Channels ───────────────────────────────────────────────────────────

  /** List channels for a project (auto-creates #general). Throws on failure. */
  getChannels: async (projectId: string): Promise<Channel[]> => {
    const res = await api.get(`/projects/${projectId}/channels`);
    return res.data;
  },

  /** Create a new channel in a project. */
  createChannel: async (
    projectId: string,
    name: string,
    description?: string,
  ): Promise<Channel | null> => {
    try {
      const res = await api.post(`/projects/${projectId}/channels`, {
        name,
        description,
      });
      return res.data;
    } catch (error: any) {
      console.error("Failed to create channel:", error);
      return null;
    }
  },

  /** Delete a channel. */
  deleteChannel: async (channelId: number): Promise<boolean> => {
    try {
      await api.delete(`/channels/${channelId}`);
      return true;
    } catch (error: any) {
      console.error("Failed to delete channel:", error);
      return false;
    }
  },

  // ── Mentionables ───────────────────────────────────────────────────────

  /** Search mentionable users and groups in a project. */
  getMentionables: async (
    projectId: string,
    query = "",
  ): Promise<Mentionable> => {
    try {
      const res = await api.get(`/projects/${projectId}/mentionables`, {
        params: { q: query },
      });
      return res.data;
    } catch (error: any) {
      console.error("Failed to fetch mentionables:", error);
      return { users: [], groups: [] };
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

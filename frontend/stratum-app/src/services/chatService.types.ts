/**
 * @file
 * TypeScript type definitions for the chat service.
 *
 * Defines interfaces for chat messages, conversation previews,
 * channels, user groups, and paginated message responses.
 *
 * Copyright (c) 2026 Andrei Banu & Levin Mircea
 */

/** A single chat message (channel, project room, or DM). */
export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string | null;
  sender_username: string | null;
  sender_photo: string | null;
  project_id: string | null;
  recipient_id: string | null;
  channel_id: string | null;
  content: string;
  reply_to_id: string | null;
  mentions: MentionRef[] | null;
  created_at: string; // ISO 8601
  edited_at: string | null;
  is_deleted: boolean;
  /** Client-only: true when this message was decrypted from E2EE ciphertext. */
  _e2ee?: boolean;
}

/** A mention reference embedded in a message. */
export interface MentionRef {
  type: "user" | "group";
  id: number;
  name: string;
}

/** Cursor-paginated page of messages. */
export interface ChatMessagePage {
  messages: ChatMessage[];
  next_cursor: string | null;
  has_more: boolean;
}

/** DM conversation list entry. */
export interface ConversationPreview {
  other_user_id: string;
  other_user_name: string | null;
  other_user_username: string | null;
  other_user_photo: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

/** Payload for creating a new message. */
export interface SendMessagePayload {
  content: string;
  project_id?: string | null;
  recipient_id?: string | null;
  channel_id?: string | null;
  reply_to_id?: string | null;
  mentions?: MentionRef[] | null;
}

/** A channel within a project. */
export interface Channel {
  id: number;
  project_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_by: number | null;
  created_at: string;
  member_count: number;
}

/** A user group within a project. */
export interface UserGroup {
  id: number;
  project_id: string;
  name: string;
  created_by: number | null;
  created_at: string;
}

/** Mentionable entry for @-autocomplete. */
export interface Mentionable {
  users: { id: number; display_name: string; username: string | null }[];
  groups: { id: number; name: string }[];
}


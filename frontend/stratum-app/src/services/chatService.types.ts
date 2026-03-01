/**
 * @file
 * TypeScript type definitions for the chat service.
 *
 * Defines interfaces for chat messages, conversation previews,
 * and paginated message responses.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 */

/** A single chat message (project room or DM). */
export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string | null;
  sender_photo: string | null;
  project_id: string | null;
  recipient_id: string | null;
  content: string;
  reply_to_id: string | null;
  created_at: string; // ISO 8601
  edited_at: string | null;
  is_deleted: boolean;
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
  reply_to_id?: string | null;
}

/**
 * @file
 * Service layer barrel export.
 *
 * Re-exports all service modules for convenient importing
 * throughout the application.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
// Export all services from a single entry point

export { default as api } from "./api";

// Auth
export { authService } from "./authService";
export type { User, AuthResult } from "./authService.types";

// Projects
export { projectService } from "./projectService";
export type {
  Project,
  ProjectMember,
  CreateProjectData,
  UpdateProjectData,
  InviteResponse,
  JoinResponse,
  GpsState,
} from "./projectService.types";

// Files
export { fileService } from "./fileService";
export type { FileNode, DownloadResult } from "./fileService.core";

// Notes
export { noteService } from "./noteService";
export type { Note, Attachment, CreateNoteData } from "./noteService.core";

// Forms
export { formsService } from "./formsService";
export type {
  ContextFeatureRecord,
  StratigraphicUnitRecord,
  ArtefactRecord,
  FormSaveResponse,
} from "./formsService.types";

// Activity/Timeline
export { activityService, ActivityType } from "./activityService";
export type {
  ProjectActivity,
  ActivityListResponse,
  ActivityExtraData,
} from "./activityService.types";

// WebSocket
export { socketService } from "./socketService";

// Chat
export { chatService } from "./chatService";
export type {
  ChatMessage,
  ChatMessagePage,
  ConversationPreview,
  SendMessagePayload,
} from "./chatService.types";

// QR Codes
export { qrService } from "./qrService";
export type { QRCodeEntry, QRCodeResolved } from "./qrService";

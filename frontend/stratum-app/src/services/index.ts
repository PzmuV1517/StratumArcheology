// Export all services from a single entry point

// API
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

// QR Codes
export { qrService } from "./qrService";
export type { QRCodeEntry, QRCodeResolved } from "./qrService";

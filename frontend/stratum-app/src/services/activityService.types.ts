// Types for project activity/timeline

export enum ActivityType {
  // Project
  PROJECT_CREATED = 'project_created',
  PROJECT_UPDATED = 'project_updated',
  PROJECT_DELETED = 'project_deleted',

  // Members
  MEMBER_JOINED = 'member_joined',
  MEMBER_LEFT = 'member_left',
  MEMBER_ROLE_CHANGED = 'member_role_changed',
  OWNERSHIP_TRANSFERRED = 'ownership_transferred',

  // Files
  FILE_UPLOADED = 'file_uploaded',
  FILE_DELETED = 'file_deleted',
  FILE_MOVED = 'file_moved',
  FOLDER_CREATED = 'folder_created',
  FOLDER_DELETED = 'folder_deleted',

  // Notes
  NOTE_CREATED = 'note_created',
  NOTE_UPDATED = 'note_updated',
  NOTE_DELETED = 'note_deleted',
  NOTE_ATTACHMENT_ADDED = 'note_attachment_added',

  // Forms
  CONTEXT_FEATURE_CREATED = 'context_feature_created',
  STRATIGRAPHIC_UNIT_CREATED = 'stratigraphic_unit_created',
  ARTEFACT_CREATED = 'artefact_created',

  // GPS
  GPS_ENABLED = 'gps_enabled',
  GPS_DISABLED = 'gps_disabled',
  GPS_UPDATED = 'gps_updated',
}

export interface ActivityExtraData {
  file_name?: string;
  file_path?: string;
  folder_name?: string;
  note_title?: string;
  note_id?: number;
  attachment_type?: string;
  old_role?: string;
  new_role?: string;
  new_owner_id?: number;
  form_type?: string;
  record_id?: string;
  [key: string]: any;
}

export interface ProjectActivity {
  id: number;
  project_id: number;
  user_id: string;
  activity_type: ActivityType | string;
  extra_data?: ActivityExtraData;
  created_at: string;

  // Joined user info from backend
  user_name?: string;
}

export interface ActivityListResponse {
  activities: ProjectActivity[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

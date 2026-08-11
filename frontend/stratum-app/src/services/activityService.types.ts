/**
 * @file
 * TypeScript type definitions for the activity service.
 *
 * Defines interfaces for activity types, timeline entries,
 * and activity feed responses.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */

/** Enumeration of all trackable activity types in a project. */
export enum ActivityType {
  PROJECT_CREATED = "project_created",
  PROJECT_UPDATED = "project_updated",
  PROJECT_DELETED = "project_deleted",

  // Members
  MEMBER_JOINED = "member_joined",
  MEMBER_LEFT = "member_left",
  MEMBER_ROLE_CHANGED = "member_role_changed",
  OWNERSHIP_TRANSFERRED = "ownership_transferred",

  // Files
  FILE_UPLOADED = "file_uploaded",
  FILE_UPDATED = "file_updated",
  FILE_DELETED = "file_deleted",
  FILE_MOVED = "file_moved",
  FILE_RENAMED = "file_renamed",
  FOLDER_CREATED = "folder_created",
  FOLDER_DELETED = "folder_deleted",

  // Notes
  NOTE_CREATED = "note_created",
  NOTE_UPDATED = "note_updated",
  NOTE_DELETED = "note_deleted",
  NOTE_ATTACHMENT_ADDED = "note_attachment_added",
  NOTE_ATTACHMENT_DELETED = "note_attachment_deleted",

  // Forms
  CONTEXT_FEATURE_CREATED = "context_feature_created",
  CONTEXT_FEATURE_ADDED = "context_feature_added",
  STRATIGRAPHIC_UNIT_CREATED = "stratigraphic_unit_created",
  STRATIGRAPHIC_UNIT_ADDED = "stratigraphic_unit_added",
  ARTEFACT_CREATED = "artefact_created",
  ARTEFACT_ADDED = "artefact_added",

  GPS_ENABLED = "gps_enabled",
  GPS_DISABLED = "gps_disabled",
  GPS_UPDATED = "gps_updated",

  HARRIS_MATRIX_UPDATED = "harris_matrix_updated",
}

/** Extra metadata attached to a project activity entry. */
export interface ActivityExtraData {
  file_name?: string;
  file_path?: string;
  folder_name?: string;
  note_title?: string;
  note_id?: number;
  attachment_type?: string;
  old_role?: string;
  new_role?: string;
  old_name?: string;
  new_name?: string;
  new_owner_id?: number;
  form_type?: string;
  record_id?: string;
  file_id?: string;
  [key: string]: any;
}

/** A single activity entry in a project timeline. */
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

/** Paginated response containing a list of project activities. */
export interface ActivityListResponse {
  activities: ProjectActivity[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

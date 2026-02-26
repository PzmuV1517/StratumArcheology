/**
 * @file
 * TypeScript type definitions for the activity service.
 *
 * Defines interfaces for activity types, timeline entries,
 * and activity feed responses.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
// Types for project activity/timeline

/** Enumeration of all trackable activity types in a project. */
export enum ActivityType {
  // Project
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

  // GPS
  GPS_ENABLED = "gps_enabled",
  GPS_DISABLED = "gps_disabled",
  GPS_UPDATED = "gps_updated",

  // Harris Matrix
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

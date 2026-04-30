/**
 * @file
 * TypeScript type definitions for the project service.
 *
 * Defines interfaces for projects, project members, roles,
 * and API request/response shapes.
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
// Shared types for project service

/** A member of a project with their role and join date. */
export interface ProjectMember {
  id?: string;
  user_id: string;
  email: string;
  display_name: string;
  photo_url?: string | null;
  bio?: string | null;
  role: "leader" | "researcher" | "guest" | "owner" | "editor" | "viewer";
  joined_at: string;
}

/** An archaeological site project. */
export interface Project {
  id: string;
  name: string;
  description?: string;
  short_code?: string;
  owner_id: string;
  created_at: string;
  updated_at?: string;
  members: ProjectMember[];
  is_active?: boolean;
  is_public?: boolean;
  member_count?: number;
  ran_lmi_id?: string;
  /** Presigned URL for the project cover image (set by backend when fetching) */
  cover_image_url?: string;
}

/** Payload for creating a new project. */
export interface CreateProjectData {
  name: string;
  description?: string | null;
  ran_lmi_id?: string;
}

/** Payload for updating an existing project. */
export interface UpdateProjectData {
  name?: string;
  description?: string | null;
  ran_lmi_id?: string | null;
}

/** Asset used when uploading a cover image from the device. */
export interface CoverImageAsset {
  uri: string;
  type?: string;
  name?: string;
}

/** Response returned after creating a project invite. */
export interface InviteResponse {
  token: string;
  project_id: string;
  role: string;
  expires_at: string;
  accept_path: string;
  code?: string;
}

/** Response returned after joining a project via invite. */
export interface JoinResponse {
  message: string;
  project_id: string;
  project_name: string;
  role: string;
}

/** A single latitude/longitude coordinate for GPS polygons. */
export interface GpsPoint {
  lat: number;
  lng: number;
}

/** A polygon area defined by an array of GPS points. */
export interface GpsPolygon {
  points: GpsPoint[];
  closed?: boolean;
}

/** GPS state stored per project containing work area and site polygons. */
export interface GpsState {
  work?: GpsPolygon | null;
  sites?: GpsPolygon[];
}

/** Full public project detail returned by GET /projects/public/{id}. */
export interface PublicProjectDetail extends Project {
  gps?: GpsState | null;
  public_history_review?: string | null;
  public_history_provider?: string | null;
  public_history_generated_at?: string | null;
}

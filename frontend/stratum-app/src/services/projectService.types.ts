// Shared types for project service

export interface ProjectMember {
  id?: string;
  user_id: string;
  email: string;
  display_name: string;
  role: "leader" | "researcher" | "guest" | "owner" | "editor" | "viewer";
  joined_at: string;
}

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
  ran_lmi_id?: string;
}

export interface CreateProjectData {
  name: string;
  description?: string | null;
  ran_lmi_id?: string;
}

export interface UpdateProjectData {
  name?: string;
  description?: string | null;
  ran_lmi_id?: string | null;
}

export interface InviteResponse {
  token: string;
  project_id: string;
  role: string;
  expires_at: string;
  accept_path: string;
  code?: string;
}

export interface JoinResponse {
  message: string;
  project_id: string;
  project_name: string;
  role: string;
}

// GPS polygon point
export interface GpsPoint {
  lat: number;
  lng: number;
}

// GPS polygon area (work area or site)
export interface GpsPolygon {
  points: GpsPoint[];
  closed?: boolean;
}

// GPS state stored per project
export interface GpsState {
  work?: GpsPolygon | null;
  sites?: GpsPolygon[];
}

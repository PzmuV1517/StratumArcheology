/**
 * @file
 * TypeScript type definitions for the authentication service.
 *
 * Defines interfaces for auth requests, responses, user data,
 * and token payloads.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
// Shared types and interfaces for auth service

/** Authenticated user profile data. */
export interface User {
  id: string;
  email: string;
  username?: string;
  display_name: string;
  photo_url?: string;
  banner_url?: string;
  bio?: string;
  description?: string;
  phone?: string;
  timezone?: string;
  show_projects?: boolean;
  link_x?: string;
  link_discord?: string;
  link_bsky?: string;
  link_linkedin?: string;
  link_website?: string;
  auth_provider?: string | null;
  is_emonument_privileged?: boolean;
  is_dashboard_admin?: boolean;
  is_account_disabled?: boolean;
  is_soft_deleted?: boolean;
  soft_deleted_at?: string | null;
  created_at?: string;
}

/** Result returned from login or registration attempts. */
export interface AuthResult {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
  verificationRequired?: boolean;
  message?: string;
}

/** Credentials payload for user login. */
export interface LoginCredentials {
  email: string;
  password: string;
}

/** Credentials payload for new user registration. */
export interface RegisterCredentials {
  email: string;
  password: string;
  displayName: string;
  username: string;
}

// Storage keys
/** AsyncStorage key for the JWT authentication token. */
export const AUTH_TOKEN_KEY = "authToken";
/** AsyncStorage key for the serialised user data object. */
export const USER_DATA_KEY = "userData";

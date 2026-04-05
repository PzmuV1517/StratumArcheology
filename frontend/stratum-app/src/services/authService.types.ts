/**
 * @file
 * TypeScript type definitions for the authentication service.
 *
 * Defines interfaces for auth requests, responses, user data,
 * and token payloads.
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

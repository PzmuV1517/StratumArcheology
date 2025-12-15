// Shared types and interfaces for auth service

export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at?: string;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  displayName: string;
}

// Storage keys
export const AUTH_TOKEN_KEY = 'authToken';
export const USER_DATA_KEY = 'userData';

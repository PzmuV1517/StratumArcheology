/**
 * @file
 * End-to-end encryption utilities for chat messages.
 *
 * Uses NaCl secretbox (XSalsa20-Poly1305) with a per-project
 * symmetric key stored locally. The server never sees plaintext.
 *
 * Copyright (c) 2026 Andrei Banu & Levin Mircea
 */
// Must be imported BEFORE tweetnacl — polyfills crypto.getRandomValues
import "react-native-get-random-values";
import nacl from "tweetnacl";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ── Constants ──────────────────────────────────────────────────────── */

/** Prefix that marks a message as E2EE-encrypted. */
export const E2EE_PREFIX = "\u{1F512}E2EE:";

/** AsyncStorage key prefix for per-project encryption keys. */
const KEY_PREFIX = "e2ee_key_";

/* ── Base64 helpers (no tweetnacl-util dependency) ──────────────────── */

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/* ── Key management ─────────────────────────────────────────────────── */

/**
 * Generate a fresh 256-bit random key for a project.
 * Returns the key as a base64 string.
 */
export function generateProjectKey(): string {
  const key = nacl.randomBytes(nacl.secretbox.keyLength);
  return toBase64(key);
}

/** Store a project's encryption key locally. */
export async function storeProjectKey(
  projectId: string,
  keyB64: string,
): Promise<void> {
  await AsyncStorage.setItem(`${KEY_PREFIX}${projectId}`, keyB64);
}

/** Retrieve a project's encryption key (null if not set). */
export async function getProjectKey(projectId: string): Promise<string | null> {
  return AsyncStorage.getItem(`${KEY_PREFIX}${projectId}`);
}

/** Remove a project's encryption key. */
export async function removeProjectKey(projectId: string): Promise<void> {
  await AsyncStorage.removeItem(`${KEY_PREFIX}${projectId}`);
}

/** Check if a project has an encryption key configured. */
export async function hasProjectKey(projectId: string): Promise<boolean> {
  const key = await getProjectKey(projectId);
  return key !== null && key.length > 0;
}

/* ── Encrypt / Decrypt ──────────────────────────────────────────────── */

/**
 * Encrypt a plaintext message using the project's key.
 * Returns the encrypted string with E2EE prefix, or the original
 * plaintext if no key is available.
 */
export async function encryptMessage(
  plaintext: string,
  projectId: string,
): Promise<string> {
  const keyB64 = await getProjectKey(projectId);
  if (!keyB64) return plaintext;

  const key = fromBase64(keyB64);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageBytes = new TextEncoder().encode(plaintext);
  const ciphertext = nacl.secretbox(messageBytes, nonce, key);

  // Pack nonce + ciphertext together
  const packed = new Uint8Array(nonce.length + ciphertext.length);
  packed.set(nonce);
  packed.set(ciphertext, nonce.length);

  return `${E2EE_PREFIX}${toBase64(packed)}`;
}

/**
 * Decrypt a message if it has the E2EE prefix.
 * Returns the plaintext, or the original string if not encrypted
 * or if decryption fails.
 */
export async function decryptMessage(
  content: string,
  projectId: string,
): Promise<string> {
  if (!content.startsWith(E2EE_PREFIX)) return content;

  const keyB64 = await getProjectKey(projectId);
  if (!keyB64) return "[Encrypted — key not available]";

  try {
    const key = fromBase64(keyB64);
    const packed = fromBase64(content.slice(E2EE_PREFIX.length));

    const nonce = packed.slice(0, nacl.secretbox.nonceLength);
    const ciphertext = packed.slice(nacl.secretbox.nonceLength);

    const plaintext = nacl.secretbox.open(ciphertext, nonce, key);
    if (!plaintext) return "[Encrypted — wrong key]";

    return new TextDecoder().decode(plaintext);
  } catch {
    return "[Encrypted — decryption failed]";
  }
}

/** Check if a message content string is E2EE-encrypted. */
export function isEncrypted(content: string): boolean {
  return content.startsWith(E2EE_PREFIX);
}

/* ── Auto-setup ─────────────────────────────────────────────────────── */

/**
 * Ensure a project has an E2EE key — fetch from server or generate & push.
 * Call this once when the chat is opened. Stores the key locally.
 */
export async function ensureProjectKey(
  projectId: string,
  getRemoteKey: () => Promise<string | null>,
  setRemoteKey: (key: string) => Promise<string | null>,
): Promise<void> {
  // 1. Check local cache
  const local = await getProjectKey(projectId);
  if (local) return;

  // 2. Fetch from server
  const remote = await getRemoteKey();
  if (remote) {
    await storeProjectKey(projectId, remote);
    return;
  }

  // 3. Generate, push to server, store locally
  const fresh = generateProjectKey();
  const stored = await setRemoteKey(fresh);
  // Server may return a different key if another client raced us
  await storeProjectKey(projectId, stored ?? fresh);
}

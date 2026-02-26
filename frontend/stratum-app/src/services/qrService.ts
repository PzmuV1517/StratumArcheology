/**
 * @file
 * QR code scanning and resolution service.
 *
 * Provides functions for scanning QR codes and resolving them
 * to application resources via the backend API.
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
import api from "./api";

/** A registered QR code entry linking a code string to a resource. */
export interface QRCodeEntry {
  id: string;
  code: string;
  type: string; // "artefact" | "invite" | …
  resource_id: string;
  project_id?: string | null;
  created_at?: string | null;
}

/** Resolved QR code with its target resource details. */
export interface QRCodeResolved {
  code: string;
  type: string;
  resource_id: string;
  project_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Service for creating and resolving QR codes linked to project resources. */
export const qrService = {
  /**
   * Register a new QR code that points at a resource.
   *
   * @returns The created entry including `code` (the value to encode in the QR image).
   */
  create: async (
    type: string,
    resourceId: string,
    projectId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<QRCodeEntry> => {
    try {
      const response = await api.post("/qr-codes", {
        type,
        resource_id: resourceId,
        project_id: projectId,
        metadata,
      });
      return response.data;
    } catch (error: any) {
      throw error.response?.data || error;
    }
  },

  /**
   * Resolve a QR code string to its target resource.
   */
  resolve: async (code: string): Promise<QRCodeResolved> => {
    try {
      const response = await api.get(
        `/qr-codes/${encodeURIComponent(code.trim())}/resolve`,
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data || error;
    }
  },
};

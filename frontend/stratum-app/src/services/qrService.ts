/**
 * @file
 * QR code scanning and resolution service.
 *
 * Provides functions for scanning QR codes and resolving them
 * to application resources via the backend API.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
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

/**
 * QR Code service – talks to the unified /api/qr-codes backend.
 *
 * Every QR code in the app encodes a short, unique identifier (e.g. STR-X7K9M2P4).
 * This service creates those codes and resolves them back to their targets.
 */
import api from "./api";

export interface QRCodeEntry {
  id: string;
  code: string;
  type: string; // "artefact" | "invite" | …
  resource_id: string;
  project_id?: string | null;
  created_at?: string | null;
}

export interface QRCodeResolved {
  code: string;
  type: string;
  resource_id: string;
  project_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

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

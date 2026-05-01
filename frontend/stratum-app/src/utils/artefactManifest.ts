/**
 * @file
 * Artefact manifest utility.
 *
 * Provides functions for building and parsing artefact
 * metadata manifests.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { Platform } from "react-native";

export interface ManifestUser {
  id?: string;
  email?: string;
  display_name?: string;
}

export interface ManifestFileEntry {
  id: string;
  name: string;
  mime_type?: string;
  size?: number;
}

export interface ArtefactManifest {
  id: string; // folder id
  name: string;
  number: number;
  createdAt: string;
  createdBy?: ManifestUser;
  updatedAt?: string;
  updatedBy?: ManifestUser;
  previewFileId?: string;
  qr?: { url?: string; imageFileId?: string };
  files: ManifestFileEntry[]; // images and other files
  notes: ManifestFileEntry[]; // .txt notes
  history?: { type: string; at: string; by?: ManifestUser; details?: any }[];
  /** Linked Harris Matrix stratigraphic context ID */
  harrisMatrixContextId?: string;
  /** GPS coordinates for the artefact find-spot */
  latitude?: number;
  longitude?: number;
}

export type FileNode = {
  id: string;
  name: string;
  type: "file" | "folder" | "note";
  mime_type?: string;
  size?: number;
};

export function buildManifestFromChildren(
  folderId: string,
  name: string,
  number: number,
  children: FileNode[],
  existing?: Partial<ArtefactManifest>,
  options?: { user?: ManifestUser; qrUrl?: string },
): ArtefactManifest {
  const createdAt = existing?.createdAt || new Date().toISOString();
  const createdBy = existing?.createdBy;
  const preview = children.find(
    (c) => c.type === "file" && /^preview\.(png|jpg|jpeg|webp)$/i.test(c.name),
  );
  const files: ManifestFileEntry[] = children
    .filter(
      (c) =>
        c.type === "file" &&
        !/^preview\.(png|jpg|jpeg|webp)$/i.test(c.name) &&
        c.name !== "artefact.json" &&
        !/\.txt$/i.test(c.name),
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      mime_type: c.mime_type,
      size: (c as any).size,
    }));
  const notes: ManifestFileEntry[] = children
    .filter((c) => c.type === "file" && /\.txt$/i.test(c.name))
    .map((c) => ({
      id: c.id,
      name: c.name,
      mime_type: c.mime_type,
      size: (c as any).size,
    }));

  const manifest: ArtefactManifest = {
    id: folderId,
    name,
    number,
    createdAt,
    createdBy,
    updatedAt: new Date().toISOString(),
    updatedBy: options?.user,
    previewFileId: preview?.id || existing?.previewFileId,
    qr: {
      url: options?.qrUrl || existing?.qr?.url,
      imageFileId: existing?.qr?.imageFileId,
    },
    files,
    notes,
    history: existing?.history ? [...existing.history] : [],
    harrisMatrixContextId: existing?.harrisMatrixContextId,
    latitude: existing?.latitude,
    longitude: existing?.longitude,
  };

  // Append a generic update event
  manifest.history?.push({
    type: "update",
    at: manifest.updatedAt!,
    by: options?.user,
    details: { files: files.length, notes: notes.length, platform: Platform.OS },
  });
  return manifest;
}

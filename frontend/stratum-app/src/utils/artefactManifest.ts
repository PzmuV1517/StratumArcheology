/**
 * @file
 * Artefact manifest utility.
 *
 * Provides functions for building and parsing artefact
 * metadata manifests.
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

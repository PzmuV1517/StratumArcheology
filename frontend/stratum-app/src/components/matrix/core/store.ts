/**
 * @file
 * Loading and saving the matrix.
 *
 * One store for web and phone. The previous web build wrote only to
 * localStorage while the phone build wrote to the API, so a matrix drawn on a
 * laptop was invisible to the crew's phones and to artefact recording, and
 * clearing site data destroyed it. Everything here goes through the server,
 * with a local copy kept so a trench with no signal still works.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import api from "../../../services/api";
import type { MatrixDocument } from "./model";
import { emptyDocument, parseDocument } from "./model";

const cacheKey = (projectId: string) => `stratum.matrix.v3.${projectId}`;
const dirtyKey = (projectId: string) => `stratum.matrix.v3.${projectId}.dirty`;

export interface LoadResult {
  doc: MatrixDocument;
  /** True when the server could not be reached and this came from cache. */
  offline: boolean;
  /** True when local edits are waiting to be pushed. */
  pendingUpload: boolean;
}

async function readCache(projectId: string): Promise<MatrixDocument | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(projectId));
    if (!raw) return null;
    return parseDocument(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeCache(projectId: string, doc: MatrixDocument): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(projectId), JSON.stringify(doc));
  } catch {
    // A full disk must not take the editor down; the server copy still holds.
  }
}

async function setDirty(projectId: string, dirty: boolean): Promise<void> {
  try {
    if (dirty) await AsyncStorage.setItem(dirtyKey(projectId), "1");
    else await AsyncStorage.removeItem(dirtyKey(projectId));
  } catch {
    // Ignore: worst case we re-upload an unchanged document.
  }
}

export async function isDirty(projectId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(dirtyKey(projectId))) === "1";
  } catch {
    return false;
  }
}

/**
 * Fetch the project's matrix.
 *
 * Unsent local edits win over the server copy, otherwise pressing refresh
 * after a day offline would discard the day's recording.
 */
export async function loadMatrix(projectId: string): Promise<LoadResult> {
  const pendingUpload = await isDirty(projectId);
  const cached = await readCache(projectId);

  if (pendingUpload && cached) {
    return { doc: cached, offline: false, pendingUpload: true };
  }

  try {
    const response = await api.get(`/projects/${projectId}/harris-matrix`);
    const doc = parseDocument(response.data?.data);
    await writeCache(projectId, doc);
    return { doc, offline: false, pendingUpload: false };
  } catch {
    return {
      doc: cached ?? emptyDocument(),
      offline: true,
      pendingUpload: pendingUpload,
    };
  }
}

/**
 * Persist the matrix, caching first.
 *
 * The local write happens before the request so an edit survives the app
 * being closed the moment after it is made, which on a site is normal.
 * Failure to reach the server is reported, not thrown: the edit is safe and
 * the caller shows an unsynced indicator.
 */
export async function saveMatrix(
  projectId: string,
  doc: MatrixDocument,
): Promise<{ saved: boolean }> {
  const stamped: MatrixDocument = {
    ...doc,
    updatedAt: new Date().toISOString(),
  };

  await writeCache(projectId, stamped);
  await setDirty(projectId, true);

  try {
    await api.put(`/projects/${projectId}/harris-matrix`, { data: stamped });
    await setDirty(projectId, false);
    return { saved: true };
  } catch {
    return { saved: false };
  }
}

/** Push cached edits after connectivity returns. */
export async function flushPending(projectId: string): Promise<boolean> {
  if (!(await isDirty(projectId))) return true;
  const cached = await readCache(projectId);
  if (!cached) {
    await setDirty(projectId, false);
    return true;
  }
  const { saved } = await saveMatrix(projectId, cached);
  return saved;
}

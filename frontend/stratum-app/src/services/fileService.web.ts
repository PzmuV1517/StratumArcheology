/**
 * @file
 * Web-specific file service implementation.
 *
 * Extends core file functionality with browser-specific download
 * and upload features.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
// Web-specific file operations
import api from "./api";
import { fileServiceCore, FileNode, DownloadResult } from "./fileService.core";
import AsyncStorage from "@react-native-async-storage/async-storage";

export * from "./fileService.core";

/** Web-specific file service with browser download and upload support. */
export const fileService = {
  ...fileServiceCore,

  /**
   * Download a stored file and return its contents as text.
   *
   * Present on both platforms so callers never have to branch: web reads
   * the Blob, native downloads to a cache URI and reads it back.
   */
  downloadFileAsText: async (nodeId: string): Promise<string> => {
    const { blob } = await fileService.downloadFile(nodeId);
    if (!blob) throw new Error("Download returned no file data");
    return await blob.text();
  },

  // Web-specific upload using FormData with File objects
  uploadFile: async (
    projectId: string,
    file: File,
    parentId: string | null = null,
  ): Promise<FileNode> => {
    const formData = new FormData();
    formData.append("file", file);
    if (parentId) {
      formData.append("parent_id", parentId);
    }
    const res = await api.post(`/files/project/${projectId}/upload`, formData, {
      timeout: 0,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return res.data;
  },

  // Web-specific: upload with FormData directly
  uploadFormData: async (
    projectId: string,
    formData: FormData,
  ): Promise<FileNode> => {
    const res = await api.post(`/files/project/${projectId}/upload`, formData, {
      timeout: 0,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return res.data;
  },

  /**
   * Replace a file's contents.
   *
   * Shares its signature with the native implementation so cross-platform
   * callers type-check on both; web always takes the File form.
   */
  replaceFile: async (
    nodeId: string,
    file: File | string,
    _fileName?: string,
    _mimeType?: string,
  ): Promise<FileNode> => {
    if (typeof file === "string") {
      throw new Error("replaceFile on web expects a File, not a URI");
    }
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.put(`/files/${nodeId}/content`, formData, {
      timeout: 0,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return res.data;
  },

  // Web-specific download using fetch with streaming
  downloadFile: async (
    nodeId: string,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<DownloadResult> => {
    const token = await AsyncStorage.getItem("authToken");
    const url = `${api.defaults.baseURL}/files/${nodeId}/download`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error("Download failed");

    const contentLength =
      parseInt(response.headers.get("Content-Length") || "0", 10) || 0;
    const mimeType =
      response.headers.get("Content-Type") || "application/octet-stream";

    // If no progress callback needed, just get blob directly
    if (!onProgress) {
      const blob = await response.blob();
      return { blob, contentLength, mimeType };
    }

    // Stream with progress
    const reader = response.body?.getReader();
    if (!reader) {
      const blob = await response.blob();
      return { blob, contentLength, mimeType };
    }

    let received = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onProgress(received, contentLength);
    }

    const blob = new Blob(chunks as BlobPart[], { type: mimeType });
    return { blob, contentLength, mimeType };
  },

  // Web-specific: trigger browser download
  triggerDownload: (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Web-specific: get download URL for direct linking
  getDownloadUrl: async (nodeId: string): Promise<string> => {
    const token = await AsyncStorage.getItem("authToken");
    return `${api.defaults.baseURL}/files/${nodeId}/download${token ? `?token=${token}` : ""}`;
  },

  // Web-specific: open file in new tab
  openInNewTab: async (nodeId: string): Promise<void> => {
    const url = await fileService.getDownloadUrl(nodeId);
    window.open(url, "_blank");
  },
};

export default fileService;

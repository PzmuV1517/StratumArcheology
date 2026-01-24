// Web-specific file operations
import api from "./api";
import { fileServiceCore, FileNode, DownloadResult } from "./fileService.core";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Re-export core methods
export * from "./fileService.core";

export const fileService = {
  ...fileServiceCore,

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
    const res = await api.post(`/files/project/${projectId}/upload`, formData);
    return res.data;
  },

  // Web-specific: upload with FormData directly
  uploadFormData: async (
    projectId: string,
    formData: FormData,
  ): Promise<FileNode> => {
    const res = await api.post(`/files/project/${projectId}/upload`, formData);
    return res.data;
  },

  replaceFile: async (nodeId: string, file: File): Promise<FileNode> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.put(`/files/${nodeId}/content`, formData);
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

// Native-specific file operations using Expo APIs
import api from './api';
import { fileServiceCore, FileNode, DownloadResult } from './fileService.core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
// Note: expo-sharing must be installed separately: npx expo install expo-sharing
let Sharing: any;
try {
  Sharing = require('expo-sharing');
} catch {
  Sharing = null;
}
import * as DocumentPicker from 'expo-document-picker';

// Get cache directory with fallback
const getCacheDir = (): string => {
  return (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
};

// Re-export core methods
export * from './fileService.core';

export const fileService = {
  ...fileServiceCore,

  // Native-specific upload using DocumentPicker result
  uploadFile: async (
    projectId: string,
    fileUri: string,
    fileName: string,
    mimeType: string,
    parentId: string | null = null
  ): Promise<FileNode> => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);
    if (parentId) {
      formData.append('parent_id', parentId);
    }
    const res = await api.post(`/files/project/${projectId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // Native-specific: upload with FormData directly
  uploadFormData: async (projectId: string, formData: FormData): Promise<FileNode> => {
    const res = await api.post(`/files/project/${projectId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // Native-specific: pick file using DocumentPicker
  pickFile: async (): Promise<{ uri: string; name: string; mimeType: string } | null> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || 'application/octet-stream',
      };
    } catch (error) {
      console.error('File pick error:', error);
      return null;
    }
  },

  replaceFile: async (nodeId: string, fileUri: string, fileName: string, mimeType: string): Promise<FileNode> => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);
    const res = await api.put(`/files/${nodeId}/content`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // Native-specific download using FileSystem
  downloadFile: async (
    nodeId: string,
    filename: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<DownloadResult> => {
    const token = await AsyncStorage.getItem('authToken');
    const url = `${api.defaults.baseURL}/files/${nodeId}/download`;

    const localUri = `${getCacheDir()}${filename}`;

    const progressCallback = onProgress
      ? (downloadProgress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
          const loaded = downloadProgress.totalBytesWritten;
          const total = downloadProgress.totalBytesExpectedToWrite;
          onProgress(loaded, total);
        }
      : undefined;

    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      localUri,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      progressCallback
    );

    const result = await downloadResumable.downloadAsync();
    if (!result?.uri) {
      throw new Error('Download failed');
    }

    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    const contentLength = (fileInfo as any).size || 0;

    return {
      uri: result.uri,
      contentLength,
      mimeType: result.headers?.['Content-Type'] || 'application/octet-stream',
    };
  },

  // Native-specific: share file using Sharing API
  shareFile: async (uri: string): Promise<void> => {
    if (!Sharing) {
      throw new Error('expo-sharing not installed');
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    } else {
      throw new Error('Sharing is not available on this device');
    }
  },

  // Native-specific: delete cached file
  deleteCachedFile: async (uri: string): Promise<void> => {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (error) {
      console.error('Error deleting cached file:', error);
    }
  },

  // Native-specific: get file info
  getFileInfo: async (uri: string): Promise<{ exists: boolean; size?: number; modificationTime?: number }> => {
    const info = await FileSystem.getInfoAsync(uri);
    return {
      exists: info.exists,
      size: (info as any).size,
      modificationTime: (info as any).modificationTime,
    };
  },
};

export default fileService;

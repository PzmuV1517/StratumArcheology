// Native-specific file operations using Expo APIs
import api from "./api";
import { fileServiceCore, FileNode, DownloadResult } from "./fileService.core";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Platform, ActionSheetIOS, Alert } from "react-native";

// Note: expo-sharing must be installed separately: npx expo install expo-sharing
// Using lazy load to avoid bundling issues
let Sharing: typeof import("expo-sharing") | null = null;
const getSharingModule = async () => {
  if (!Sharing) {
    try {
      Sharing = await import("expo-sharing");
    } catch {
      Sharing = null;
    }
  }
  return Sharing;
};

// Get cache directory with fallback - ensure we always have a valid directory
const getCacheDir = (): string => {
  // On iOS/Android, cacheDirectory is preferred; documentDirectory is always available
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!dir) {
    console.warn("[fileService] No cache or document directory available");
    return "";
  }
  return dir;
};

// Re-export core methods
export * from "./fileService.core";

export const fileService = {
  ...fileServiceCore,

  // Native-specific upload using DocumentPicker result
  uploadFile: async (
    projectId: string,
    fileUriOrFormData: string | FormData,
    fileName?: string,
    mimeType?: string,
    parentId: string | null = null,
  ): Promise<FileNode> => {
    try {
      // Handle FormData directly (when called from project screen)
      if (fileUriOrFormData instanceof FormData) {
        // Don't set Content-Type header - let the browser/RN set it with the correct boundary
        const res = await api.post(
          `/files/project/${projectId}/upload`,
          fileUriOrFormData,
        );
        return res.data;
      }

      // Handle individual file upload
      const formData = new FormData();
      formData.append("file", {
        uri: fileUriOrFormData,
        name: fileName || "file",
        type: mimeType || "application/octet-stream",
      } as any);
      if (parentId) {
        formData.append("parent_id", parentId);
      }
      // Don't set Content-Type header - let RN set it with the correct boundary
      const res = await api.post(`/files/project/${projectId}/upload`, formData);
      return res.data;
    } catch (error: any) {
      // If offline or network error, queue the upload
      if (
        error.code === "ERR_NETWORK" ||
        error.message?.includes("Network") ||
        !error.response
      ) {
        const { offlineQueue } = await import("./offlineQueueService");
        const { authService } = await import("./authService");
        const user = await authService.getCurrentUser();

        const tempId = `temp_file_${Date.now()}`;

        // Save file URI for later upload
        const fileUri =
          fileUriOrFormData instanceof FormData ? null : fileUriOrFormData;
        if (fileUri && user) {
          await offlineQueue.enqueue(
            "UPLOAD_FILE",
            projectId,
            { parent_id: parentId, name: fileName, mime_type: mimeType },
            user.id,
            { localPath: fileUri, priority: 1 },
          );

          // Return temporary file object
          return {
            id: tempId,
            name: fileName || "file",
            type: "file",
            parent_id: parentId,
            project_id: projectId,
            mime_type: mimeType,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as FileNode;
        }
      }
      throw error;
    }
  },

  // Native-specific: upload with FormData directly
  uploadFormData: async (
    projectId: string,
    formData: FormData,
  ): Promise<FileNode> => {
    // Don't set Content-Type header - let RN set it with the correct boundary
    const res = await api.post(`/files/project/${projectId}/upload`, formData);
    return res.data;
  },

  // Native-specific: pick file using DocumentPicker or ImagePicker with action sheet
  pickFile: async (): Promise<{
    uri: string;
    name: string;
    mimeType: string;
  } | null> => {
    try {
      if (Platform.OS === "ios") {
        return new Promise((resolve) => {
          ActionSheetIOS.showActionSheetWithOptions(
            {
              options: ["Cancel", "Take Photo", "Upload Photo", "Upload Files"],
              cancelButtonIndex: 0,
              title: "Add File",
            },
            async (buttonIndex: number) => {
              try {
                if (buttonIndex === 0) {
                  return resolve(null);
                }

                if (buttonIndex === 1) {
                  // Take Photo - request camera permission first
                  const { status } =
                    await ImagePicker.requestCameraPermissionsAsync();
                  if (status !== "granted") {
                    Alert.alert(
                      "Permission Required",
                      "Camera access is needed to take photos.",
                    );
                    return resolve(null);
                  }

                  const result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ["images"],
                    quality: 0.8,
                    allowsEditing: false,
                  });

                  if (result.canceled || !result.assets?.length) {
                    return resolve(null);
                  }

                  const asset = result.assets[0];
                  // Generate proper filename with extension based on mime type
                  let fileName = asset.fileName;
                  const mimeType = asset.mimeType || "image/jpeg";

                  // If no filename or no extension, generate one from mime type
                  if (!fileName || !fileName.includes(".")) {
                    const ext = mimeType.split("/")[1] || "jpg";
                    const cleanExt = ext === "jpeg" ? "jpg" : ext;
                    fileName = `photo_${Date.now()}.${cleanExt}`;
                  }

                  return resolve({
                    uri: asset.uri,
                    name: fileName,
                    mimeType: mimeType,
                  });
                }

                if (buttonIndex === 2) {
                  // Upload Photo - from library
                  const { status } =
                    await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (status !== "granted") {
                    Alert.alert(
                      "Permission Required",
                      "Photo library access is needed to select photos.",
                    );
                    return resolve(null);
                  }

                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ["images"],
                    quality: 0.8,
                    allowsEditing: false,
                  });

                  if (result.canceled || !result.assets?.length) {
                    return resolve(null);
                  }

                  const asset = result.assets[0];
                  // Generate proper filename with extension based on mime type
                  let fileName = asset.fileName;
                  const mimeType = asset.mimeType || "image/jpeg";

                  // If no filename or no extension, generate one from mime type
                  if (!fileName || !fileName.includes(".")) {
                    const ext = mimeType.split("/")[1] || "jpg";
                    const cleanExt = ext === "jpeg" ? "jpg" : ext;
                    fileName = `photo_${Date.now()}.${cleanExt}`;
                  }

                  return resolve({
                    uri: asset.uri,
                    name: fileName,
                    mimeType: mimeType,
                  });
                }

                if (buttonIndex === 3) {
                  // Upload Files - document picker
                  const result = await DocumentPicker.getDocumentAsync({
                    type: "*/*",
                    copyToCacheDirectory: true,
                  });

                  if (result.canceled || !result.assets?.length) {
                    return resolve(null);
                  }

                  const asset = result.assets[0];
                  return resolve({
                    uri: asset.uri,
                    name: asset.name,
                    mimeType: asset.mimeType || "application/octet-stream",
                  });
                }
              } catch (error) {
                console.error("File pick error:", error);
                resolve(null);
              }
            },
          );
        });
      } else {
        // Android - show Alert with options
        return new Promise((resolve) => {
          Alert.alert(
            "Add File",
            "Choose an option",
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
              {
                text: "Take Photo",
                onPress: async () => {
                  try {
                    const { status } =
                      await ImagePicker.requestCameraPermissionsAsync();
                    if (status !== "granted") {
                      Alert.alert(
                        "Permission Required",
                        "Camera access is needed to take photos.",
                      );
                      return resolve(null);
                    }

                    const result = await ImagePicker.launchCameraAsync({
                      mediaTypes: ["images"],
                      quality: 0.8,
                    });

                    if (result.canceled || !result.assets?.length) {
                      return resolve(null);
                    }

                    const asset = result.assets[0];
                    resolve({
                      uri: asset.uri,
                      name: asset.fileName || `photo_${Date.now()}.jpg`,
                      mimeType: asset.mimeType || "image/jpeg",
                    });
                  } catch (e) {
                    console.error("Camera error:", e);
                    resolve(null);
                  }
                },
              },
              {
                text: "Upload Photo",
                onPress: async () => {
                  try {
                    const { status } =
                      await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== "granted") {
                      Alert.alert(
                        "Permission Required",
                        "Photo library access is needed.",
                      );
                      return resolve(null);
                    }

                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ["images"],
                      quality: 0.8,
                    });

                    if (result.canceled || !result.assets?.length) {
                      return resolve(null);
                    }

                    const asset = result.assets[0];
                    resolve({
                      uri: asset.uri,
                      name: asset.fileName || `photo_${Date.now()}.jpg`,
                      mimeType: asset.mimeType || "image/jpeg",
                    });
                  } catch (e) {
                    console.error("Library error:", e);
                    resolve(null);
                  }
                },
              },
              {
                text: "Upload Files",
                onPress: async () => {
                  try {
                    const result = await DocumentPicker.getDocumentAsync({
                      type: "*/*",
                      copyToCacheDirectory: true,
                    });

                    if (result.canceled || !result.assets?.length) {
                      return resolve(null);
                    }

                    const asset = result.assets[0];
                    resolve({
                      uri: asset.uri,
                      name: asset.name,
                      mimeType: asset.mimeType || "application/octet-stream",
                    });
                  } catch (e) {
                    console.error("Document picker error:", e);
                    resolve(null);
                  }
                },
              },
            ],
            { cancelable: true },
          );
        });
      }
    } catch (error) {
      console.error("File pick error:", error);
      return null;
    }
  },

  replaceFile: async (
    nodeId: string,
    fileUri: string,
    fileName: string,
    mimeType: string,
  ): Promise<FileNode> => {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);
    // Don't set Content-Type header - let RN set it with the correct boundary
    const res = await api.put(`/files/${nodeId}/content`, formData);
    return res.data;
  },

  // Native-specific download using FileSystem
  downloadFile: async (
    nodeId: string,
    filename?: string,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<DownloadResult> => {
    // Validate input
    if (!nodeId) {
      throw new Error("Invalid nodeId for download");
    }

    const token = await AsyncStorage.getItem("authToken");
    const baseUrl = api.defaults.baseURL || "";
    const url = `${baseUrl}/files/${nodeId}/download`;

    // Ensure we have a valid filename
    const safeFilename = filename || `file_${nodeId}_${Date.now()}`;

    // Get cache directory
    const cacheDir = getCacheDir();
    if (!cacheDir) {
      throw new Error("Cache directory not available");
    }

    // Create downloads directory if needed
    const downloadsDir = `${cacheDir}downloads/`;
    const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });
    }

    // Generate unique filename to avoid conflicts
    let localUri = `${downloadsDir}${safeFilename}`;
    const existingFile = await FileSystem.getInfoAsync(localUri);
    if (existingFile.exists) {
      // Delete existing file to allow overwrite
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    }

    try {
      // Create download with progress callback
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        localUri,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
        onProgress
          ? (progress) => {
              onProgress(
                progress.totalBytesWritten,
                progress.totalBytesExpectedToWrite,
              );
            }
          : undefined,
      );

      const result = await downloadResumable.downloadAsync();

      if (!result || !result.uri) {
        throw new Error("Download failed - no result returned");
      }

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      const contentLength = (fileInfo as any).size || 0;

      // Determine mime type from filename or response
      let mimeType = "application/octet-stream";
      const ext = safeFilename.toLowerCase().split(".").pop();
      if (ext) {
        const mimeMap: Record<string, string> = {
          txt: "text/plain",
          pdf: "application/pdf",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          gif: "image/gif",
          mp3: "audio/mpeg",
          mp4: "video/mp4",
          csv: "text/csv",
          json: "application/json",
          md: "text/markdown",
        };
        mimeType = mimeMap[ext] || mimeType;
      }

      return {
        uri: result.uri,
        contentLength,
        mimeType,
      };
    } catch (error: any) {
      // Handle specific error types
      if (error.message?.includes("network") || error.message?.includes("Network")) {
        throw new Error(
          "No network connection. Please check your internet and try again.",
        );
      }
      if (error.message?.includes("404")) {
        throw new Error("File not found on server.");
      }
      console.error("Download error:", error);
      throw new Error(`Download failed: ${error.message || "Unknown error"}`);
    }
  },

  // Native-specific: share file using Sharing API
  shareFile: async (uri: string): Promise<void> => {
    const sharingModule = await getSharingModule();
    if (!sharingModule) {
      throw new Error("expo-sharing not installed");
    }
    if (await sharingModule.isAvailableAsync()) {
      await sharingModule.shareAsync(uri);
    } else {
      throw new Error("Sharing is not available on this device");
    }
  },

  // Native-specific: delete cached file
  deleteCachedFile: async (uri: string): Promise<void> => {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch (error) {
      console.error("Error deleting cached file:", error);
    }
  },

  // Native-specific: get file info
  getFileInfo: async (
    uri: string,
  ): Promise<{ exists: boolean; size?: number; modificationTime?: number }> => {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        return { exists: false };
      }
      return {
        exists: true,
        size: (info as any).size,
        modificationTime: (info as any).modificationTime,
      };
    } catch {
      return { exists: false };
    }
  },

  // Get download URL for a file (used for offline caching)
  getDownloadUrl: async (nodeId: string): Promise<string> => {
    const token = await AsyncStorage.getItem("authToken");
    const baseUrl = api.defaults.baseURL || "";
    return `${baseUrl}/files/${nodeId}/download${token ? `?token=${token}` : ""}`;
  },

  // Read file content as text (for editing)
  readFileAsText: async (uri: string): Promise<string> => {
    try {
      const content = await FileSystem.readAsStringAsync(uri);
      return content;
    } catch (error) {
      console.error("Error reading file:", error);
      throw new Error("Failed to read file");
    }
  },

  // Write text content to file
  writeTextToFile: async (uri: string, content: string): Promise<void> => {
    try {
      await FileSystem.writeAsStringAsync(uri, content);
    } catch (error) {
      console.error("Error writing file:", error);
      throw new Error("Failed to write file");
    }
  },
};

export default fileService;

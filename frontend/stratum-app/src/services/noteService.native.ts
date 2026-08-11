/**
 * @file
 * Native (React Native) note service implementation.
 *
 * Extends core note functionality with native platform features.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
// Native-specific note operations using Expo APIs
import api from "./api";
import { noteServiceCore, Attachment } from "./noteService.core";
import { Audio } from "expo-av";
// Note: expo-image-picker must be installed separately: npx expo install expo-image-picker
let ImagePicker: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ImagePicker = require("expo-image-picker");
} catch {
  ImagePicker = null;
}

// Re-export types
export * from "./noteService.core";

/** Native note service with Expo-based audio recording and image picker support. */
export const noteService = {
  ...noteServiceCore,

  // Native-specific: upload photo from URI
  uploadPhoto: async (noteId: string, photoUri: string): Promise<Attachment> => {
    const formData = new FormData();
    formData.append("file", {
      uri: photoUri,
      type: "image/jpeg",
      name: "photo.jpg",
    } as any);
    const response = await api.post(`/notes/${noteId}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  // Native-specific: upload audio from URI
  /**
   * Upload a recording as a note attachment.
   *
   * Shares its signature with the web implementation so cross-platform
   * callers type-check on both; native always takes the URI form.
   */
  uploadAudio: async (
    noteId: string,
    audioUri: Blob | string,
    filename: string = "voice-note.m4a",
  ): Promise<Attachment> => {
    if (typeof audioUri !== "string") {
      throw new Error("uploadAudio on native expects a URI, not a Blob");
    }
    const formData = new FormData();
    formData.append("file", {
      uri: audioUri,
      type: "audio/mp4",
      name: filename,
    } as any);
    const response = await api.post(`/notes/${noteId}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  // Native-specific: upload any file from URI
  uploadAttachment: async (
    noteId: string,
    fileUri: string,
    fileName: string,
    mimeType: string,
  ): Promise<Attachment> => {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      type: mimeType,
      name: fileName,
    } as any);
    const response = await api.post(`/notes/${noteId}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  // Native-specific: pick image using ImagePicker
  pickImage: async (): Promise<{
    uri: string;
    width: number;
    height: number;
  } | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Permission to access media library was denied");
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    };
  },

  // Native-specific: take photo using camera
  takePhoto: async (): Promise<{
    uri: string;
    width: number;
    height: number;
  } | null> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Permission to access camera was denied");
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    };
  },

  // Native-specific: create audio recorder using expo-av
  createAudioRecorder: () => {
    let recording: Audio.Recording | null = null;

    return {
      start: async () => {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== "granted") {
          throw new Error("Permission to access microphone was denied");
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        recording = new Audio.Recording();
        await recording.prepareToRecordAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY,
        );
        await recording.startAsync();
      },

      stop: async (): Promise<string> => {
        if (!recording) {
          throw new Error("No recording in progress");
        }

        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });

        const uri = recording.getURI();
        recording = null;

        if (!uri) {
          throw new Error("Failed to get recording URI");
        }

        return uri;
      },

      cancel: async () => {
        if (recording) {
          try {
            await recording.stopAndUnloadAsync();
          } catch {}
          recording = null;
        }
      },

      getStatus: async () => {
        if (!recording) return null;
        return await recording.getStatusAsync();
      },
    };
  },
};

export default noteService;

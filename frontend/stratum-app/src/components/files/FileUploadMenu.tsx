/**
 * STRATUM File Upload Menu
 *
 * Dropdown menu for file uploads with options:
 * - Take Photo (camera)
 * - Upload Photo (gallery)
 * - Upload Files (document picker)
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

interface FileUploadMenuProps {
  visible: boolean;
  onClose: () => void;
  onFileSelected: (files: SelectedFile[]) => void;
  allowMultiple?: boolean;
}

export interface SelectedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  type: "image" | "document";
}

export const FileUploadMenu: React.FC<FileUploadMenuProps> = ({
  visible,
  onClose,
  onFileSelected,
  allowMultiple = true,
}) => {
  const [loading, setLoading] = useState(false);

  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS === "web") return true;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera Permission", "Camera access is needed to take photos.", [
        { text: "OK" },
      ]);
      return false;
    }
    return true;
  };

  const requestMediaLibraryPermission = async (): Promise<boolean> => {
    if (Platform.OS === "web") return true;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Gallery Permission",
        "Photo library access is needed to upload photos.",
        [{ text: "OK" }],
      );
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images" as any,
        allowsEditing: true,
        quality: 0.8,
        exif: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = `photo_${Date.now()}.${asset.uri.split(".").pop() || "jpg"}`;

        const selectedFile: SelectedFile = {
          uri: asset.uri,
          name: fileName,
          mimeType: asset.mimeType || "image/jpeg",
          size: asset.fileSize,
          type: "image",
        };

        onFileSelected([selectedFile]);
        onClose();
      }
    } catch (error) {
      console.error("[FileUploadMenu] Camera error:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPhoto = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images" as any,
        allowsMultipleSelection: allowMultiple,
        allowsEditing: !allowMultiple,
        quality: 0.8,
        exif: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const selectedFiles: SelectedFile[] = result.assets.map((asset, index) => {
          const extension = asset.uri.split(".").pop() || "jpg";
          const fileName =
            asset.fileName || `photo_${Date.now()}_${index}.${extension}`;

          return {
            uri: asset.uri,
            name: fileName,
            mimeType: asset.mimeType || "image/jpeg",
            size: asset.fileSize,
            type: "image" as const,
          };
        });

        onFileSelected(selectedFiles);
        onClose();
      }
    } catch (error) {
      console.error("[FileUploadMenu] Gallery error:", error);
      Alert.alert("Error", "Failed to select photos. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFiles = async () => {
    setLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: allowMultiple,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const selectedFiles: SelectedFile[] = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || "application/octet-stream",
          size: asset.size,
          type: "document" as const,
        }));

        onFileSelected(selectedFiles);
        onClose();
      }
    } catch (error) {
      console.error("[FileUploadMenu] Document picker error:", error);
      Alert.alert("Error", "Failed to select files. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    {
      id: "camera",
      icon: "camera" as const,
      label: "Take Photo",
      description: "Use camera to capture a new photo",
      onPress: handleTakePhoto,
      color: "#22c55e",
    },
    {
      id: "gallery",
      icon: "images" as const,
      label: "Upload Photo",
      description: "Select from photo library",
      onPress: handleUploadPhoto,
      color: "#3b82f6",
    },
    {
      id: "files",
      icon: "document" as const,
      label: "Upload Files",
      description: "Browse documents and files",
      onPress: handleUploadFiles,
      color: "#a855f7",
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Upload</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Menu Items */}
          <View style={styles.menuItems}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.menuItem, loading && styles.menuItemDisabled]}
                onPress={item.onPress}
                disabled={loading}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: `${item.color}20` },
                  ]}
                >
                  <Ionicons name={item.icon} size={24} color={item.color} />
                </View>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemLabel}>{item.label}</Text>
                  <Text style={styles.menuItemDescription}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Loading indicator */}
          {loading && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          )}

          {/* Cancel Button */}
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderWidth: 1,
    borderColor: "#333",
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  closeButton: {
    padding: 4,
  },
  menuItems: {
    padding: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginVertical: 4,
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  menuItemDescription: {
    fontSize: 13,
    color: "#888",
  },
  loadingContainer: {
    padding: 16,
    alignItems: "center",
  },
  loadingText: {
    color: "#888",
    fontSize: 14,
  },
  cancelButton: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    backgroundColor: "#333",
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
});

export default FileUploadMenu;

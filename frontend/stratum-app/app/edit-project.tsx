/**
 * @file
 * Project editing screen.
 *
 * Allows editing of project name, description, and
 * RAN-LMI identification.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
  Platform,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { projectService } from "@/services/projectService";
import { authService } from "@/services/authService";
import { showAlert } from "@/utils/alert";
import ImageCropModal from "@/components/ui/ImageCropModal";
import { useColorScheme } from "@/hooks/use-color-scheme";
interface Member {
  id: string;
  display_name: string;
  email: string;
  role: "LEADER" | "RESEARCHER" | "GUEST";
}

interface _Project {
  id: string;
  name: string;
  description: string;
  ran_lmi_id?: string;
  owner_id: string;
  members?: Member[];
  created_at: string;
  updated_at: string;
}

export default function EditProjectScreen() {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const pageBackground = isDarkMode ? "#111111" : "#F7F7F7";
  const textPrimary = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const placeholderTextColor = isDarkMode ? "#666" : "#7A7A7A";

  const { projectId } = useLocalSearchParams();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ranLmiId, setRanLmiId] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  // Crop modal state (web only - native uses system crop UI)
  const [cropImage, setCropImage] = useState<{
    uri: string;
    mimeType: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const isNameMatch = confirmText.trim() === name.trim();

  const stackScreenOptions = {
    title: "Edit Project",
    headerTransparent: Platform.OS === "ios",
    headerBlurEffect: Platform.OS === "ios" ? "systemChromeMaterial" : undefined,
    headerStyle: Platform.OS === "ios" ? {} : { backgroundColor: pageBackground },
    headerTintColor: "#FF2A2A",
    headerTitleStyle: {
      color: textPrimary,
      fontSize: 18,
      fontWeight: "600" as const,
    },
    headerBackTitle: "Project",
    headerShown: true,
  };

  useEffect(() => {
    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const [projectData, currentUser] = await Promise.all([
        projectService.getProject(projectId as string),
        authService.getCurrentUser(),
      ]);
      setName(projectData.name);
      setDescription(projectData.description || "");
      setRanLmiId(projectData.ran_lmi_id || "");
      setCoverImageUrl(projectData.cover_image_url || null);

      // Check if current user is the owner
      const userId = currentUser?.id;
      setIsOwner(userId === projectData.owner_id);
    } catch (error) {
      console.error("Error loading project:", error);
      showAlert("Error", "Failed to load project", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert("Error", "Please enter a project name");
      return;
    }

    // Only the owner can update project settings
    if (!isOwner) {
      showAlert(
        "Permission Denied",
        "Only the project leader can modify project settings.",
      );
      return;
    }

    setSaving(true);
    try {
      await projectService.updateProject(projectId as string, {
        name: name.trim(),
        description: description.trim() || null,
        ran_lmi_id: ranLmiId.trim() || null,
      });
      showAlert("Success", "Project updated successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error("Failed to update project:", error);
      const message =
        error?.detail ||
        error?.message ||
        "Failed to save changes. Please try again.";
      showAlert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
  ];
  const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  };

  /** Upload the final (cropped) image */
  const uploadCoverImage = async (uri: string, mimeType: string) => {
    const ext = MIME_TO_EXT[mimeType.toLowerCase()] || "jpg";
    setUploadingImage(true);
    try {
      const updated = await projectService.uploadCoverImage(projectId as string, {
        uri,
        type: mimeType,
        name: `cover.${ext}`,
      });
      setCoverImageUrl(updated.cover_image_url || null);
    } catch (error: any) {
      const message =
        error?.detail || error?.message || "Failed to upload cover image.";
      showAlert("Error", message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePickCoverImage = async () => {
    if (!isOwner) {
      showAlert(
        "Permission Denied",
        "Only the project leader can change the cover image.",
      );
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert("Permission Required", "Please allow access to your photo library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      // On native, allowsEditing gives system crop UI with 3:2 aspect
      allowsEditing: Platform.OS !== "web",
      aspect: [16, 5],
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || "image/jpeg";
    if (!ALLOWED_TYPES.includes(mimeType.toLowerCase())) {
      showAlert(
        "Unsupported Format",
        "Only JPEG, PNG, WebP, GIF, or HEIC photos are allowed as cover images.",
      );
      return;
    }

    if (Platform.OS === "web") {
      // On web, show our custom crop modal
      setCropImage({ uri: asset.uri, mimeType });
    } else {
      // On native, the system already cropped - upload directly
      await uploadCoverImage(asset.uri, mimeType);
    }
  };

  /** Called when the crop modal produces a cropped image */
  const handleCropComplete = async (croppedUri: string) => {
    const mimeType = cropImage?.mimeType || "image/jpeg";
    setCropImage(null);
    await uploadCoverImage(croppedUri, mimeType);
  };

  const handleRemoveCoverImage = async () => {
    if (!isOwner) return;
    setUploadingImage(true);
    try {
      await projectService.deleteCoverImage(projectId as string);
      setCoverImageUrl(null);
    } catch (error: any) {
      const message =
        error?.detail || error?.message || "Failed to remove cover image.";
      showAlert("Error", message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDelete = () => {
    setConfirmText("");
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      await projectService.deleteProject(projectId as string);
      setShowDeleteModal(false);
      // Navigate directly to root; RootLayout will redirect based on auth
      router.replace("/");
    } catch (error: any) {
      console.error("Failed to delete project:", error);
      const message =
        error?.detail ||
        error?.message ||
        "Failed to delete project. Please try again.";
      showAlert("Error", message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={stackScreenOptions} />
        <ActivityIndicator size="large" color="#FF2A2A" />
        <Text style={styles.loadingText}>Loading project...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={stackScreenOptions} />

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <Text style={styles.pageTitle}>Edit Project</Text>

          <Text style={styles.label}>Cover Image</Text>
          {coverImageUrl ? (
            <View style={styles.coverImageContainer}>
              <Image
                source={{ uri: coverImageUrl }}
                style={styles.coverImagePreview}
                resizeMode="cover"
              />
              <View style={styles.coverImageActions}>
                <TouchableOpacity
                  style={styles.coverImageButton}
                  onPress={handlePickCoverImage}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <ActivityIndicator color={textPrimary} size="small" />
                  ) : (
                    <Text style={styles.coverImageButtonText}>Change Photo</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.coverImageButton, styles.coverImageRemoveButton]}
                  onPress={handleRemoveCoverImage}
                  disabled={uploadingImage}
                >
                  <Text style={styles.coverImageRemoveText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.coverImagePlaceholder}
              onPress={handlePickCoverImage}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <ActivityIndicator color="#FF2A2A" />
              ) : (
                <>
                  <Text style={styles.coverImagePlaceholderIcon}>🖼️</Text>
                  <Text style={styles.coverImagePlaceholderText}>
                    Add Cover Photo
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Project Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter project name"
            placeholderTextColor={placeholderTextColor}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>RAN/LMI ID</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter RAN/LMI ID"
            placeholderTextColor={placeholderTextColor}
            value={ranLmiId}
            onChangeText={setRanLmiId}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter project description"
            placeholderTextColor={placeholderTextColor}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={textPrimary} />
            ) : (
              <Text style={styles.buttonText}>Save Changes</Text>
            )}
          </TouchableOpacity>

          {isOwner ? (
            <TouchableOpacity
              style={[styles.deleteButton]}
              onPress={handleDelete}
              disabled={saving || deleting}
            >
              <Text style={styles.deleteButtonText}>
                {deleting ? "Deleting..." : "Delete Project"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.deleteButton, styles.disabledButton]}>
              <Text style={styles.disabledButtonText}>Delete Project</Text>
              <Text style={styles.permissionHint}>
                Only the project leader can delete this project
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Delete confirmation modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm deletion</Text>
            <Text style={styles.modalText}>
              This action will permanently delete this project and all its notes. To
              confirm, type the project name exactly:
            </Text>
            <Text
              style={[
                styles.modalText,
                { fontWeight: "700", color: textPrimary, marginBottom: 12 },
              ]}
            >
              {name}
            </Text>
            <TextInput
              style={styles.confirmInput}
              placeholder="Type project name to confirm"
              placeholderTextColor={placeholderTextColor}
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalDeleteButton,
                  (!isNameMatch || deleting) && { opacity: 0.6 },
                ]}
                onPress={confirmDelete}
                disabled={!isNameMatch || deleting}
              >
                <Text style={[styles.modalButtonText, styles.modalDeleteText]}>
                  {deleting ? "Deleting..." : "Delete"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Crop Modal (web only) */}
      {cropImage && (
        <ImageCropModal
          visible={!!cropImage}
          imageUri={cropImage.uri}
          mimeType={cropImage.mimeType}
          onCrop={handleCropComplete}
          onCancel={() => setCropImage(null)}
        />
      )}
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
      padding: 24,
    },
    content: {
      flex: 1,
    },
    loadingText: {
      fontSize: 16,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginTop: 16,
      letterSpacing: 0.5,
    },
    form: {
      padding: 24,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 32,
      letterSpacing: 0.5,
    },
    label: {
      fontSize: 16,
      fontWeight: "600",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 8,
      letterSpacing: 0.3,
      marginTop: 16,
    },
    input: {
      backgroundColor: isDarkMode ? "#1E1E1E" : "#FFFFFF",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? "#333" : "#D9D9D9",
      fontSize: 16,
    },
    textArea: {
      height: 100,
      textAlignVertical: "top",
    },
    coverImageContainer: {
      marginBottom: 16,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: isDarkMode ? "#333" : "#D9D9D9",
    },
    coverImagePreview: {
      width: "100%",
      aspectRatio: 3 / 2,
    },
    coverImageActions: {
      flexDirection: "row",
      gap: 8,
      padding: 10,
      backgroundColor: isDarkMode ? "#1E1E1E" : "#FFFFFF",
    },
    coverImageButton: {
      flex: 1,
      backgroundColor: isDarkMode ? "#2A2A2A" : "#F1F1F1",
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: "center",
      borderWidth: 1,
      borderColor: isDarkMode ? "#444" : "#D0D0D0",
    },
    coverImageButtonText: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 14,
      fontWeight: "600",
    },
    coverImageRemoveButton: {
      borderColor: "#FF4444",
    },
    coverImageRemoveText: {
      color: "#FF4444",
      fontSize: 14,
      fontWeight: "600",
    },
    coverImagePlaceholder: {
      height: 120,
      backgroundColor: isDarkMode ? "#1E1E1E" : "#FFFFFF",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#333" : "#D9D9D9",
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      gap: 8,
    },
    coverImagePlaceholderIcon: {
      fontSize: 32,
    },
    coverImagePlaceholderText: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontSize: 14,
      fontWeight: "600",
      letterSpacing: 0.3,
    },
    button: {
      backgroundColor: "#FF2A2A",
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 24,
      shadowColor: "#FF2A2A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    deleteButton: {
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 12,
      borderWidth: 1,
      borderColor: "#FF4444",
    },
    deleteButtonText: {
      color: "#FF4444",
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    disabledButton: {
      borderColor: isDarkMode ? "#555" : "#B0B0B0",
      opacity: 0.6,
    },
    disabledButtonText: {
      color: isDarkMode ? "#666" : "#7A7A7A",
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    permissionHint: {
      color: "#FF6B6B",
      fontSize: 12,
      marginTop: 6,
      fontStyle: "italic",
    },
    buttonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
      letterSpacing: 0.5,
    },
    cancelButton: {
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 12,
    },
    cancelButtonText: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontSize: 16,
      letterSpacing: 0.5,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: isDarkMode ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.24)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalCard: {
      backgroundColor: isDarkMode ? "#1E1E1E" : "#FFFFFF",
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? "#333" : "#D9D9D9",
      width: "100%",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 8,
    },
    modalText: {
      fontSize: 14,
      color: isDarkMode ? "#CCCCCC" : "#555555",
      marginBottom: 16,
      lineHeight: 20,
    },
    confirmInput: {
      backgroundColor: isDarkMode ? "#121212" : "#FFFFFF",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#333" : "#D9D9D9",
      marginBottom: 16,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
    },
    modalButton: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: isDarkMode ? "#2A2A2A" : "#E8E8E8",
    },
    modalButtonText: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 14,
      fontWeight: "600",
    },
    modalDeleteButton: {
      backgroundColor: isDarkMode ? "#3A0C0C" : "#FFEAEA",
      borderWidth: 1,
      borderColor: "#FF4444",
    },
    modalDeleteText: {
      color: "#FF4444",
    },
  });

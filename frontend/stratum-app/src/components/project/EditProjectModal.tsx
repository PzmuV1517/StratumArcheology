/**
 * @file
 * Web-modal version of the Edit Project screen.
 *
 * Uses project data already loaded in ProjectDetailContext and saves
 * in-place without navigating away. Used on web from the sidebar More menu.
 */
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import ImageCropModal from "@/src/components/ui/ImageCropModal";
import { projectService } from "@/src/services/projectService";
import { showAlert } from "@/src/utils/alert";
import { useProjectDetail } from "@/src/contexts/ProjectDetailContext";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const ALLOWED_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/gif", "image/heic", "image/heif",
];
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
  "image/webp": "webp", "image/gif": "gif", "image/heic": "heic", "image/heif": "heif",
};

export default function EditProjectModal({ visible, onClose }: Props) {
  const { project, isOwner, refreshProject } = useProjectDetail();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ranLmiId, setRanLmiId] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cropImage, setCropImage] = useState<{ uri: string; mimeType: string } | null>(null);

  // Sync form fields when modal opens or project changes
  useEffect(() => {
    if (visible && project) {
      setName(project.name || "");
      setDescription(project.description || "");
      setRanLmiId((project as any).ran_lmi_id || "");
      setCoverImageUrl((project as any).cover_image_url || null);
    }
  }, [visible, project]);

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert("Error", "Please enter a project name");
      return;
    }
    if (!isOwner) {
      showAlert("Permission Denied", "Only the project leader can modify project settings.");
      return;
    }
    setSaving(true);
    try {
      await projectService.updateProject(project!.id, {
        name: name.trim(),
        description: description.trim() || null,
        ran_lmi_id: ranLmiId.trim() || null,
      });
      await refreshProject();
      onClose();
    } catch (error: any) {
      showAlert("Error", error?.detail || error?.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const uploadCoverImage = async (uri: string, mimeType: string) => {
    const ext = MIME_TO_EXT[mimeType.toLowerCase()] || "jpg";
    setUploadingImage(true);
    try {
      const updated = await projectService.uploadCoverImage(project!.id, {
        uri, type: mimeType, name: `cover.${ext}`,
      });
      setCoverImageUrl((updated as any).cover_image_url || null);
    } catch (error: any) {
      showAlert("Error", error?.detail || error?.message || "Failed to upload cover image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePickCoverImage = async () => {
    if (!isOwner) {
      showAlert("Permission Denied", "Only the project leader can change the cover image.");
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
      allowsEditing: Platform.OS !== "web",
      aspect: [16, 5],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType || "image/jpeg";
    if (!ALLOWED_TYPES.includes(mimeType.toLowerCase())) {
      showAlert("Unsupported Format", "Only JPEG, PNG, WebP, GIF, or HEIC photos are allowed.");
      return;
    }
    if (Platform.OS === "web") {
      setCropImage({ uri: asset.uri, mimeType });
    } else {
      await uploadCoverImage(asset.uri, mimeType);
    }
  };

  const handleRemoveCoverImage = async () => {
    if (!isOwner || !project) return;
    setUploadingImage(true);
    try {
      await projectService.deleteCoverImage(project.id);
      setCoverImageUrl(null);
    } catch (error: any) {
      showAlert("Error", error?.detail || error?.message || "Failed to remove cover image.");
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={s.card}>
              <View style={s.header}>
                <Text style={s.title}>Edit Project</Text>
                <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
                  <Text style={s.closeX}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
                {/* Cover Image */}
                <Text style={s.label}>Cover Image</Text>
                {coverImageUrl ? (
                  <View style={s.coverContainer}>
                    <Image source={{ uri: coverImageUrl }} style={s.coverPreview} resizeMode="cover" />
                    <View style={s.coverActions}>
                      <TouchableOpacity style={s.coverBtn} onPress={handlePickCoverImage} disabled={uploadingImage}>
                        {uploadingImage
                          ? <ActivityIndicator color="#F5F5F5" size="small" />
                          : <Text style={s.coverBtnText}>Change Photo</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.coverBtn, s.coverRemoveBtn]} onPress={handleRemoveCoverImage} disabled={uploadingImage}>
                        <Text style={s.coverRemoveText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={s.coverPlaceholder} onPress={handlePickCoverImage} disabled={uploadingImage}>
                    {uploadingImage
                      ? <ActivityIndicator color="#FF2A2A" />
                      : <>
                          <Text style={s.coverPlaceholderIcon}>🖼️</Text>
                          <Text style={s.coverPlaceholderText}>Add Cover Photo</Text>
                        </>}
                  </TouchableOpacity>
                )}

                {/* Name */}
                <Text style={s.label}>Project Name *</Text>
                <TextInput
                  style={s.input}
                  placeholder="Enter project name"
                  placeholderTextColor="#666"
                  value={name}
                  onChangeText={setName}
                />

                {/* RAN/LMI */}
                <Text style={s.label}>RAN/LMI ID</Text>
                <TextInput
                  style={s.input}
                  placeholder="Enter RAN/LMI ID"
                  placeholderTextColor="#666"
                  value={ranLmiId}
                  onChangeText={setRanLmiId}
                />

                {/* Description */}
                <Text style={s.label}>Description</Text>
                <TextInput
                  style={[s.input, s.textArea]}
                  placeholder="Enter project description"
                  placeholderTextColor="#666"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                {/* Actions */}
                <TouchableOpacity
                  style={[s.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#F5F5F5" />
                    : <Text style={s.saveBtnText}>Save Changes</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={saving}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <View style={{ height: 16 }} />
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Image crop (web only) */}
      {cropImage && (
        <ImageCropModal
          visible={!!cropImage}
          imageUri={cropImage.uri}
          mimeType={cropImage.mimeType}
          onCrop={async (uri) => {
            const mimeType = cropImage.mimeType;
            setCropImage(null);
            await uploadCoverImage(uri, mimeType);
          }}
          onCancel={() => setCropImage(null)}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    width: 480,
    maxHeight: 680,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#2A2A2A",
  },
  closeX: {
    fontSize: 14,
    color: "#9A9A9A",
  },
  scroll: {
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9A9A9A",
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#0A0A0A",
    color: "#F5F5F5",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    fontSize: 15,
  },
  textArea: {
    height: 88,
    textAlignVertical: "top",
  },
  coverContainer: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  coverPreview: {
    width: "100%",
    aspectRatio: 3 / 2,
  },
  coverActions: {
    flexDirection: "row",
    gap: 8,
    padding: 8,
    backgroundColor: "#111111",
  },
  coverBtn: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
  },
  coverBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F5F5F5",
  },
  coverRemoveBtn: {
    backgroundColor: "rgba(255,42,42,0.12)",
  },
  coverRemoveText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FF2A2A",
  },
  coverPlaceholder: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderStyle: "dashed",
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  coverPlaceholderIcon: { fontSize: 24 },
  coverPlaceholderText: { fontSize: 14, color: "#9A9A9A" },
  saveBtn: {
    marginTop: 20,
    backgroundColor: "#FF2A2A",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F5F5F5",
  },
  cancelBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#2A2A2A",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#9A9A9A",
  },
});

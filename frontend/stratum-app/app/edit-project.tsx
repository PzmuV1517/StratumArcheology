import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { projectService } from "../src/services/projectService";
import { authService } from "../src/services/authService";
import { showAlert } from "../src/utils/alert";

interface Member {
  id: string;
  display_name: string;
  email: string;
  role: "LEADER" | "RESEARCHER" | "GUEST";
}

interface Project {
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
  const { projectId } = useLocalSearchParams();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ranLmiId, setRanLmiId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const isNameMatch = confirmText.trim() === name.trim();

  useEffect(() => {
    loadProject();
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
        <Stack.Screen
          options={{
            title: "Edit Project",
            headerStyle: { backgroundColor: "#111111" },
            headerTintColor: "#FF2A2A",
            headerTitleStyle: {
              color: "#F5F5F5",
              fontSize: 18,
              fontWeight: "600",
            },
            headerBackTitle: "Project",
            headerShown: true,
          }}
        />
        <ActivityIndicator size="large" color="#FF2A2A" />
        <Text style={styles.loadingText}>Loading project...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Edit Project",
          headerStyle: { backgroundColor: "#111111" },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: {
            color: "#F5F5F5",
            fontSize: 18,
            fontWeight: "600",
          },
          headerBackTitle: "Project",
          headerShown: true,
        }}
      />

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <Text style={styles.pageTitle}>Edit Project</Text>

          <Text style={styles.label}>Project Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter project name"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>RAN/LMI ID</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter RAN/LMI ID"
            placeholderTextColor="#666"
            value={ranLmiId}
            onChangeText={setRanLmiId}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter project description"
            placeholderTextColor="#666"
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
              <ActivityIndicator color="#F5F5F5" />
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
                { fontWeight: "700", color: "#F5F5F5", marginBottom: 12 },
              ]}
            >
              {name}
            </Text>
            <TextInput
              style={styles.confirmInput}
              placeholder="Type project name to confirm"
              placeholderTextColor="#666"
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111111",
    padding: 24,
  },
  content: {
    flex: 1,
  },
  loadingText: {
    fontSize: 16,
    color: "#9A9A9A",
    marginTop: 16,
    letterSpacing: 0.5,
  },
  form: {
    padding: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 32,
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 8,
    letterSpacing: 0.3,
    marginTop: 16,
  },
  input: {
    backgroundColor: "#1E1E1E",
    color: "#F5F5F5",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#333",
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
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
    borderColor: "#555",
    opacity: 0.6,
  },
  disabledButtonText: {
    color: "#666",
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
    color: "#F5F5F5",
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
    color: "#9A9A9A",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333",
    width: "100%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: "#CCCCCC",
    marginBottom: 16,
    lineHeight: 20,
  },
  confirmInput: {
    backgroundColor: "#121212",
    color: "#F5F5F5",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
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
    backgroundColor: "#2A2A2A",
  },
  modalButtonText: {
    color: "#F5F5F5",
    fontSize: 14,
    fontWeight: "600",
  },
  modalDeleteButton: {
    backgroundColor: "#3A0C0C",
    borderWidth: 1,
    borderColor: "#FF4444",
  },
  modalDeleteText: {
    color: "#FF4444",
  },
});

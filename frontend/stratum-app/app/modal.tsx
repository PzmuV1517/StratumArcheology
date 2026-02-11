/**
 * Create Project Screen
 * Clean design with iOS Liquid Glass support
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { projectService } from "../src/services/projectService";
import { showAlert } from "../src/utils/alert";

const isIOS = Platform.OS === "ios";

// Wrapper component for glass effect
const GlassCard = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) => {
  return <View style={[styles.solidCard, style]}>{children}</View>;
};

const GlassButton = ({
  onPress,
  title,
  variant = "primary",
  icon,
  disabled,
  loading,
}: {
  onPress: () => void;
  title: string;
  variant?: "primary" | "secondary";
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
}) => {
  const isPrimary = variant === "primary";
  const buttonContent = (
    <>
      {icon && (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={isPrimary ? "#FFFFFF" : "#9A9A9A"}
          style={{ marginRight: 8 }}
        />
      )}
      {loading && isPrimary ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text
          style={[styles.buttonText, !isPrimary && styles.secondaryButtonText]}
        >
          {title}
        </Text>
      )}
    </>
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        isPrimary ? styles.primaryButton : styles.secondaryButton,
        disabled && styles.disabledButton,
      ]}
    >
      {buttonContent}
    </TouchableOpacity>
  );
};

export default function CreateProjectModal() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ranLmiId, setRanLmiId] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) {
      showAlert("Error", "Please enter a project name");
      return;
    }

    if (!ranLmiId.trim()) {
      showAlert("Error", "Please enter a RAN/LMI ID");
      return;
    }

    setLoading(true);
    try {
      const newProject = await projectService.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        ran_lmi_id: ranLmiId.trim(),
      });

      if (newProject?.id) {
        router.replace(`/project/${newProject.id}`);
      } else {
        showAlert("Success", "Project created successfully!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error: unknown) {
      const message =
        (error as { detail?: string })?.detail ||
        (error as Error)?.message ||
        "Failed to create project. Please try again.";
      showAlert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={isIOS ? "padding" : "height"}
    >
      <Stack.Screen
        options={{
          title: "New Project",
          headerTransparent: isIOS,
          headerBlurEffect: isIOS ? "systemChromeMaterial" : undefined,
          headerStyle: isIOS ? {} : { backgroundColor: "#111111" },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: { color: "#F5F5F5", fontWeight: "600" },
          presentation: "modal",
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Icon */}
        <View style={styles.headerIcon}>
          <Ionicons name="folder-open" size={48} color="#FF2A2A" />
        </View>

        <Text style={styles.title}>Create New Project</Text>
        <Text style={styles.subtitle}>
          Start a new archaeological project to organize your excavation data
        </Text>

        {/* Form Card */}
        <GlassCard style={styles.formCard}>
          {/* Project Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              <Ionicons name="text" size={14} color="#9A9A9A" /> Project Name
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Glina Archaeological Site"
              placeholderTextColor="#555"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* RAN/LMI ID */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              <Ionicons name="key" size={14} color="#9A9A9A" /> RAN/LMI ID
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., RAN-2026-001"
              placeholderTextColor="#555"
              value={ranLmiId}
              onChangeText={setRanLmiId}
              autoCapitalize="characters"
            />
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              <Ionicons name="document-text" size={14} color="#9A9A9A" /> Description
              <Text style={styles.optionalLabel}> (optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Brief description of the excavation site..."
              placeholderTextColor="#555"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </GlassCard>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <GlassButton
            onPress={handleCreate}
            title="Create Project"
            variant="primary"
            icon="add-circle"
            disabled={!name.trim() || !ranLmiId.trim()}
            loading={loading}
          />

          <GlassButton
            onPress={() => router.back()}
            title="Cancel"
            variant="secondary"
            loading={loading}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  headerIcon: {
    alignItems: "center",
    marginBottom: 16,
    marginTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#9A9A9A",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  formCard: {
    marginBottom: 24,
  },
  glassCard: {
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
  },
  blurCard: {
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  solidCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9A9A9A",
    marginBottom: 8,
  },
  optionalLabel: {
    fontWeight: "400",
    color: "#666",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  buttonContainer: {
    gap: 12,
  },
  buttonTouchable: {
    borderRadius: 14,
    overflow: "hidden",
  },
  primaryButtonGlass: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: "rgba(255, 42, 42, 0.4)",
  },
  primaryButtonBlur: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: "rgba(255, 42, 42, 0.3)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF2A2A",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButtonText: {
    color: "#9A9A9A",
  },
});

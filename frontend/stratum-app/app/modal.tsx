import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { projectService } from "../src/services/projectService";

export default function CreateProjectModal() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ranLmiId, setRanLmiId] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a project name");
      return;
    }

    if (!ranLmiId.trim()) {
      Alert.alert("Error", "Please enter a RAN/LMI ID");
      return;
    }

    setLoading(true);
    try {
      const newProject = await projectService.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        ran_lmi_id: ranLmiId.trim(),
      });

      // Navigate directly to the newly created project
      if (newProject?.id) {
        router.replace(`/project/${newProject.id}`);
      } else {
        // Fallback if no project ID returned
        Alert.alert("Success", "Project created successfully!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      const message =
        error?.detail ||
        error?.message ||
        "Failed to create project. Please try again.";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>Create New Project</Text>

        <Text style={styles.label}>Project Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter project name"
          placeholderTextColor="#666"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>RAN/LMI ID *</Text>
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
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Project</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  form: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 32,
    textAlign: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#444444",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#FF2A2A",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 32,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  cancelButtonText: {
    color: "#999999",
    fontSize: 16,
    fontWeight: "600",
  },
});

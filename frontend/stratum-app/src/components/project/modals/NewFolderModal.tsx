/**
 * @file
 * New folder creation modal component.
 *
 * Modal dialog for creating new folders within the
 * project file hierarchy.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import {
  ProjectModalShell,
  useProjectModalTheme,
} from "@/components/project/modals/ProjectModalPrimitives";

export default function NewFolderModal({
  visible,
  onCancel,
  onCreate,
}: {
  visible: boolean;
  onCancel: () => void;
  onCreate: (name: string) => void;
}) {
  const { styles: projectModalStyles, placeholderTextColor } =
    useProjectModalTheme();
  const [name, setName] = useState("");
  useEffect(() => {
    if (visible) setName("");
  }, [visible]);

  return (
    <ProjectModalShell
      visible={visible}
      onRequestClose={onCancel}
      title="New Folder"
      description="Enter a name for the new folder"
    >
      <TextInput
        style={projectModalStyles.input}
        placeholder="Folder name"
        placeholderTextColor={placeholderTextColor}
        value={name}
        onChangeText={setName}
      />
      <View style={projectModalStyles.actions}>
        <TouchableOpacity style={projectModalStyles.button} onPress={onCancel}>
          <Text style={projectModalStyles.buttonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[projectModalStyles.button, projectModalStyles.primary]}
          onPress={() => onCreate(name.trim())}
        >
          <Text style={projectModalStyles.buttonText}>Create</Text>
        </TouchableOpacity>
      </View>
    </ProjectModalShell>
  );
}

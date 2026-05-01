/**
 * @file
 * Rename modal component.
 *
 * Modal dialog for renaming files, folders, or other
 * project resources.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import {
  ProjectModalShell,
  useProjectModalTheme,
} from "@/components/project/modals/ProjectModalPrimitives";

export default function RenameModal({
  visible,
  currentName,
  onCancel,
  onRename,
  isFile: _isFile,
}: {
  visible: boolean;
  currentName: string;
  isFile: boolean;
  onCancel: () => void;
  onRename: (newBaseName: string) => void;
}) {
  const { styles: projectModalStyles, placeholderTextColor } =
    useProjectModalTheme();
  const [name, setName] = useState("");
  useEffect(() => {
    if (visible) setName(currentName.replace(/\.[^.]+$/, ""));
  }, [visible, currentName]);

  return (
    <ProjectModalShell
      visible={visible}
      onRequestClose={onCancel}
      title="Rename"
      description={`Enter a new name for "${currentName}"`}
    >
      <TextInput
        style={projectModalStyles.input}
        placeholder="New name"
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
          onPress={() => onRename(name.trim())}
        >
          <Text style={projectModalStyles.buttonText}>Rename</Text>
        </TouchableOpacity>
      </View>
    </ProjectModalShell>
  );
}

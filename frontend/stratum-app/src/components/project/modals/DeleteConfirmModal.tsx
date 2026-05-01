/**
 * @file
 * Delete confirmation modal component.
 *
 * Confirmation dialog for destructive delete operations
 * with clear warning text.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import {
  ProjectModalShell,
  useProjectModalTheme,
} from "@/components/project/modals/ProjectModalPrimitives";

export default function DeleteConfirmModal({
  visible,
  name,
  isFolder,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  name: string;
  isFolder: boolean;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { styles: projectModalStyles, destructiveTextColor } =
    useProjectModalTheme();

  return (
    <ProjectModalShell
      visible={visible}
      onRequestClose={onCancel}
      title={`Delete "${name}"?`}
      description={`This will permanently delete ${
        isFolder ? "this folder and all of its contents" : "this item"
      }. This action cannot be undone.`}
    >
      <View style={projectModalStyles.actions}>
        <TouchableOpacity
          style={projectModalStyles.button}
          onPress={onCancel}
          disabled={isDeleting}
        >
          <Text style={projectModalStyles.buttonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            projectModalStyles.button,
            projectModalStyles.danger,
            isDeleting && { opacity: 0.7 },
          ]}
          onPress={onConfirm}
          disabled={isDeleting}
        >
          <Text
            style={[projectModalStyles.buttonText, { color: destructiveTextColor }]}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Text>
        </TouchableOpacity>
      </View>
    </ProjectModalShell>
  );
}

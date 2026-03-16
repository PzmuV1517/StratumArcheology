/**
 * @file
 * Delete confirmation modal component.
 *
 * Confirmation dialog for destructive delete operations
 * with clear warning text.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import {
  ProjectModalShell,
  projectModalStyles,
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
          <Text style={[projectModalStyles.buttonText, { color: "#FF4444" }]}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Text>
        </TouchableOpacity>
      </View>
    </ProjectModalShell>
  );
}

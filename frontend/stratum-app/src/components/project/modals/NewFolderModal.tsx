/**
 * @file
 * New folder creation modal component.
 *
 * Modal dialog for creating new folders within the
 * project file hierarchy.
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
import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import {
  ProjectModalShell,
  projectModalStyles,
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
        placeholderTextColor="#666"
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

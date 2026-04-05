/**
 * @file
 * Rename modal component.
 *
 * Modal dialog for renaming files, folders, or other
 * project resources.
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

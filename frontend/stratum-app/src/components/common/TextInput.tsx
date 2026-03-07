/**
 * @file
 * Themed text input component.
 *
 * A styled text input with label, error state, and
 * platform-appropriate behavior.
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
import {
  TextInput as RNTextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps as RNTextInputProps,
  ViewStyle,
  TextStyle,
  StyleProp,
  Platform,
} from "react-native";

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  required?: boolean;
}

/**
 * Styled text input with label, error state, and platform-appropriate behavior.
 * @param props - Component props
 * @returns The rendered component
 */
export default function TextInput({
  label,
  error,
  containerStyle,
  inputStyle,
  labelStyle,
  required = false,
  ...props
}: TextInputProps) {
  return (
    <View style={[viewStyles.container, containerStyle]}>
      {label && (
        <Text style={[textStyles.label, labelStyle]}>
          {label}
          {required && <Text style={textStyles.required}> *</Text>}
        </Text>
      )}
      <RNTextInput
        style={[
          inputStyles.input,
          error ? inputStyles.inputError : null,
          inputStyle,
          Platform.OS === "web" ? inputStyles.webInput : null,
        ]}
        placeholderTextColor="#8E8E93"
        selectionColor="#007AFF"
        {...props}
      />
      {error && <Text style={textStyles.errorText}>{error}</Text>}
    </View>
  );
}

// Separate StyleSheets for proper typing
const viewStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
});

const textStyles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  required: {
    color: "#FF3B30",
  },
  errorText: {
    fontSize: 12,
    color: "#FF3B30",
    marginTop: 4,
  },
});

const inputStyles = StyleSheet.create({
  input: {
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#3C3C3E",
  },
  inputError: {
    borderColor: "#FF3B30",
  },
  webInput: {
    // Web-only property - TypeScript may complain but it works at runtime
  } as TextStyle,
});

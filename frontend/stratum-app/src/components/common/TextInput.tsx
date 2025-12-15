import React from 'react';
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
} from 'react-native';

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  required?: boolean;
}

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
          Platform.OS === 'web' ? inputStyles.webInput : null,
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
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  required: {
    color: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
});

const inputStyles = StyleSheet.create({
  input: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3C3C3E',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  webInput: {
    // Web-only property - TypeScript may complain but it works at runtime
  } as TextStyle,
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

export default function MoveBanner({
  visible,
  itemName,
  onMoveHere,
  onCancel,
}: {
  visible: boolean;
  itemName: string;
  onMoveHere: () => void;
  onCancel: () => void;
}) {
  if (!visible) return null;

  // Truncate long names
  const displayName = itemName.length > 20 ? itemName.substring(0, 20) + '...' : itemName;

  return (
    <View style={styles.moveBanner}>
      <View style={styles.contentRow}>
        <Text style={styles.label} numberOfLines={2}>
          Select destination for "{displayName}" then tap Move Here
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.moveButton} onPress={onMoveHere}>
            <Text style={styles.moveButtonText}>Move Here</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  moveBanner: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 0, // Account for safe area
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#333',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
  },
  contentRow: {
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    color: '#F5F5F5',
    fontSize: 14,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  moveButton: {
    backgroundColor: '#FF2A2A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
  },
  moveButtonText: {
    color: '#F5F5F5',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#9A9A9A',
    fontWeight: '600',
    fontSize: 14,
  },
});

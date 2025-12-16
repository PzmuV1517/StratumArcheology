/**
 * Draft Status Indicator Component
 * 
 * Displays the current auto-save status with visual feedback:
 * - Saving: Blue text with spinner
 * - Saved: Green text
 * - Error: Red text
 * - Restored: Yellow text
 * 
 * Cross-platform: Works on both web and native
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SaveStatus, getDraftStatusDisplay } from '../../hooks/useAutoSave';

interface DraftStatusIndicatorProps {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Last save timestamp */
  lastSavedAt: Date | null;
  /** Whether a draft was restored */
  wasRestored: boolean;
  /** Custom style */
  style?: any;
}

export function DraftStatusIndicator({
  saveStatus,
  lastSavedAt,
  wasRestored,
  style,
}: DraftStatusIndicatorProps) {
  const { text, color, visible } = getDraftStatusDisplay(
    saveStatus,
    lastSavedAt,
    wasRestored
  );

  if (!visible) return null;

  return (
    <View style={[styles.container, style]}>
      {saveStatus === 'saving' && (
        <ActivityIndicator size="small" color={color} style={styles.spinner} />
      )}
      <Text style={[styles.text, { color }]}>{text}</Text>
    </View>
  );
}

/**
 * Compact draft indicator (just a dot)
 */
export function DraftDot({
  saveStatus,
  style,
}: {
  saveStatus: SaveStatus;
  style?: any;
}) {
  const getColor = () => {
    switch (saveStatus) {
      case 'saving':
        return '#60a5fa';
      case 'saved':
        return '#34d399';
      case 'error':
        return '#f87171';
      default:
        return 'transparent';
    }
  };

  if (saveStatus === 'idle') return null;

  return (
    <View
      style={[
        styles.dot,
        { backgroundColor: getColor() },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  spinner: {
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default DraftStatusIndicator;

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface AudioPanelProps {
  audioUrl: string;
}

export default function AudioPanel({ audioUrl }: AudioPanelProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.info}>Audio playback not supported yet on this platform.</Text>
      {!!audioUrl && <Text style={styles.name}>Audio: {audioUrl.split('/').pop()}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#0E0E0E',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { color: '#9A9A9A', fontSize: 14, textAlign: 'center' },
  name: { color: '#F5F5F5', fontSize: 12, marginTop: 8 },
});

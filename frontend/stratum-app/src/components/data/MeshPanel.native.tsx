import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MeshPanel({ name }: { name?: string }) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.info}>3D model preview is not supported on this platform yet.</Text>
      {!!name && <Text style={[styles.info, { opacity: 0.8, marginTop: 6 }]}>File: {name}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#0E0E0E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  info: { color: '#9A9A9A', fontSize: 14, textAlign: 'center' },
});

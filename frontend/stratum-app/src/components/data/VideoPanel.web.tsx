import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function VideoPanel({ src }: { src: string | null }) {
  return (
    <View style={styles.wrapper}>
      {src ? <video src={src} controls style={styles.video as any} /> : <View />}
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
    overflow: 'hidden',
  },
  video: { width: '100%', height: '100%' },
});

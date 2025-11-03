import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PointCloudPanel({ src, name }: { src: string | null; name?: string }) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.center}>
        <Text style={styles.title}>Point Cloud Preview</Text>
        <Text style={styles.info}>
          Web preview for point clouds is not enabled yet.
        </Text>
        <Text style={styles.info}>
          Download to view in an external point cloud app (e.g., Potree or CloudCompare).
        </Text>
        {!!name && <Text style={[styles.info, { opacity: 0.8 }]}>File: {name}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: '#0E0E0E', overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { color: '#F5F5F5', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  info: { color: '#9A9A9A', fontSize: 13, textAlign: 'center', marginTop: 4 },
});
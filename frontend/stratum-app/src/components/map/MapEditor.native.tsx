import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MapEditor({ projectId, canEdit = true }: { projectId: string; canEdit?: boolean }) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.text}>GPS editor is available on Web for now. Open this screen in a browser to draw and edit polygons.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: '#CFCFCF', textAlign: 'center', lineHeight: 22 },
});

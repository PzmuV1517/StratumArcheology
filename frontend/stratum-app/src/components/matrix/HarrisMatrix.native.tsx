import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function HarrisMatrix() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Harris Matrix is available on web only.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A' },
  text: { color: '#9A9A9A' },
});

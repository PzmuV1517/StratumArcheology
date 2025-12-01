import React, { useEffect, useState } from 'react';
import { Platform, View, Text, TouchableOpacity } from 'react-native';

interface Props {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export default function UniversalNavbar({ theme, onToggleTheme }: Props) {
  const [visible, setVisible] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMouseMove = (e: MouseEvent) => {
      // Show when cursor is within 24px of left edge
      const shouldShow = e.clientX <= 24;
      setVisible(shouldShow);
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  if (!visible) return null;

  if (Platform.OS !== 'web') {
    // Placeholder for native; simple top bar
    return (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 48, backgroundColor: theme === 'dark' ? '#111' : '#ffffff', borderBottomWidth: 1, borderBottomColor: theme === 'dark' ? '#2A2A2A' : '#cde7ff', zIndex: 1000, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 12 }}>
        <TouchableOpacity onPress={onToggleTheme} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme === 'dark' ? '#FF2A2A' : '#79b8ff' }}>
          <Text style={{ color: theme === 'dark' ? '#111' : '#014a94', fontWeight: '700' }}>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Web left-edge navbar
  return (
    <View style={{ position: 'fixed' as any, top: 0, left: 0, height: '100vh', width: 64, backgroundColor: theme === 'dark' ? '#0d0d0d' : '#ffffff', borderRightWidth: 1, borderRightColor: theme === 'dark' ? '#2A2A2A' : '#cde7ff', zIndex: 1000, alignItems: 'center', paddingTop: 12, gap: 12 }}>
      {/* Empty area for now */}
      <TouchableOpacity onPress={onToggleTheme} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme === 'dark' ? '#FF2A2A' : '#79b8ff' }}>
        <Text style={{ color: theme === 'dark' ? '#111' : '#014a94', fontWeight: '700' }}>{theme === 'dark' ? 'Light' : 'Dark'}</Text>
      </TouchableOpacity>
    </View>
  );
}

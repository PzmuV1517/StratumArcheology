import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

// Lightweight web viewer for .glb/.gltf using Google's <model-viewer> web component
// No runtime dependency in package.json; we inject the script once on web.

function ensureModelViewerScript() {
  if (typeof document === 'undefined') return;
  const ID = 'model-viewer-script';
  if (document.getElementById(ID)) return;
  const s = document.createElement('script');
  s.id = ID;
  s.type = 'module';
  s.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
  document.head.appendChild(s);
}

export default function MeshPanel({ src, name }: { src: string | null; name?: string }) {
  useEffect(() => {
    ensureModelViewerScript();
  }, []);

  return (
    <View style={styles.wrapper}>
      {src ? (
        // @ts-ignore - custom element available after script loads
        <model-viewer
          src={src}
          camera-controls
          exposure="1.0"
          shadow-intensity="0.5"
          style={styles.viewer as any}
          autoplay=""
          disable-zoom="false"
          ar-modes="webxr scene-viewer quick-look"
        />
      ) : (
        <View style={styles.fallback} />
      )}
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
  viewer: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
  fallback: { flex: 1 },
});

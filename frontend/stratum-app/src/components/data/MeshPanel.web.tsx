import React, { useEffect, useRef } from 'react';
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
  const viewerRef = useRef<any>(null);
  
  useEffect(() => {
    ensureModelViewerScript();
    
    // Keyboard zoom: dispatch synthetic wheel events to model-viewer
    // This triggers the exact same zoom code path as mouse scroll
    const onKey = (e: KeyboardEvent) => {
      const el = viewerRef.current;
      if (!el) return;
      
      const k = e.key;
      let deltaY = 0;
      
      if (k === 'i' || k === 'I') {
        deltaY = -100; // zoom in (negative = scroll up)
      } else if (k === 'o' || k === 'O') {
        deltaY = 100; // zoom out (positive = scroll down)
      } else {
        return;
      }

      // Create and dispatch a synthetic wheel event
      const wheelEvent = new WheelEvent('wheel', {
        deltaY,
        deltaMode: 0,
        clientX: el.offsetWidth / 2,
        clientY: el.offsetHeight / 2,
        bubbles: true,
        cancelable: true,
        view: window,
      });
      
      el.dispatchEvent(wheelEvent);
      e.preventDefault();
      e.stopPropagation();
    };
    
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true } as any);
  }, []);

  return (
    <View style={styles.wrapper}>
      {src ? (
        // @ts-ignore - custom element available after script loads
        <model-viewer
          src={src}
          camera-controls
          interaction-policy="always-allow"
          exposure="1.0"
          shadow-intensity="0.5"
          style={styles.viewer as any}
          autoplay=""
          ar-modes="webxr scene-viewer quick-look"
          ref={viewerRef}
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
    display: 'flex',
  },
  fallback: { flex: 1 },
});

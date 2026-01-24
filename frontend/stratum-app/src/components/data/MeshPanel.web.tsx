import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";

// Lightweight web viewer for .glb/.gltf using Google's <model-viewer> web component
// No runtime dependency in package.json; we inject the script once on web.

function ensureModelViewerScript() {
  if (typeof document === "undefined") return;
  const ID = "model-viewer-script";
  if (document.getElementById(ID)) return;
  const s = document.createElement("script");
  s.id = ID;
  s.type = "module";
  s.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
  document.head.appendChild(s);
}

export default function MeshPanel({
  src,
  name,
}: {
  src: string | null;
  name?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureModelViewerScript();

    if (!src || !containerRef.current) return;

    // Clear previous viewer
    containerRef.current.innerHTML = "";

    // Create model-viewer element directly
    const viewer = document.createElement("model-viewer");
    viewer.setAttribute("src", src);
    viewer.setAttribute("camera-controls", "");
    viewer.setAttribute("interaction-policy", "always-allow");
    viewer.setAttribute("exposure", "1.0");
    viewer.setAttribute("shadow-intensity", "0.5");
    viewer.setAttribute("autoplay", "");
    viewer.setAttribute("ar-modes", "webxr scene-viewer quick-look");
    viewer.style.width = "100%";
    viewer.style.height = "100%";
    viewer.style.display = "block";

    containerRef.current.appendChild(viewer);

    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      let deltaY = 0;
      if (k === "i" || k === "I")
        deltaY = -100; // zoom in
      else if (k === "o" || k === "O")
        deltaY = 100; // zoom out
      else return;

      try {
        const wheelEvent = new WheelEvent("wheel", {
          deltaY,
          deltaMode: 0,
          bubbles: true,
          cancelable: true,
          view: window,
        });
        viewer.dispatchEvent(wheelEvent);
      } catch {
        const evt: any = document.createEvent("Event");
        evt.initEvent("wheel", true, true);
        evt.deltaY = deltaY;
        viewer.dispatchEvent(evt);
      }

      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener("keydown", onKey, { capture: true });
    return () =>
      document.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [src]);

  return (
    <View style={styles.wrapper}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          flex: 1,
          display: src ? "flex" : "none",
        }}
      />
      {!src && <View style={styles.fallback} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    backgroundColor: "#0E0E0E",
    overflow: "hidden",
  },
  viewer: {
    width: "100%",
    height: "100%",
    display: "flex",
  },
  fallback: { flex: 1 },
});

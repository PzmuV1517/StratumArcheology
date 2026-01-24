import React from "react";

export default function VideoPanel({ src }: { src: string | null }) {
  return (
    <div style={styles.wrapper}>
      {src ? (
        <video src={src} controls style={styles.video} />
      ) : (
        <div style={styles.fallback} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    flex: 1,
    borderRadius: 12,
    border: "1px solid #2A2A2A",
    backgroundColor: "#0E0E0E",
    overflow: "hidden",
    display: "flex",
  },
  video: { width: "100%", height: "100%", objectFit: "contain" },
  fallback: { flex: 1 },
};

import React from "react";

export default function PdfPanel({ src }: { src: string | null }) {
  return (
    <div style={styles.wrapper}>
      {src ? (
        <iframe src={src} title="PDF Preview" style={styles.iframe} />
      ) : (
        <span style={styles.info}>No PDF to display</span>
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
  iframe: { width: "100%", height: "100%", border: "none" },
  info: { color: "#9A9A9A", padding: 12, textAlign: "center" },
};

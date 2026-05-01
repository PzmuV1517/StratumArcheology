/**
 * @file
 * PDF viewer panel for web.
 *
 * Renders PDF documents using an embedded viewer.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
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

/**
 * @file
 * Video player panel for web.
 *
 * Plays video files using the HTML5 video element.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
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

/**
 * @file
 * WheelerPublicationView – Web component.
 *
 * Fetches the server-generated publication-quality (1964-style B&W) Wheeler
 * SVG from a presigned MinIO URL and renders it inline for in-app viewing.
 * A "Download SVG" button allows exporting the artefact.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React, { useEffect, useRef, useState } from "react";

/* ───────────────────────── Props ───────────────────────── */

interface Props {
  /** Presigned MinIO URL for the SVG, or null if no render exists yet. */
  renderUrl: string | null;
  /** Version number of the currently stored render. */
  renderVersion: number | null;
  /** Current data version (used to detect stale render). */
  currentVersion: number;
  /** Whether the user has unsaved local edits. */
  dirty: boolean;
}

/* ───────────────────────── Component ───────────────────────── */

export function WheelerPublicationView({
  renderUrl,
  renderVersion,
  currentVersion,
  dirty,
}: Props) {
  const [svgText, setSvgText] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastUrlRef = useRef<string | null>(null);

  // Fetch the SVG whenever renderUrl changes
  useEffect(() => {
    if (!renderUrl) {
      setSvgText(null);
      setFetchError(null);
      return;
    }
    if (renderUrl === lastUrlRef.current) return;
    lastUrlRef.current = renderUrl;

    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    fetch(renderUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (!cancelled) {
          setSvgText(text);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchError((err as Error)?.message ?? "Failed to load SVG");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [renderUrl]);

  // Whether the displayed render is out-of-date
  const isStale =
    dirty || (renderVersion !== null && renderVersion !== currentVersion);

  /* ── Download handler ── */
  const handleDownload = () => {
    if (!svgText) return;
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wheeler-diagram.svg";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  /* ─────────────── Layout ─────────────── */
  const containerStyle: React.CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    background: "#fafaf8",
  };

  const bannerStyle: React.CSSProperties = {
    background: "#b45309",
    color: "#fff",
    padding: "8px 16px",
    fontSize: 13,
    fontFamily: "Inter, system-ui, sans-serif",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  const toolbarStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    padding: "10px 16px",
    borderBottom: "1px solid #e4e4e0",
    background: "#f5f4f0",
  };

  const btnStyle: React.CSSProperties = {
    padding: "6px 14px",
    borderRadius: 6,
    border: "1px solid #d5d3cc",
    background: "#ffffff",
    color: "#292521",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "Inter, system-ui, sans-serif",
  };

  const scrollAreaStyle: React.CSSProperties = {
    flex: 1,
    overflow: "auto",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: 32,
  };

  const svgWrapStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #d5d3cc",
    borderRadius: 4,
    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
    maxWidth: "100%",
    overflow: "auto",
  };

  /* ── No render yet ── */
  if (!renderUrl) {
    return (
      <div
        style={{
          ...containerStyle,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <p
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            color: "#6b7280",
            fontSize: 14,
            textAlign: "center",
            maxWidth: 360,
          }}
        >
          No publication SVG yet.
          <br />
          Save the diagram to generate one.
        </p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Stale warning */}
      {isStale && (
        <div style={bannerStyle}>
          <span>⚠</span>
          <span>
            This diagram has unsaved changes — the displayed render may be outdated.
            Save to refresh.
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div style={toolbarStyle}>
        <span
          style={{
            fontSize: 12,
            color: "#9ca3af",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Publication-quality · Wheeler 1964 style · Rendered v{renderVersion ?? "?"}
        </span>
        <button
          style={btnStyle}
          disabled={!svgText}
          onClick={handleDownload}
          title="Download SVG for print / publication"
        >
          ⬇ Download SVG
        </button>
      </div>

      {/* SVG viewer */}
      <div style={scrollAreaStyle}>
        {loading && (
          <p
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              color: "#9ca3af",
              fontSize: 14,
            }}
          >
            Loading diagram…
          </p>
        )}

        {fetchError && (
          <p
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              color: "#ef4444",
              fontSize: 14,
            }}
          >
            Failed to load SVG: {fetchError}
          </p>
        )}

        {svgText && !loading && (
          <>
            <div
              style={svgWrapStyle}
              dangerouslySetInnerHTML={{ __html: svgText }}
            />
            <p
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                color: "#9ca3af",
                fontSize: 11,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              SVG is vector-scalable and suitable for print and publication.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default WheelerPublicationView;

/**
 * @file
 * Audio player panel for web.
 *
 * Plays audio files using the HTML5 audio element.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "@/hooks/use-color-scheme";

export interface AudioPanelProps {
  audioUrl: string;
}

export default function AudioPanel({ audioUrl }: AudioPanelProps) {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioUrl || !audioRef.current || !canvasRef.current) return;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let raf = 0;
    const el = audioRef.current;

    try {
      ctx = new AudioContext();
      const source = ctx.createMediaElementSource(el);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      // Browser autoplay policy suspends AudioContext until a user gesture.
      // createMediaElementSource routes all audio through the context, so
      // without resuming it on play, the audio element produces no sound.
      const resume = () => ctx?.resume();
      el.addEventListener("play", resume);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const canvas = canvasRef.current;
      const g = canvas.getContext("2d")!;
      const draw = () => {
        raf = requestAnimationFrame(draw);
        analyser!.getByteFrequencyData(buffer);
        g.clearRect(0, 0, canvas.width, canvas.height);
        const w = canvas.width / buffer.length;
        for (let i = 0; i < buffer.length; i++) {
          const v = buffer[i] / 255;
          const h = v * canvas.height;
          g.fillStyle = "#FF2A2A";
          g.fillRect(i * w, canvas.height - h, w - 1, h);
        }
      };
      draw();

      return () => {
        el.removeEventListener("play", resume);
        if (raf) cancelAnimationFrame(raf);
        try { ctx?.close(); } catch {}
      };
    } catch (_e: any) {
      setError("Audio visualizer error");
    }
  }, [audioUrl]);

  return (
    <div style={styles.wrapper}>
      {audioUrl ? (
        <>
          <audio ref={audioRef} src={audioUrl} controls style={styles.audio} />
          <canvas ref={canvasRef} width={800} height={120} style={styles.canvas} />
          {error && <span style={styles.err}>{error}</span>}
        </>
      ) : (
        <span style={styles.info}>No audio</span>
      )}
    </div>
  );
}

const createStyles = (isDarkMode: boolean): Record<string, React.CSSProperties> => ({
  wrapper: {
    flex: 1,
    borderRadius: 12,
    border: `1px solid ${isDarkMode ? "#2A2A2A" : "#D9D9D9"}`,
    backgroundColor: isDarkMode ? "#0E0E0E" : "#FFFFFF",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  audio: { width: "100%" },
  canvas: {
    width: "100%",
    height: 120,
    backgroundColor: isDarkMode ? "#111111" : "#F1F1F1",
    borderRadius: 8,
  },
  info: { color: isDarkMode ? "#9A9A9A" : "#666666" },
  err: { color: "#FF4444", fontSize: 12 },
});

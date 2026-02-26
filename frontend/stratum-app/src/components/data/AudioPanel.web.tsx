/**
 * @file
 * Audio player panel for web.
 *
 * Plays audio files using the HTML5 audio element.
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

export interface AudioPanelProps {
  audioUrl: string;
}

export default function AudioPanel({ audioUrl }: AudioPanelProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioUrl || !audioRef.current || !canvasRef.current) return;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let raf = 0;
    try {
      ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audioRef.current);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(ctx.destination);
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
    } catch (_e: any) {
      setError("Audio visualizer error");
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      try {
        ctx?.close();
      } catch {}
    };
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

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    flex: 1,
    borderRadius: 12,
    border: "1px solid #2A2A2A",
    backgroundColor: "#0E0E0E",
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
    backgroundColor: "#111111",
    borderRadius: 8,
  },
  info: { color: "#9A9A9A" },
  err: { color: "#FF4444", fontSize: 12 },
};

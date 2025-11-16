import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AudioPanel({ src, name }: { src: string | null; name?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!src || !audioRef.current || !canvasRef.current) return;
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
      const g = canvas.getContext('2d')!;
      const draw = () => {
        raf = requestAnimationFrame(draw);
        analyser!.getByteFrequencyData(buffer);
        g.clearRect(0, 0, canvas.width, canvas.height);
        const w = canvas.width / buffer.length;
        for (let i = 0; i < buffer.length; i++) {
          const v = buffer[i] / 255;
            const h = v * canvas.height;
          g.fillStyle = '#FF2A2A';
          g.fillRect(i * w, canvas.height - h, w - 1, h);
        }
      };
      draw();
    } catch (e: any) {
      setError('Audio visualizer error');
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      try { ctx?.close(); } catch {}
    };
  }, [src]);

  return (
    <View style={styles.wrapper}>
      {src ? (
        <>
          <audio ref={audioRef} src={src} controls style={styles.audio} />
          <canvas ref={canvasRef} width={800} height={120} style={styles.canvas} />
          {!!name && <Text style={styles.name}>{name}</Text>}
          {error && <Text style={styles.err}>{error}</Text>}
        </>
      ) : (
        <Text style={styles.info}>No audio</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: '#0E0E0E', padding: 16, alignItems: 'center', justifyContent: 'center', gap: 12 },
  audio: { width: '100%' },
  canvas: { width: '100%', height: 120, backgroundColor: '#111111', borderRadius: 8 },
  info: { color: '#9A9A9A' },
  name: { color: '#F5F5F5', fontSize: 12 },
  err: { color: '#FF4444', fontSize: 12 },
});
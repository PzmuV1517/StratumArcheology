import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function AudioPanel({ src, name }: { src: string | null; name?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  // Init visualizer when src changes
  useEffect(() => {
    cleanup();
    if (!src) return;
    if (!audioRef.current || !canvasRef.current) return;
    try {
      // Ensure CORS compatibility for presigned MinIO URLs
      audioRef.current.crossOrigin = 'anonymous';
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      const bufferTD = new Uint8Array(analyser.fftSize);
      const canvas = canvasRef.current;
      const g = canvas.getContext('2d')!;
      const draw = () => {
        rafRef.current = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(bufferTD);
        g.clearRect(0, 0, canvas.width, canvas.height);
        g.strokeStyle = '#FF2A2A';
        g.lineWidth = 2;
        g.beginPath();
        const slice = canvas.width / bufferTD.length;
        for (let i = 0; i < bufferTD.length; i++) {
          const v = bufferTD[i] / 128 - 1;
          const y = (v * canvas.height) / 2 + canvas.height / 2;
          if (i === 0) g.moveTo(0, y); else g.lineTo(i * slice, y);
        }
        g.stroke();
      };
      draw();
    } catch (e: any) {
      console.error('Visualizer init failed', e);
      setError('Audio visualizer error');
    }
    return cleanup;
  }, [src]);

  // Ensure slider starts at 0 and context resumes on user interaction
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onLoaded = () => {
      try { el.currentTime = 0; } catch {}
    };
    const onUserInteract = () => {
      const ctx = ctxRef.current;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    };
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('play', onUserInteract);
    el.addEventListener('click', onUserInteract);
    return () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('play', onUserInteract);
      el.removeEventListener('click', onUserInteract);
    };
  }, [src]);

  const cleanup = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try { ctxRef.current?.close(); } catch {}
    ctxRef.current = null;
    analyserRef.current = null;
  };

  // Provide an overlay prompting user interaction if context is suspended
  const needsResume = ctxRef.current && ctxRef.current.state === 'suspended';

  return (
    <View style={styles.wrapper}>
      {src ? (
        <>
          <View style={{ width: '100%', position: 'relative' }}>
            <audio
              ref={audioRef}
              src={src}
              controls
              style={styles.audio}
              preload="metadata"
            />
            {needsResume && (
              <TouchableOpacity
                style={styles.overlay}
                onPress={() => {
                  const ctx = ctxRef.current;
                  if (ctx && ctx.state === 'suspended') ctx.resume().catch(()=>{});
                  try { audioRef.current?.play(); } catch {}
                }}
              >
                <Text style={styles.overlayText}>Tap to enable audio</Text>
              </TouchableOpacity>
            )}
          </View>
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
  overlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  overlayText: { color: '#F5F5F5', fontWeight: '600', fontSize: 14 },
});
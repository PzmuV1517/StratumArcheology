import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { config } from '../../config/config';
import { parseLAS } from './las';

type Props = { src: string | null; name?: string };

export default function PointCloudPanel({ src, name }: Props) {
  const hostRef = React.useRef<any>(null);
  const rendererRef = React.useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = React.useRef<THREE.Scene | null>(null);
  const cameraRef = React.useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = React.useRef<OrbitControls | null>(null);
  const pointsRef = React.useRef<THREE.Points | null>(null);
  const axesRef = React.useRef<THREE.AxesHelper | null>(null);
  const gridRef = React.useRef<THREE.GridHelper | null>(null);
  const geomMetaRef = React.useRef<{ zMin?: number; zMax?: number; hasRGB?: boolean; hasIntensity?: boolean } | null>(null);
  const radiusRef = React.useRef<number>(1);

  const [error, setError] = React.useState<string | null>(null);
  const [showAxes, setShowAxes] = React.useState(true);
  const [showGrid, setShowGrid] = React.useState(true);
  const [bg, setBg] = React.useState('#0E0E0E');
  // Point size controls: 'pixel' uses constant on-screen size, 'world' scales with scene units
  const [sizeMode, setSizeMode] = React.useState<'pixel' | 'world'>('pixel');
  const [sizePx, setSizePx] = React.useState<number>(1); // pixels (default)
  const [sizeWorld, setSizeWorld] = React.useState<number>(0.01); // fraction of radius
  const [colorMode, setColorMode] = React.useState<'auto' | 'rgb' | 'intensity' | 'elevation'>('auto');
  const [colormap, setColormap] = React.useState<'turbo' | 'viridis' | 'gray'>('turbo');

  const ext = React.useMemo(() => {
    if (!src && !name) return null;
    const target = (name || src || '').split('?')[0];
    const idx = target.lastIndexOf('.');
    return idx >= 0 ? target.substring(idx + 1).toLowerCase() : null;
  }, [src, name]);

  React.useEffect(() => {
    const host = hostRef.current as HTMLElement | null;
    if (!host) return;

    // init three
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
    const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 5000);
    camera.position.set(0.5, 0.5, 1.5);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  controls.enableZoom = true;
  controls.zoomSpeed = 1.0;
    controls.target.set(0, 0, 0);

  const light = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(light);

  // Helpers
  const axes = new THREE.AxesHelper(1);
  axes.visible = showAxes;
  scene.add(axes);
  axesRef.current = axes;

  const grid = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
  grid.visible = showGrid;
  scene.add(grid);
  gridRef.current = grid;

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;

    let mounted = true;
    const onResize = () => {
      if (!mounted) return;
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const raf = () => {
      if (!mounted) return;
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(raf);
    };
    window.addEventListener('resize', onResize);

    // Ensure wheel always zooms within the viewer area (even when page is scrollable or overlay is on top)
    try { (host.style as any).overscrollBehavior = 'contain'; } catch {}
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName || '';
      // Don't hijack wheel on interactive controls
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      e.stopPropagation();
      const canvas = renderer.domElement;
      const ev = new WheelEvent('wheel', {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaMode: e.deltaMode,
        clientX: e.clientX,
        clientY: e.clientY,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(ev);
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    onResize();
    requestAnimationFrame(raf);

    return () => {
      mounted = false;
      window.removeEventListener('resize', onResize);
      host.removeEventListener('wheel', onWheel as any);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  // React to scene-level settings
  React.useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.background = new THREE.Color(bg);
  }, [bg]);

  React.useEffect(() => {
    if (axesRef.current) axesRef.current.visible = showAxes;
  }, [showAxes]);

  React.useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid;
  }, [showGrid]);

  React.useEffect(() => {
    updatePointSize();
  }, [sizeMode, sizePx, sizeWorld]);

  React.useEffect(() => {
    setError(null);
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !camera || !controls) return;

    // clear previous
    if (pointsRef.current) {
      scene.remove(pointsRef.current);
      (pointsRef.current.geometry as any)?.dispose?.();
      (pointsRef.current.material as any)?.dispose?.();
      pointsRef.current = null;
    }

    if (!src || !ext) return;

    const loadPLY = async () => {
      const loader = new PLYLoader();
      loader.load(
        src,
        (geometry) => {
          geometry.computeBoundingSphere();
          // record metadata
          const zStats = getZStats(geometry);
          geomMetaRef.current = {
            zMin: zStats.min,
            zMax: zStats.max,
            hasRGB: !!geometry.getAttribute('color'),
            hasIntensity: !!geometry.getAttribute('intensity'),
          };
          // initial coloring
          applyColorMode(geometry, colorMode, colormap);
          const material = new THREE.PointsMaterial({ size: 1, vertexColors: !!geometry.getAttribute('color') });
          const pts = new THREE.Points(geometry, material);
          scene.add(pts);
          pointsRef.current = pts;
          const fit = fitViewToGeometry(camera, controls, geometry);
          radiusRef.current = fit.radius;
          updatePointSize();
          tuneHelpersToFit(fit.radius);
        },
        undefined,
  (err: any) => setError('Failed to load PLY: ' + (err?.message || String(err)))
      );
    };

    const loadPCD = async () => {
      const loader = new PCDLoader();
      loader.load(
        src,
        (points) => {
          // points is THREE.Points already, ensure colors/intensity
          const geom = points.geometry as THREE.BufferGeometry;
          const zStats = getZStats(geom);
          geomMetaRef.current = {
            zMin: zStats.min,
            zMax: zStats.max,
            hasRGB: !!geom.getAttribute('color'),
            hasIntensity: !!geom.getAttribute('intensity'),
          };
          applyColorMode(geom, colorMode, colormap);
          // ensure material uses vertex colors
          const mat = new THREE.PointsMaterial({ size: 1, vertexColors: !!geom.getAttribute('color') });
          const pts = new THREE.Points(geom, mat);
          scene.add(pts);
          pointsRef.current = pts;
          const fit = fitViewToGeometry(camera, controls, geom);
          radiusRef.current = fit.radius;
          updatePointSize();
          tuneHelpersToFit(fit.radius);
        },
        undefined,
  (err: any) => setError('Failed to load PCD: ' + (err?.message || String(err)))
      );
    };

    if (ext === 'ply') loadPLY();
    else if (ext === 'pcd') loadPCD();
    else {
      // For anything else, use server conversion endpoint → returns PLY URL
      (async () => {
        try {
          let convertedUrl: string | undefined;
          const isBlobLike = src.startsWith('blob:') || src.startsWith('data:');
          if (isBlobLike) {
            // Upload file bytes via multipart/form-data
            const blob = await fetch(src).then(r => r.blob());
            const form = new FormData();
            form.append('file', blob, name || `upload.${ext}`);
            if (name) form.append('name', name);
            const resp = await fetch(`${config.apiBaseUrl}/convert/pointcloud`, {
              method: 'POST',
              body: form,
            });
            if (!resp.ok) {
              let msg = `Convert HTTP ${resp.status}`;
              try {
                const j = await resp.json();
                if (j?.detail) msg += `: ${j.detail}`;
                else if (j?.message) msg += `: ${j.message}`;
              } catch {
                try { msg += `: ${await resp.text()}`; } catch {}
              }
              throw new Error(msg);
            }
            const data = await resp.json();
            convertedUrl = data?.url;
          } else {
            const qs = new URLSearchParams();
            if (src) qs.set('src', src);
            if (name) qs.set('name', name);
            const resp = await fetch(`${config.apiBaseUrl}/convert/pointcloud?${qs.toString()}`);
            if (!resp.ok) {
              let msg = `Convert HTTP ${resp.status}`;
              try {
                const j = await resp.json();
                if (j?.detail) msg += `: ${j.detail}`;
                else if (j?.message) msg += `: ${j.message}`;
              } catch {
                try { msg += `: ${await resp.text()}`; } catch {}
              }
              throw new Error(msg);
            }
            const data = await resp.json();
            convertedUrl = data?.url;
          }

          if (!convertedUrl) throw new Error('No URL returned from converter');
          const loader = new PLYLoader();
          loader.load(
            convertedUrl,
            (geometry) => {
              geometry.computeBoundingSphere();
              const zStats = getZStats(geometry);
              geomMetaRef.current = {
                zMin: zStats.min,
                zMax: zStats.max,
                hasRGB: !!geometry.getAttribute('color'),
                hasIntensity: !!geometry.getAttribute('intensity'),
              };
              applyColorMode(geometry, colorMode, colormap);
              const material = new THREE.PointsMaterial({ size: 1, vertexColors: !!geometry.getAttribute('color') });
              const pts = new THREE.Points(geometry, material);
              scene.add(pts);
              pointsRef.current = pts;
              const fit = fitViewToGeometry(camera, controls, geometry);
              radiusRef.current = fit.radius;
              updatePointSize();
              tuneHelpersToFit(fit.radius);
            },
            undefined,
            (err: any) => setError('Failed to load converted PLY: ' + (err?.message || String(err)))
          );
        } catch (e: any) {
          // Fallback: if this was a local LAS (blob/data) and conversion failed, try in-browser LAS parse (uncompressed only)
          try {
            const isBlobLike = src.startsWith('blob:') || src.startsWith('data:');
            if (ext === 'las' && isBlobLike) {
              const blob = await fetch(src).then(r => r.blob());
              const ab = await blob.arrayBuffer();
              const res = parseLAS(ab, { maxPoints: 2_000_000 });
              const geometry = new THREE.BufferGeometry();
              geometry.setAttribute('position', new THREE.BufferAttribute(res.positions, 3));
              if (res.colors) {
                geometry.setAttribute('color', new THREE.BufferAttribute(res.colors, 3));
              }
              const material = new THREE.PointsMaterial({ size: 1, vertexColors: !!res.colors });
              const pts = new THREE.Points(geometry, material);
              scene.add(pts);
              pointsRef.current = pts;
              const fit = fitViewToGeometry(camera, controls, geometry);
              radiusRef.current = fit.radius;
              updatePointSize();
              tuneHelpersToFit(fit.radius);
              setError(null);
              return;
            }
          } catch (e2: any) {
            // fall through to display the original conversion error below
          }
          setError('Conversion error: ' + (e?.message || String(e)));
        }
      })();
    }
  }, [src, ext]);

  const tuneHelpersToFit = React.useCallback((radius: number) => {
    const axes = axesRef.current;
    const grid = gridRef.current;
    const scene = sceneRef.current;
    const scale = Math.max(1, radius);
    if (axes) axes.scale.setScalar(scale * 0.5);
    if (grid && scene) {
      scene.remove(grid);
      const divisions = 10;
      const size = Math.max(1, radius * 2);
      const newGrid = new THREE.GridHelper(size, divisions, 0x444444, 0x222222);
      newGrid.visible = showGrid;
      scene.add(newGrid);
      gridRef.current = newGrid;
    }
  }, [showGrid]);

  // Re-apply color mode when controls change
  React.useEffect(() => {
    const pts = pointsRef.current;
    if (!pts) return;
    const geom = pts.geometry as THREE.BufferGeometry;
    applyColorMode(geom, colorMode, colormap);
    const mat = pts.material as THREE.PointsMaterial;
    mat.vertexColors = !!geom.getAttribute('color');
    mat.needsUpdate = true;
  }, [colorMode, colormap]);

  function updatePointSize() {
    const pts = pointsRef.current;
    if (!pts) return;
    const mat = pts.material as THREE.PointsMaterial;
    if (sizeMode === 'pixel') {
      mat.sizeAttenuation = false;
      const dpr = (window.devicePixelRatio || 1);
      mat.size = sizePx * dpr;
    } else {
      mat.sizeAttenuation = true;
      const radius = radiusRef.current || 1;
      mat.size = Math.max(1e-6, sizeWorld * radius);
    }
    mat.needsUpdate = true;
  }

  return (
    <View style={styles.wrapper}>
      <View ref={hostRef} style={styles.fill} />
      {/* Web-only controls overlay */}
      <div style={controlsStyle}>
        <div style={rowStyle}>
          <label style={labelStyle}>Size mode</label>
          <select value={sizeMode} onChange={(e) => setSizeMode(e.currentTarget.value as any)} style={selectStyle}>
            <option value="pixel">Pixel</option>
            <option value="world">World</option>
          </select>
          {sizeMode === 'pixel' ? (
            <>
              <label style={{ ...labelStyle, minWidth: 72 }}>Size (px)</label>
              <input
                type="range"
                min={1}
                max={12}
                step={0.5}
                value={sizePx}
                onChange={(e) => setSizePx(parseFloat(e.currentTarget.value))}
                style={{ flex: 1 }}
              />
              <span style={valueStyle}>{sizePx.toFixed(1)}px</span>
            </>
          ) : (
            <>
              <label style={{ ...labelStyle, minWidth: 72 }}>Size (∝ radius)</label>
              <input
                type="range"
                min={0.001}
                max={0.05}
                step={0.001}
                value={sizeWorld}
                onChange={(e) => setSizeWorld(parseFloat(e.currentTarget.value))}
                style={{ flex: 1 }}
              />
              <span style={valueStyle}>{sizeWorld.toFixed(3)}</span>
            </>
          )}
        </div>
        <div style={rowStyle}>
          <label style={labelStyle}>Color</label>
          <select value={colorMode} onChange={(e) => setColorMode(e.currentTarget.value as any)} style={selectStyle}>
            <option value="auto">Auto</option>
            <option value="rgb">RGB</option>
            <option value="intensity">Intensity</option>
            <option value="elevation">Elevation</option>
          </select>
          {colorMode !== 'rgb' && (
            <select value={colormap} onChange={(e) => setColormap(e.currentTarget.value as any)} style={selectStyle}>
              <option value="turbo">Turbo</option>
              <option value="viridis">Viridis</option>
              <option value="gray">Grayscale</option>
            </select>
          )}
        </div>
        <div style={rowStyle}>
          <label style={labelStyle}>Axes</label>
          <input type="checkbox" checked={showAxes} onChange={(e) => setShowAxes(e.currentTarget.checked)} />
          <label style={{ ...labelStyle, marginLeft: 12 }}>Grid</label>
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.currentTarget.checked)} />
          <label style={{ ...labelStyle, marginLeft: 12 }}>Background</label>
          <select value={bg} onChange={(e) => setBg(e.currentTarget.value)} style={selectStyle}>
            <option value="#0E0E0E">Dark</option>
            <option value="#FFFFFF">White</option>
            <option value="#1E1E1E">Charcoal</option>
            <option value="#101820">Navy</option>
          </select>
        </div>
      </div>
      {!src && (
        <View style={styles.center}> 
          <Text style={styles.info}>No file selected</Text>
        </View>
      )}
      {!!src && error && (
        <View style={[styles.center, styles.overlay]}> 
          <Text style={styles.title}>Point Cloud Preview</Text>
          <Text style={styles.info}>{error}</Text>
          {!!name && <Text style={[styles.info, { opacity: 0.8 }]}>File: {name}</Text>}
        </View>
      )}
    </View>
  );
}

function getZStats(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  let min = Infinity;
  let max = -Infinity;
  if (pos) {
    for (let i = 2; i < pos.count * 3; i += 3) {
      const z = pos.array[i] as number;
      if (z < min) min = z;
      if (z > max) max = z;
    }
  }
  if (!isFinite(min) || !isFinite(max)) {
    min = 0; max = 1;
  }
  return { min, max };
}

function applyColorMode(geometry: THREE.BufferGeometry, mode: 'auto' | 'rgb' | 'intensity' | 'elevation', map: 'turbo' | 'viridis' | 'gray') {
  const hasRGB = !!geometry.getAttribute('color');
  const intensity = geometry.getAttribute('intensity') as THREE.BufferAttribute | undefined;

  let resolved: 'rgb' | 'intensity' | 'elevation' = mode as any;
  if (mode === 'auto') {
    resolved = hasRGB ? 'rgb' : intensity ? 'intensity' : 'elevation';
  }

  if (resolved === 'rgb') {
    // keep existing colors if present; otherwise fall back to elevation
    if (!hasRGB) resolved = intensity ? 'intensity' : 'elevation';
  }

  if (resolved === 'intensity' && intensity) {
    const count = intensity.count;
    const colors = new Float32Array(count * 3);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < count; i++) {
      const v = intensity.getX(i);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const span = max - min || 1;
    for (let i = 0; i < count; i++) {
      const t = (intensity.getX(i) - min) / span;
      const c = colormapFn(map, t);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return;
  }

  if (resolved === 'elevation') {
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (pos) {
      const count = pos.count;
      const colors = new Float32Array(count * 3);
      let min = Infinity, max = -Infinity;
      for (let i = 2; i < count * 3; i += 3) {
        const z = pos.array[i] as number;
        if (z < min) min = z;
        if (z > max) max = z;
      }
      const span = max - min || 1;
      for (let i = 0; i < count; i++) {
        const z = pos.getZ(i);
        const t = (z - min) / span;
        const c = colormapFn(map, t);
        colors[i * 3 + 0] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return;
    }
  }
  // default: leave colors as-is
}

function colormapFn(map: 'turbo' | 'viridis' | 'gray', t: number) {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  t = clamp(t);
  if (map === 'gray') {
    return { r: t, g: t, b: t };
  }
  if (map === 'viridis') {
    // simple viridis approx
    const r = clamp(0.267 + 2.151*t - 1.820*t*t);
    const g = clamp(0.005 + 1.120*t + 1.614*t*t - 1.870*t*t*t);
    const b = clamp(0.329 + 2.190*(1-t) - 4.292*(1-t)*(1-t) + 2.146*(1-t)*(1-t)*(1-t));
    return { r, g, b };
  }
  // turbo-like
  if (t < 0.25) {
    const k = t / 0.25;
    return { r: 0, g: k, b: 1 };
  } else if (t < 0.5) {
    const k = (t - 0.25) / 0.25;
    return { r: 0, g: 1, b: 1 - k };
  } else if (t < 0.75) {
    const k = (t - 0.5) / 0.25;
    return { r: k, g: 1, b: 0 };
  } else {
    const k = (t - 0.75) / 0.25;
    return { r: 1, g: 1 - k, b: 0 };
  }
}

function fitViewToGeometry(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  geometry: THREE.BufferGeometry
) {
  geometry.computeBoundingSphere();
  const bs = geometry.boundingSphere!;
  controls.target.copy(bs.center);
  const radius = bs.radius || 1;
  const dist = radius * 2.5;
  camera.position.set(bs.center.x + dist, bs.center.y + dist, bs.center.z + dist);
  camera.near = Math.max(0.001, radius / 1000);
  camera.far = Math.max(1000, radius * 10);
  camera.updateProjectionMatrix();
  return { center: bs.center, radius };
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: '#0E0E0E', overflow: 'hidden', position: 'relative' },
  fill: { position: 'absolute', inset: 0 } as any,
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  overlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' } as any,
  title: { color: '#F5F5F5', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  info: { color: '#9A9A9A', fontSize: 13, textAlign: 'center', marginTop: 4 },
});

// Inline CSS for the web controls overlay
const controlsStyle: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  left: 8,
  right: 8,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  padding: '8px 10px',
  background: 'rgba(0,0,0,0.35)',
  borderRadius: 8,
  alignItems: 'center',
};
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const labelStyle: React.CSSProperties = { color: '#ddd', fontSize: 12, minWidth: 72 };
const selectStyle: React.CSSProperties = { background: '#111', color: '#eee', border: '1px solid #444', borderRadius: 6, padding: '4px 6px' };
const valueStyle: React.CSSProperties = { color: '#aaa', width: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
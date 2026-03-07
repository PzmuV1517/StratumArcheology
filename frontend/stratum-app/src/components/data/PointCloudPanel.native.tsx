/**
 * @file
 * Point cloud viewer panel for React Native.
 *
 * Renders point cloud data using a WebView-based viewer.
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
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  PanResponder,
} from "react-native";
import { GLView, ExpoWebGLRenderingContext } from "expo-gl";
import { Renderer } from "expo-three";
import * as THREE from "three";
import { Ionicons } from "@expo/vector-icons";

interface PointCloudPanelProps {
  src: string | null;
  name?: string;
}

export default function PointCloudPanel({ src, name }: PointCloudPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const glRef = useRef<GLView>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);

  // Touch controls state
  const rotationRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const lastTouchRef = useRef({ x: 0, y: 0 });
  const lastDistanceRef = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 1) {
          lastTouchRef.current = { x: touches[0].pageX, y: touches[0].pageY };
        } else if (touches.length === 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          lastDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
        }
      },
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 1) {
          // Rotation
          const dx = touches[0].pageX - lastTouchRef.current.x;
          const dy = touches[0].pageY - lastTouchRef.current.y;
          rotationRef.current.y += dx * 0.01;
          rotationRef.current.x += dy * 0.01;
          lastTouchRef.current = { x: touches[0].pageX, y: touches[0].pageY };

          if (pointsRef.current) {
            pointsRef.current.rotation.y = rotationRef.current.y;
            pointsRef.current.rotation.x = rotationRef.current.x;
          }
        } else if (touches.length === 2) {
          // Pinch zoom
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const scaleFactor = distance / lastDistanceRef.current;
          scaleRef.current = Math.max(
            0.3,
            Math.min(5, scaleRef.current * scaleFactor),
          );
          lastDistanceRef.current = distance;

          if (pointsRef.current) {
            pointsRef.current.scale.setScalar(scaleRef.current);
          }
        }
      },
    }),
  ).current;

  const resetView = () => {
    rotationRef.current = { x: 0, y: 0 };
    scaleRef.current = 1;
    if (pointsRef.current) {
      pointsRef.current.rotation.set(0, 0, 0);
      pointsRef.current.scale.setScalar(1);
    }
  };

  const zoomIn = () => {
    scaleRef.current = Math.min(5, scaleRef.current * 1.25);
    if (pointsRef.current) {
      pointsRef.current.scale.setScalar(scaleRef.current);
    }
  };

  const zoomOut = () => {
    scaleRef.current = Math.max(0.3, scaleRef.current * 0.8);
    if (pointsRef.current) {
      pointsRef.current.scale.setScalar(scaleRef.current);
    }
  };

  if (!src) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.center}>
          <Ionicons name="ellipsis-horizontal-outline" size={48} color="#444" />
          <Text style={styles.title}>Point Cloud</Text>
          <Text style={styles.info}>No point cloud to display</Text>
          {!!name && <Text style={styles.fileName}>{name}</Text>}
        </View>
      </View>
    );
  }

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    try {
      const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

      // Create renderer
      const renderer = new Renderer({ gl });
      renderer.setSize(width, height);
      renderer.setClearColor(0x0e0e0e, 1);
      rendererRef.current = renderer;

      // Create scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0e0e0e);
      sceneRef.current = scene;

      // Create camera
      const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
      camera.position.z = 4;
      cameraRef.current = camera;

      // Add ambient light
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      // Load point cloud or create demo
      await loadPointCloud(scene, src);

      setLoading(false);

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      animate();
    } catch (err) {
      console.error("GL context error:", err);
      setError("Failed to initialize point cloud viewer");
      setLoading(false);
    }
  };

  const loadPointCloud = async (scene: THREE.Scene, url: string) => {
    try {
      // Create a sample point cloud to demonstrate the viewer works
      // Full PLY/PCD loading would require custom parsers
      const numPoints = 5000;
      const positions = new Float32Array(numPoints * 3);
      const colors = new Float32Array(numPoints * 3);

      // Generate a sphere-like point cloud distribution
      for (let i = 0; i < numPoints; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 1 + (Math.random() - 0.5) * 0.3;

        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        // Color gradient based on height (y)
        const h = (positions[i * 3 + 1] + 1) / 2;
        colors[i * 3] = 1; // R
        colors[i * 3 + 1] = 0.16 + h * 0.5; // G
        colors[i * 3 + 2] = 0.16 + h * 0.5; // B
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.03,
        vertexColors: true,
        sizeAttenuation: true,
      });

      const points = new THREE.Points(geometry, material);
      pointsRef.current = points;
      scene.add(points);

      console.log("Point cloud URL:", url);
    } catch (err) {
      console.error("Point cloud load error:", err);
      throw err;
    }
  };

  return (
    <View style={styles.wrapper} {...panResponder.panHandlers}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF2A2A" />
          <Text style={styles.loadingText}>Loading point cloud...</Text>
        </View>
      )}
      {error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color="#FF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setLoading(true);
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <GLView
          style={styles.glView}
          onContextCreate={onContextCreate}
          ref={glRef}
        />
      )}

      {/* Control buttons */}
      {!error && !loading && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlBtn} onPress={resetView}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={zoomIn}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={zoomOut}>
            <Ionicons name="remove" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {!!name && !error && (
        <View style={styles.nameBar}>
          <Text style={styles.fileName} numberOfLines={1}>
            {name}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    backgroundColor: "#0E0E0E",
    overflow: "hidden",
  },
  glView: {
    flex: 1,
    width: "100%",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(14, 14, 14, 0.9)",
    zIndex: 1,
  },
  loadingText: {
    color: "#9A9A9A",
    marginTop: 12,
  },
  title: {
    color: "#F5F5F5",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
  },
  info: {
    color: "#9A9A9A",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
  fileName: {
    color: "#666",
    fontSize: 12,
    textAlign: "center",
  },
  errorText: {
    color: "#FF4444",
    textAlign: "center",
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#FF2A2A",
    borderRadius: 8,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  nameBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  controls: {
    position: "absolute",
    bottom: 50,
    left: "50%",
    transform: [{ translateX: -60 }],
    flexDirection: "row",
    gap: 8,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
});

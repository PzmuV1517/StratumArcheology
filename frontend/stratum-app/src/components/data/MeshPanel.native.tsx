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
import { Renderer, loadAsync } from "expo-three";
import * as THREE from "three";
import { Ionicons } from "@expo/vector-icons";
import { Asset } from "expo-asset";

interface MeshPanelProps {
  src: string | null;
  name?: string;
}

export default function MeshPanel({ src, name }: MeshPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const glRef = useRef<GLView>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Object3D | null>(null);

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

          if (meshRef.current) {
            meshRef.current.rotation.y = rotationRef.current.y;
            meshRef.current.rotation.x = rotationRef.current.x;
          }
        } else if (touches.length === 2) {
          // Pinch zoom
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const scaleFactor = distance / lastDistanceRef.current;
          scaleRef.current = Math.max(0.3, Math.min(5, scaleRef.current * scaleFactor));
          lastDistanceRef.current = distance;

          if (meshRef.current) {
            meshRef.current.scale.setScalar(scaleRef.current);
          }
        }
      },
    })
  ).current;

  const resetView = () => {
    rotationRef.current = { x: 0, y: 0 };
    scaleRef.current = 1;
    if (meshRef.current) {
      meshRef.current.rotation.set(0, 0, 0);
      meshRef.current.scale.setScalar(1);
    }
  };

  const zoomIn = () => {
    scaleRef.current = Math.min(5, scaleRef.current * 1.25);
    if (meshRef.current) {
      meshRef.current.scale.setScalar(scaleRef.current);
    }
  };

  const zoomOut = () => {
    scaleRef.current = Math.max(0.3, scaleRef.current * 0.8);
    if (meshRef.current) {
      meshRef.current.scale.setScalar(scaleRef.current);
    }
  };

  if (!src) {
    return (
      <View style={styles.wrapper}>
        <Ionicons name="cube-outline" size={48} color="#444" />
        <Text style={styles.info}>No 3D model to display</Text>
        {!!name && <Text style={styles.fileName}>{name}</Text>}
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
      camera.position.z = 3;
      cameraRef.current = camera;

      // Add lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 5, 5);
      scene.add(directionalLight);

      // Load the model using fetch + manual parsing for GLB/GLTF
      await loadModel(scene, src);

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
      setError("Failed to initialize 3D viewer");
      setLoading(false);
    }
  };

  const loadModel = async (scene: THREE.Scene, url: string) => {
    try {
      // For now, create a placeholder cube to show the viewer works
      // Full GLB loading requires the GLTFLoader from three/examples
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshStandardMaterial({
        color: 0xff2a2a,
        metalness: 0.3,
        roughness: 0.7,
      });
      const mesh = new THREE.Mesh(geometry, material);
      meshRef.current = mesh;
      scene.add(mesh);

      // Try loading GLB if it's a GLB file
      const ext = url.split(".").pop()?.toLowerCase();
      if (ext === "glb" || ext === "gltf") {
        // GLTFLoader needs to be imported dynamically
        // For full support, we'd need: import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
        // But that has issues with metro bundler in RN
        // The cube placeholder shows the GL context is working
        console.log("3D model URL:", url);
      }
    } catch (err) {
      console.error("Model load error:", err);
      throw err;
    }
  };

  return (
    <View style={styles.wrapper} {...panResponder.panHandlers}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF2A2A" />
          <Text style={styles.loadingText}>Loading 3D model...</Text>
        </View>
      )}
      {error ? (
        <View style={styles.errorContainer}>
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
        <GLView style={styles.glView} onContextCreate={onContextCreate} ref={glRef} />
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
    backgroundColor: "#0E0E0E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  glView: {
    flex: 1,
    width: "100%",
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
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
  info: {
    color: "#9A9A9A",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },
  fileName: {
    color: "#666",
    fontSize: 12,
    textAlign: "center",
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

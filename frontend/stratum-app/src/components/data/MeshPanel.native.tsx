/**
 * @file
 * 3D mesh viewer panel for React Native.
 *
 * Renders 3D model files using a WebView-based viewer.
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
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";

interface MeshPanelProps {
  src: string | null;
  name?: string;
}

export default function MeshPanel({ src, name }: MeshPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Fetch the GLB file and inject it into WebView after it's ready
  useEffect(() => {
    if (!src || !webViewReady) return;

    const fetchAndInject = async () => {
      try {
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // Convert to base64 in chunks to avoid call stack issues
        const chunkSize = 8192;
        let base64 = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.slice(i, i + chunkSize);
          base64 += String.fromCharCode.apply(null, Array.from(chunk));
        }
        base64 = btoa(base64);

        // Inject the model data into the WebView
        webViewRef.current?.injectJavaScript(`
          window.loadModelFromBase64("${base64}");
          true;
        `);
      } catch (err) {
        console.error("Failed to fetch GLB:", err);
        setError(err instanceof Error ? err.message : "Failed to load model");
        setLoading(false);
      }
    };

    fetchAndInject();
  }, [src, webViewReady]);

  if (!src) {
    return (
      <View style={styles.wrapper}>
        <Ionicons name="cube-outline" size={48} color="#444" />
        <Text style={styles.info}>No 3D model to display</Text>
        {!!name && <Text style={styles.fileName}>{name}</Text>}
      </View>
    );
  }

  // HTML that waits for model data to be injected
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%; 
      height: 100%; 
      background: #0E0E0E; 
      overflow: hidden;
      touch-action: none;
    }
    model-viewer {
      width: 100%;
      height: 100%;
      background-color: #0E0E0E;
      --poster-color: #0E0E0E;
    }
    .controls {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 10px;
      padding: 8px 14px;
      background: rgba(0,0,0,0.7);
      border-radius: 24px;
      backdrop-filter: blur(10px);
    }
    .control-btn {
      width: 40px;
      height: 40px;
      border-radius: 20px;
      border: none;
      background: #333;
      color: #fff;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .control-btn:active {
      background: #FF2A2A;
    }
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #9A9A9A;
      font-family: -apple-system, system-ui, sans-serif;
      font-size: 14px;
    }
    .error {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #FF4444;
      font-family: -apple-system, system-ui, sans-serif;
      font-size: 14px;
      text-align: center;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div id="loading" class="loading">Waiting for model data...</div>
  <model-viewer
    id="viewer"
    camera-controls
    touch-action="pan-y"
    interaction-prompt="none"
    auto-rotate
    auto-rotate-delay="3000"
    rotation-per-second="30deg"
    shadow-intensity="0.5"
    exposure="1.0"
    camera-orbit="45deg 55deg auto"
    min-camera-orbit="auto auto 10%"
    max-camera-orbit="auto auto 500%"
    style="opacity: 0; transition: opacity 0.3s;"
  ></model-viewer>
  <div class="controls">
    <button class="control-btn" onclick="resetCamera()" title="Reset">↺</button>
    <button class="control-btn" onclick="zoomIn()" title="Zoom In">+</button>
    <button class="control-btn" onclick="zoomOut()" title="Zoom Out">−</button>
    <button class="control-btn" onclick="toggleRotate()" id="rotateBtn" title="Auto-rotate">⟳</button>
  </div>
  <script>
    const viewer = document.getElementById('viewer');
    const loadingEl = document.getElementById('loading');
    let autoRotating = true;

    // Function called from React Native with base64 model data
    window.loadModelFromBase64 = function(base64Data) {
      try {
        loadingEl.textContent = 'Processing model...';
        
        // Decode base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create blob and object URL
        const blob = new Blob([bytes], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        
        // Set the model source
        viewer.src = url;
        loadingEl.textContent = 'Rendering model...';
      } catch (e) {
        loadingEl.innerHTML = '<div class="error">Failed to process model: ' + e.message + '</div>';
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', message: e.message }));
      }
    };

    // Tell React Native the WebView is ready
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'ready' }));
    
    function resetCamera() {
      viewer.cameraOrbit = '45deg 55deg auto';
      viewer.fieldOfView = 'auto';
    }
    
    function zoomIn() {
      const orbit = viewer.getCameraOrbit();
      orbit.radius = Math.max(orbit.radius * 0.75, viewer.getMinimumFieldOfView());
      viewer.cameraOrbit = \`\${orbit.theta}rad \${orbit.phi}rad \${orbit.radius}m\`;
    }
    
    function zoomOut() {
      const orbit = viewer.getCameraOrbit();
      orbit.radius = Math.min(orbit.radius * 1.33, 100);
      viewer.cameraOrbit = \`\${orbit.theta}rad \${orbit.phi}rad \${orbit.radius}m\`;
    }
    
    function toggleRotate() {
      autoRotating = !autoRotating;
      viewer.autoRotate = autoRotating;
      document.getElementById('rotateBtn').style.background = autoRotating ? '#FF2A2A' : '#333';
    }
    
    viewer.addEventListener('load', () => {
      loadingEl.style.display = 'none';
      viewer.style.opacity = '1';
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'loaded' }));
    });
    
    viewer.addEventListener('error', (e) => {
      const errorDetail = e.detail ? JSON.stringify(e.detail) : (e.message || 'Unknown error');
      loadingEl.innerHTML = '<div class="error">Failed to load 3D model</div>';
      console.error('Model viewer error:', e);
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', message: errorDetail }));
    });
    
    // Initialize rotate button state
    document.getElementById('rotateBtn').style.background = '#FF2A2A';
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.wrapper}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        originWhitelist={["*"]}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        mixedContentMode="always"
        allowFileAccess
        allowUniversalAccessFromFileURLs
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === "ready") {
              setWebViewReady(true);
            } else if (data.type === "loaded") {
              setLoading(false);
            } else if (data.type === "error") {
              const errorMsg =
                typeof data.message === "string"
                  ? data.message
                  : "Failed to load model";
              setError(errorMsg);
              setLoading(false);
            }
          } catch {
            // Ignore parse errors
          }
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn("WebView error:", nativeEvent);
          setError("Failed to load 3D viewer");
          setLoading(false);
        }}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF2A2A" />
          <Text style={styles.loadingText}>Loading 3D model...</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorOverlay}>
          <Ionicons name="alert-circle" size={48} color="#FF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setLoading(true);
              setWebViewReady(false);
              webViewRef.current?.reload();
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
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
  },
  webview: {
    flex: 1,
    width: "100%",
    backgroundColor: "#0E0E0E",
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
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0E0E0E",
    zIndex: 2,
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
    color: "#AAAAAA",
    fontSize: 12,
    textAlign: "center",
  },
  nameBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    paddingBottom: 70, // Above the controls
    backgroundColor: "rgba(0,0,0,0.5)",
  },
});

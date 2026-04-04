/**
 * @file
 * Simple image crop modal for cover images.
 *
 * On web, expo-image-picker ignores `allowsEditing`, so this component
 * provides a basic drag-to-pan crop UI with a fixed 3:2 aspect ratio.
 * The user drags the image behind a transparent crop window, then taps
 * "Crop" to produce a cropped result via expo-image-manipulator.
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type LayoutChangeEvent,
} from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import { useColorScheme } from "@/hooks/use-color-scheme";

const ASPECT = 16 / 5;

interface Props {
  visible: boolean;
  imageUri: string;
  mimeType?: string;
  onCrop: (croppedUri: string) => void;
  onCancel: () => void;
}

export default function ImageCropModal({
  visible,
  imageUri,
  mimeType,
  onCrop,
  onCancel,
}: Props) {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [cropping, setCropping] = useState(false);

  // How the image is scaled to fit the container (fill the crop box width)
  const [scale, setScale] = useState(1);
  const [displayW, setDisplayW] = useState(0);
  const [displayH, setDisplayH] = useState(0);

  // Crop box dimensions (fits inside container with ASPECT ratio)
  const [cropW, setCropW] = useState(0);
  const [cropH, setCropH] = useState(0);

  // Pan offset (how far the image is dragged)
  const panX = useRef(0);
  const panY = useRef(0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  // Load image dimensions
  useEffect(() => {
    if (!imageUri) return;
    Image.getSize(
      imageUri,
      (w, h) => setImageSize({ w, h }),
      () => setImageSize({ w: 1, h: 1 }),
    );
  }, [imageUri]);

  // Calculate layout whenever container or image size changes
  useEffect(() => {
    if (!containerSize.w || !containerSize.h || !imageSize.w || !imageSize.h) return;

    // Crop box fills container width, height = width / ASPECT
    const cW = containerSize.w;
    const cH = cW / ASPECT;
    setCropW(cW);
    setCropH(Math.min(cH, containerSize.h));

    // Scale image so its smallest side fills the crop box
    const scaleToFillW = cW / imageSize.w;
    const scaleToFillH = Math.min(cH, containerSize.h) / imageSize.h;
    const s = Math.max(scaleToFillW, scaleToFillH);
    setScale(s);
    setDisplayW(imageSize.w * s);
    setDisplayH(imageSize.h * s);

    // Center image initially
    panX.current = 0;
    panY.current = 0;
    setOffsetX(0);
    setOffsetY(0);
  }, [containerSize, imageSize]);

  // Clamp offsets so the image never leaves the crop box
  const clamp = useCallback(
    (x: number, y: number) => {
      const maxX = Math.max((displayW - cropW) / 2, 0);
      const maxY = Math.max((displayH - cropH) / 2, 0);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [displayW, displayH, cropW, cropH],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // store current offset
      },
      onPanResponderMove: (
        _e: GestureResponderEvent,
        gs: PanResponderGestureState,
      ) => {
        const { x, y } = clamp(panX.current + gs.dx, panY.current + gs.dy);
        setOffsetX(x);
        setOffsetY(y);
      },
      onPanResponderRelease: (
        _e: GestureResponderEvent,
        gs: PanResponderGestureState,
      ) => {
        const { x, y } = clamp(panX.current + gs.dx, panY.current + gs.dy);
        panX.current = x;
        panY.current = y;
        setOffsetX(x);
        setOffsetY(y);
      },
    }),
  ).current;

  // Recalculate panResponder when clamp changes
  useEffect(() => {
    panResponder.panHandlers = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (
        _e: GestureResponderEvent,
        gs: PanResponderGestureState,
      ) => {
        const { x, y } = clamp(panX.current + gs.dx, panY.current + gs.dy);
        setOffsetX(x);
        setOffsetY(y);
      },
      onPanResponderRelease: (
        _e: GestureResponderEvent,
        gs: PanResponderGestureState,
      ) => {
        const { x, y } = clamp(panX.current + gs.dx, panY.current + gs.dy);
        panX.current = x;
        panY.current = y;
        setOffsetX(x);
        setOffsetY(y);
      },
    }).panHandlers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamp]);

  const handleCrop = async () => {
    if (!imageSize.w || !imageSize.h || !cropW || !cropH) return;
    setCropping(true);
    try {
      // The visible crop region in display coordinates is centred in the image.
      // The image centre is at (displayW/2 + offsetX, displayH/2 + offsetY)
      // relative to the image's top-left. The crop box is centred at
      // (displayW/2, displayH/2) in image space, so the crop top-left in
      // display coords is:
      const cropLeftDisplay = (displayW - cropW) / 2 - offsetX;
      const cropTopDisplay = (displayH - cropH) / 2 - offsetY;

      // Convert from display coords back to original image coords
      const originX = Math.round(cropLeftDisplay / scale);
      const originY = Math.round(cropTopDisplay / scale);
      const width = Math.round(cropW / scale);
      const height = Math.round(cropH / scale);

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: Math.max(0, originX),
              originY: Math.max(0, originY),
              width: Math.min(width, imageSize.w - Math.max(0, originX)),
              height: Math.min(height, imageSize.h - Math.max(0, originY)),
            },
          },
        ],
        {
          compress: 0.85,
          format:
            mimeType === "image/png"
              ? ImageManipulator.SaveFormat.PNG
              : ImageManipulator.SaveFormat.JPEG,
        },
      );
      onCrop(result.uri);
    } catch (err) {
      console.error("Crop failed:", err);
      // Fall back to uncropped image
      onCrop(imageUri);
    } finally {
      setCropping(false);
    }
  };

  const onContainerLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ w: width, h: height });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <Text style={styles.title}>Crop Image</Text>
          <Text style={styles.subtitle}>Drag to reposition</Text>

          {/* Crop area */}
          <View style={styles.cropOuter} onLayout={onContainerLayout}>
            {cropW > 0 && cropH > 0 && (
              <View style={[styles.cropBox, { width: cropW, height: cropH }]}>
                <View
                  {...panResponder.panHandlers}
                  style={[
                    styles.imageWrapper,
                    {
                      width: displayW,
                      height: displayH,
                      transform: [{ translateX: offsetX }, { translateY: offsetY }],
                    },
                  ]}
                >
                  <Image
                    source={{ uri: imageUri }}
                    style={{ width: displayW, height: displayH }}
                    resizeMode="cover"
                  />
                </View>
              </View>
            )}
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cropBtn}
              onPress={handleCrop}
              disabled={cropping}
            >
              {cropping ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.cropText}>Crop</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDarkMode ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.35)",
      justifyContent: "center",
      alignItems: "center",
    },
    container: {
      width: "90%",
      maxWidth: 600,
      backgroundColor: isDarkMode ? "#1E1E1E" : "#FFFFFF",
      borderRadius: 16,
      padding: 20,
      alignItems: "center",
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    title: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 4,
    },
    subtitle: {
      color: isDarkMode ? "#999999" : "#666666",
      fontSize: 13,
      marginBottom: 16,
    },
    cropOuter: {
      width: "100%",
      aspectRatio: ASPECT,
      backgroundColor: isDarkMode ? "#000000" : "#F1F1F1",
      borderRadius: 8,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    cropBox: {
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "rgba(255,42,42,0.6)",
      borderRadius: 4,
    },
    imageWrapper: {
      position: "absolute",
    },
    buttons: {
      flexDirection: "row",
      marginTop: 16,
      gap: 12,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? "#444444" : "#CFCFCF",
      alignItems: "center",
      backgroundColor: isDarkMode ? "transparent" : "#F7F7F7",
    },
    cancelText: {
      color: isDarkMode ? "#CCCCCC" : "#1A1A1A",
      fontWeight: "600",
    },
    cropBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: "#FF2A2A",
      alignItems: "center",
    },
    cropText: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
  });

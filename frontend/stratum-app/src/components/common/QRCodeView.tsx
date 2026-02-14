import React, { useEffect, useState } from "react";
import { Platform, View, Text, Image } from "react-native";

// QR matrix generation (works on all platforms)
let createQRMatrix: ((data: string) => boolean[][]) | null = null;
try {
  const QR = require("qrcode");
  createQRMatrix = (data: string): boolean[][] => {
    const segments = QR.create(data, { errorCorrectionLevel: "M" });
    const { modules } = segments;
    const size = modules.size;
    const matrix: boolean[][] = [];
    for (let row = 0; row < size; row++) {
      const r: boolean[] = [];
      for (let col = 0; col < size; col++) {
        r.push(modules.get(row, col) === 1);
      }
      matrix.push(r);
    }
    return matrix;
  };
} catch {}

// Native SVG rendering (only loaded on native)
let Svg: any = null;
let Rect: any = null;
if (Platform.OS !== "web") {
  try {
    const svg = require("react-native-svg");
    Svg = svg.Svg || svg.default;
    Rect = svg.Rect;
  } catch {}
}

interface Props {
  value: string;
  size?: number;
  label?: string;
  onReadyDataUrl?: (url: string) => void;
}

/**
 * Native SVG-based QR code renderer for iOS / Android.
 */
function NativeQRCode({ value, size = 220 }: { value: string; size: number }) {
  const [matrix, setMatrix] = useState<boolean[][] | null>(null);

  useEffect(() => {
    if (createQRMatrix) {
      try {
        setMatrix(createQRMatrix(value));
      } catch {
        setMatrix(null);
      }
    }
  }, [value]);

  if (!Svg || !Rect || !matrix || matrix.length === 0) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: "#222",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#9A9A9A", textAlign: "center", padding: 12 }}>
          QR unavailable
        </Text>
      </View>
    );
  }

  const margin = 2;
  const moduleCount = matrix.length;
  const totalModules = moduleCount + margin * 2;
  const cellSize = size / totalModules;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#FFFFFF",
      }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* white background */}
        <Rect x={0} y={0} width={size} height={size} fill="#FFFFFF" />
        {matrix.map((row, y) =>
          row.map(
            (cell, x) =>
              cell && (
                <Rect
                  key={`${y}-${x}`}
                  x={(x + margin) * cellSize}
                  y={(y + margin) * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill="#000000"
                />
              ),
          ),
        )}
      </Svg>
    </View>
  );
}

export default function QRCodeView({
  value,
  size = 220,
  label,
  onReadyDataUrl,
}: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (Platform.OS === "web") {
        // Don't generate QR code if value is empty
        if (!value || value.trim() === "") {
          setDataUrl(null);
          return;
        }
        try {
          const QR = await import("qrcode");
          const url = await QR.toDataURL(value, {
            errorCorrectionLevel: "M",
            margin: 2,
            width: size,
            color: { dark: "#000000", light: "#FFFFFF" },
          });
          if (mounted) {
            setDataUrl(url);
            onReadyDataUrl?.(url);
          }
        } catch (e) {
          console.warn("Failed to generate QR", e);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [value, size]);

  // ---------- Native (iOS / Android) ----------
  if (Platform.OS !== "web") {
    return (
      <View style={{ alignItems: "center" }}>
        <NativeQRCode value={value} size={size} />
        {label ? (
          <Text style={{ color: "#F5F5F5", marginTop: 8, fontWeight: "700" }}>
            {label}
          </Text>
        ) : null}
      </View>
    );
  }

  // ---------- Web ----------
  return (
    <View style={{ alignItems: "center" }}>
      {dataUrl ? (
        <Image
          source={{ uri: dataUrl }}
          style={{
            width: size,
            height: size,
            borderRadius: 12,
            backgroundColor: "#FFF",
          }}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: 12,
            backgroundColor: "#FFF",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#111" }}>Generating QR…</Text>
        </View>
      )}
      {label ? (
        <Text style={{ color: "#F5F5F5", marginTop: 8, fontWeight: "700" }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

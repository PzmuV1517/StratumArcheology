/**
 * @file
 * Wheeler Stratigraphic Diagram component for React Native.
 *
 * Renders the Wheeler Space–Time diagram on iOS / Android using
 * react-native-svg with pan and pinch-to-zoom gestures via
 * react-native-gesture-handler and react-native-reanimated.
 * The mobile version is read-only (tap to inspect).
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
import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Modal,
} from "react-native";
import Svg, {
  Rect,
  Text as SvgText,
  Defs,
  Pattern,
  Line,
  G,
} from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import api from "../../services/api";

import {
  useWheelerData,
  WheelerTrench,
  WheelerContextPlacement,
  WheelerData,
} from "../../hooks/useWheelerData";

/* ───────────────────────── Constants ───────────────────────── */

const CELL_W = 120;
const CELL_H = 50;
const AXIS_LABEL_W = 60;
const AXIS_LABEL_H = 30;
const ACCENT = "#FF2A2A";

/** Color map for stratigraphic context types. */
const TYPE_COLORS: Record<string, string> = {
  layer: "#FF2A2A",
  deposit: "#ffc107",
  cut: "#dc3545",
  fill: "#28a745",
  structure: "#9c27b0",
};

/** Context type used for Wheeler grid cells on native. */
interface WheelerGridContext {
  id: string;
  type: string;
  description: string;
}

/* ───────────────────────── Props ───────────────────────── */

/** Props for the {@link WheelerDiagram} native component. */
interface WheelerDiagramProps {
  /** The project ID to load Wheeler data for. */
  projectId: string;
  /** Whether the user can edit (ignored on mobile — always read-only). */
  canEdit?: boolean;
}

/* ───────────────────────── Helpers ───────────────────────── */

/**
 * Build a grid occupancy map from placements and trenches.
 * @returns A 2D array [row][colIndex] → placement or null
 */
function buildOccupancy(
  trenches: WheelerTrench[],
  placements: WheelerContextPlacement[],
  totalRows: number,
): (WheelerContextPlacement | null)[][] {
  const grid: (WheelerContextPlacement | null)[][] = [];
  for (let r = 0; r < totalRows; r++) {
    grid.push(new Array(trenches.length).fill(null));
  }
  for (const p of placements) {
    for (let r = p.rowStart; r <= p.rowEnd && r < totalRows; r++) {
      for (let c = 0; c < trenches.length; c++) {
        if (p.trenchIds.includes(trenches[c].id)) {
          grid[r][c] = p;
        }
      }
    }
  }
  return grid;
}

/** Placeholder data used when no real data is available. */
function createPlaceholderData(): {
  trenches: WheelerTrench[];
  placements: WheelerContextPlacement[];
  contexts: Map<string, WheelerGridContext>;
} {
  const trenches: WheelerTrench[] = [
    { id: "T1", label: "T1", order: 0 },
    { id: "T2", label: "T2", order: 1 },
    { id: "T3", label: "T3", order: 2 },
    { id: "T4", label: "T4", order: 3 },
  ];
  const placements: WheelerContextPlacement[] = [
    {
      contextId: "SU-001",
      trenchIds: ["T1", "T2", "T3", "T4"],
      rowStart: 0,
      rowEnd: 0,
    },
    { contextId: "SU-002", trenchIds: ["T1", "T2", "T3"], rowStart: 1, rowEnd: 1 },
    { contextId: "SU-003", trenchIds: ["T2", "T3", "T4"], rowStart: 2, rowEnd: 2 },
    { contextId: "SU-004", trenchIds: ["T1", "T2"], rowStart: 3, rowEnd: 3 },
    { contextId: "SU-005", trenchIds: ["T3", "T4"], rowStart: 3, rowEnd: 4 },
    {
      contextId: "SU-006",
      trenchIds: ["T1", "T2", "T3", "T4"],
      rowStart: 5,
      rowEnd: 5,
    },
  ];
  const contexts = new Map<string, WheelerGridContext>([
    ["SU-001", { id: "SU-001", type: "layer", description: "Topsoil (modern)" }],
    ["SU-002", { id: "SU-002", type: "deposit", description: "Alluvial deposit" }],
    ["SU-003", { id: "SU-003", type: "fill", description: "Pit fill" }],
    ["SU-004", { id: "SU-004", type: "cut", description: "Foundation cut" }],
    ["SU-005", { id: "SU-005", type: "structure", description: "Wall foundation" }],
    ["SU-006", { id: "SU-006", type: "layer", description: "Natural subsoil" }],
  ]);
  return { trenches, placements, contexts };
}

/* ───────────────────────── Component ───────────────────────── */

/**
 * Wheeler Space–Time diagram for React Native (iOS / Android).
 *
 * Read-only with tap-to-inspect. Supports pan and pinch-to-zoom
 * gestures for exploring the diagram.
 *
 * @param props - Component props
 * @returns The Wheeler diagram React Native element
 */
export default function WheelerDiagram({
  projectId,

  canEdit: _canEdit = false,
}: WheelerDiagramProps) {
  const { data, loading, error } = useWheelerData(projectId);

  // Local context metadata for display
  const [contexts] = useState<Map<string, WheelerGridContext>>(() => new Map());

  // Inspected context modal
  const [inspected, setInspected] = useState<WheelerContextPlacement | null>(null);

  /* ── Offline sync state ── */
  const [isOnline, setIsOnline] = useState(true);
  const [hasPending, setHasPending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const storageKey = `wheelerData:${projectId}`;
  const pendingKey = `wheelerPending:${projectId}`;

  // Network listener
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => {
      setIsOnline(!!(s.isConnected && s.isInternetReachable));
    });
    return () => unsub();
  }, []);

  // Persist data to AsyncStorage whenever it changes
  useEffect(() => {
    if (!data || (data.trenches.length === 0 && data.placements.length === 0))
      return;
    (async () => {
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(data));
        await AsyncStorage.setItem(pendingKey, "true");
        setHasPending(true);
      } catch (e) {
        console.error("[Wheeler] persist error", e);
      }
    })();
  }, [data, storageKey, pendingKey]);

  // Sync to server
  const syncToServer = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        const parsed: WheelerData = JSON.parse(raw);
        try {
          await api.put(`/projects/${projectId}/wheeler`, { data: parsed });
        } catch (e: any) {
          if (e.response?.status !== 404) throw e;
        }
        await AsyncStorage.setItem(pendingKey, "false");
        setHasPending(false);
      }
    } catch (e) {
      console.error("[Wheeler] sync error", e);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, storageKey, pendingKey, projectId]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && hasPending) syncToServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, hasPending]);

  /* ── Pan / Zoom shared values ── */
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scaleVal = useSharedValue(1);
  const savedTX = useSharedValue(0);
  const savedTY = useSharedValue(0);
  const savedScale = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      savedTX.value = translateX.value;
      savedTY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTX.value + e.translationX;
      translateY.value = savedTY.value + e.translationY;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scaleVal.value;
    })
    .onUpdate((e) => {
      scaleVal.value = Math.min(Math.max(savedScale.value * e.scale, 0.3), 4);
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scaleVal.value },
    ],
  }));

  /* ── Effective data (placeholder if empty) ── */
  const isPlaceholder = data.trenches.length === 0 && data.placements.length === 0;
  const placeholder = useMemo(() => createPlaceholderData(), []);
  const effectiveTrenches = isPlaceholder ? placeholder.trenches : data.trenches;
  const effectivePlacements = isPlaceholder
    ? placeholder.placements
    : data.placements;
  const effectiveContexts = isPlaceholder ? placeholder.contexts : contexts;

  const totalRows = useMemo(() => {
    if (effectivePlacements.length === 0) return 6;
    return Math.max(...effectivePlacements.map((p) => p.rowEnd)) + 1;
  }, [effectivePlacements]);

  const sortedTrenches = useMemo(
    () => [...effectiveTrenches].sort((a, b) => a.order - b.order),
    [effectiveTrenches],
  );

  const occupancy = useMemo(
    () => buildOccupancy(sortedTrenches, effectivePlacements, totalRows),
    [sortedTrenches, effectivePlacements, totalRows],
  );

  const svgWidth = AXIS_LABEL_W + sortedTrenches.length * CELL_W + 20;
  const svgHeight = AXIS_LABEL_H + totalRows * CELL_H + 20;

  /** Get the color for a context by type. */
  const getColor = useCallback(
    (contextId: string): string => {
      const ctx = effectiveContexts.get(contextId);
      return TYPE_COLORS[ctx?.type ?? "layer"] ?? TYPE_COLORS.layer;
    },
    [effectiveContexts],
  );

  /** Handle tapping a context cell. */
  const handleCellPress = useCallback(
    (placement: WheelerContextPlacement | null) => {
      if (placement) setInspected(placement);
    },
    [],
  );

  /* ── Loading state ── */
  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator color={ACCENT} size="large" />
        <Text style={s.loadingText}>Loading Wheeler data…</Text>
      </View>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <View style={s.loadingContainer}>
        <Text style={[s.loadingText, { color: "#dc3545" }]}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Wheeler Diagram</Text>
        {isPlaceholder && (
          <View style={s.sampleBadge}>
            <Text style={s.sampleBadgeText}>Sample Data</Text>
          </View>
        )}
        {hasPending && (
          <View style={[s.sampleBadge, { backgroundColor: "rgba(255,193,7,0.12)" }]}>
            <Text style={[s.sampleBadgeText, { color: "#ffc107" }]}>
              {isSyncing ? "Syncing…" : isOnline ? "Pending" : "Offline"}
            </Text>
          </View>
        )}
        <Text style={s.headerInfo}>
          {sortedTrenches.length} trenches · {effectivePlacements.length} contexts
        </Text>
      </View>

      {/* Desktop recommended banner */}
      <View style={s.banner}>
        <Text style={s.bannerText}>
          Read-only view. Use desktop for full editing.
        </Text>
      </View>

      {/* SVG diagram with pan/zoom */}
      <View
        style={s.svgContainer}
        onLayout={(e) => {
          // Capture container dimensions if needed
          const { width: _w, height: _h } = e.nativeEvent.layout;
          void _w;
          void _h;
        }}
      >
        <GestureDetector gesture={composed}>
          <Animated.View style={[{ width: svgWidth, height: svgHeight }, animStyle]}>
            <Svg width={svgWidth} height={svgHeight}>
              {/* Cross-hatch hiatus pattern */}
              <Defs>
                <Pattern
                  id="native-hiatus"
                  patternUnits="userSpaceOnUse"
                  width={8}
                  height={8}
                >
                  <Line
                    x1={0}
                    y1={8}
                    x2={8}
                    y2={0}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={1}
                  />
                </Pattern>
              </Defs>

              {/* X-axis labels */}
              {sortedTrenches.map((trench, colIdx) => (
                <SvgText
                  key={`x-${trench.id}`}
                  x={AXIS_LABEL_W + colIdx * CELL_W + CELL_W / 2}
                  y={AXIS_LABEL_H / 2 + 4}
                  textAnchor="middle"
                  fill="#EAEAEA"
                  fontSize={11}
                  fontWeight="600"
                >
                  {trench.label}
                </SvgText>
              ))}

              {/* Y-axis labels */}
              {Array.from({ length: totalRows }, (_, rowIdx) => (
                <SvgText
                  key={`y-${rowIdx}`}
                  x={AXIS_LABEL_W - 8}
                  y={AXIS_LABEL_H + rowIdx * CELL_H + CELL_H / 2 + 4}
                  textAnchor="end"
                  fill="#888888"
                  fontSize={10}
                >
                  {totalRows - rowIdx}
                </SvgText>
              ))}

              {/* Grid cells */}
              {Array.from({ length: totalRows }, (_, rowIdx) =>
                sortedTrenches.map((trench, colIdx) => {
                  const placement = occupancy[rowIdx][colIdx];
                  const x = AXIS_LABEL_W + colIdx * CELL_W;
                  const y = AXIS_LABEL_H + rowIdx * CELL_H;

                  if (placement) {
                    const isTopLeftCol =
                      colIdx === 0 ||
                      !placement.trenchIds.includes(
                        sortedTrenches[colIdx - 1]?.id ?? "",
                      );
                    const isTopRow = rowIdx === placement.rowStart;
                    const color = getColor(placement.contextId);

                    return (
                      <G
                        key={`cell-${rowIdx}-${colIdx}`}
                        onPress={() => handleCellPress(placement)}
                      >
                        <Rect
                          x={x + 1}
                          y={y + 1}
                          width={CELL_W - 2}
                          height={CELL_H - 2}
                          rx={4}
                          fill={color}
                          opacity={0.85}
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth={1}
                        />
                        {isTopLeftCol && isTopRow && (
                          <SvgText
                            x={x + CELL_W / 2}
                            y={y + CELL_H / 2 + 4}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize={11}
                            fontWeight="700"
                          >
                            {placement.contextId}
                          </SvgText>
                        )}
                      </G>
                    );
                  }

                  // Hiatus cell
                  return (
                    <Rect
                      key={`cell-${rowIdx}-${colIdx}`}
                      x={x + 1}
                      y={y + 1}
                      width={CELL_W - 2}
                      height={CELL_H - 2}
                      rx={4}
                      fill="url(#native-hiatus)"
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth={1}
                    />
                  );
                }),
              )}

              {/* Grid outline */}
              <Rect
                x={AXIS_LABEL_W}
                y={AXIS_LABEL_H}
                width={sortedTrenches.length * CELL_W}
                height={totalRows * CELL_H}
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={1}
                rx={4}
              />
            </Svg>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Legend */}
      <View style={s.legend}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <View key={type} style={s.legendItem}>
            <View style={[s.legendSwatch, { backgroundColor: color }]} />
            <Text style={s.legendLabel}>{type}</Text>
          </View>
        ))}
      </View>

      {/* Inspect modal */}
      <Modal
        visible={!!inspected}
        transparent
        animationType="fade"
        onRequestClose={() => setInspected(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setInspected(null)}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>{inspected?.contextId ?? ""}</Text>
            {effectiveContexts.get(inspected?.contextId ?? "") && (
              <>
                <Text style={s.modalDetail}>
                  Type: {effectiveContexts.get(inspected?.contextId ?? "")?.type}
                </Text>
                <Text style={s.modalDetail}>
                  {effectiveContexts.get(inspected?.contextId ?? "")?.description}
                </Text>
              </>
            )}
            <Text style={s.modalMeta}>
              Trenches: {inspected?.trenchIds.join(", ")} · Rows{" "}
              {inspected?.rowStart}–{inspected?.rowEnd}
            </Text>
            <Pressable style={s.modalClose} onPress={() => setInspected(null)}>
              <Text style={s.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ───────────────────────── Styles ───────────────────────── */

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#F5F5F5",
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#1A1A1A",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F5F5F5",
  },
  sampleBadge: {
    backgroundColor: "rgba(255,193,7,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sampleBadgeText: {
    fontSize: 11,
    color: "#ffc107",
    fontWeight: "600",
  },
  headerInfo: {
    fontSize: 12,
    color: "#888",
    marginLeft: "auto",
  },
  banner: {
    backgroundColor: "#222222",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  bannerText: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
  },
  svgContainer: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    overflow: "hidden",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#1A1A1A",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 11,
    color: "#EAEAEA",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  modalContent: {
    backgroundColor: "#222222",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 320,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 8,
  },
  modalDetail: {
    fontSize: 14,
    color: "#EAEAEA",
    marginBottom: 4,
  },
  modalMeta: {
    fontSize: 12,
    color: "#888",
    marginTop: 8,
  },
  modalClose: {
    marginTop: 16,
    backgroundColor: ACCENT,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCloseText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});

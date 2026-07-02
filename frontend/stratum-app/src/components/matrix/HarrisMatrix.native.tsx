/**
 * @file
 * Harris Matrix component for React Native.
 *
 * Renders the Harris Matrix visualization in a WebView
 * on native platforms.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
} from "react-native";
import Svg, { Path, Defs, Marker } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { showAlert } from "../../utils/alert";
import api from "../../services/api";
import { useColorScheme } from "@/hooks/use-color-scheme";

/* ───────────────────────── Types ───────────────────────── */

type ContextType = "layer" | "deposit" | "cut" | "fill" | "structure";

type RelType =
  | "above"
  | "below"
  | "cuts"
  | "cut_by"
  | "fill_of"
  | "filled_by"
  | "seals"
  | "sealed_by"
  | "contemporary_with"
  | "equivalent"
  | "same_as";

interface ArchContext {
  id: string;
  x: number;
  y: number;
  fixed: boolean;
  type: ContextType;
  description: string;
  earliestDate: number | null;
  latestDate: number | null;
  groupId: string | null;
  phaseId: string | null;
}

interface Relationship {
  from: string;
  to: string;
  type: RelType;
}

interface SavePayload {
  contexts: [string, ArchContext][];
  relationships: Relationship[];
  groups: any[];
  subGroups: any[];
  phases: any[];
}

interface HarrisMatrixProps {
  projectId: string;
  canEdit?: boolean;
}

/* ───────────────────────── Constants ───────────────────────── */

const ACCENT = "#FF2A2A";
const NODE_W = 100;
const NODE_H = 50;
const NODE_RX = 10;
const X_SPACING = 130;
const Y_SPACING = 120;
const { width: SCREEN_W } = Dimensions.get("window");

const REL_OPTIONS: {
  value: RelType;
  label: (s: string, t: string) => string;
}[] = [
  { value: "above", label: (s, t) => `${s} is ABOVE ${t}` },
  { value: "below", label: (s, t) => `${s} is BELOW ${t}` },
  { value: "cuts", label: (s, t) => `${s} CUTS ${t}` },
  { value: "cut_by", label: (s, t) => `${s} is CUT BY ${t}` },
  { value: "fill_of", label: (s, t) => `${s} is FILL OF ${t}` },
  { value: "filled_by", label: (s, t) => `${s} is FILLED BY ${t}` },
  { value: "contemporary_with", label: () => "Contemporary With" },
];

/* ───────────────── Sugiyama layout ───────────────── */

function computeLayout(
  contexts: Map<string, ArchContext>,
  relationships: Relationship[],
): Map<string, { x: number; y: number }> {
  const ids = Array.from(contexts.keys());
  if (ids.length === 0) return new Map();

  // Build adjacency (downward edges) + in-degree for topological sort
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  const inDeg = new Map<string, number>(ids.map((id) => [id, 0]));

  for (const rel of relationships) {
    let from: string | undefined;
    let to: string | undefined;
    // Stratigraphic edges: higher → lower in the graph
    if (["above", "seals", "cuts", "fill_of"].includes(rel.type)) {
      from = rel.to;
      to = rel.from;
    } else if (["below", "sealed_by", "cut_by", "filled_by"].includes(rel.type)) {
      from = rel.from;
      to = rel.to;
    }
    if (from && to && contexts.has(from) && contexts.has(to)) {
      adj.get(from)!.push(to);
      inDeg.set(to, (inDeg.get(to) || 0) + 1);
    }
  }

  // Kahn's topological sort → assign levels
  const levels = new Map<string, number>();
  const queue = ids.filter((id) => inDeg.get(id) === 0);
  let idx = 0;

  while (idx < queue.length) {
    const u = queue[idx++];
    if (!levels.has(u)) levels.set(u, 0);
    for (const v of adj.get(u) || []) {
      levels.set(v, Math.max(levels.get(v) || 0, levels.get(u)! + 1));
      inDeg.set(v, inDeg.get(v)! - 1);
      if (inDeg.get(v) === 0) queue.push(v);
    }
  }
  // Handle cycles / unvisited
  for (const id of ids) {
    if (!levels.has(id)) levels.set(id, 0);
  }

  // Group nodes per level
  const layerMap = new Map<number, string[]>();
  for (const [id, level] of levels) {
    if (!layerMap.has(level)) layerMap.set(level, []);
    layerMap.get(level)!.push(id);
  }

  const maxLevel = Math.max(...levels.values(), 0);
  const positions = new Map<string, { x: number; y: number }>();

  for (const [level, nodes] of layerMap) {
    const layerWidth = (nodes.length - 1) * X_SPACING;
    const startX = Math.max(NODE_W, (SCREEN_W - layerWidth) / 2);
    const yPos = 60 + (maxLevel - level) * Y_SPACING;

    nodes.forEach((id, i) => {
      const ctx = contexts.get(id)!;
      if (ctx.fixed) {
        positions.set(id, { x: ctx.x, y: ctx.y });
      } else {
        positions.set(id, { x: startX + i * X_SPACING, y: yPos });
      }
    });
  }

  return positions;
}

/* ────────── Edge path helper (orthogonal) ────────── */

function edgePath(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): string {
  const startY = p1.y + NODE_H / 2;
  const endY = p2.y - NODE_H / 2;
  const midY = startY + (endY - startY) / 2;
  return `M ${p1.x},${startY} V ${midY} H ${p2.x} V ${endY}`;
}

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */

export default function HarrisMatrix({
  projectId,
  canEdit = true,
}: HarrisMatrixProps) {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const neutralEdgeColor = isDarkMode ? "#8E96A3" : "#495057";
  const cutEdgeColor = "#dc3545";
  const placeholderTextColor = isDarkMode ? "#777777" : "#8A8A8A";

  /* ── data state ── */
  const [contexts, setContexts] = useState<Map<string, ArchContext>>(new Map());
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const statusDotColor = isOnline ? "#4CAF50" : "#FF4444";

  /* ── modal state ── */
  const [showCtxModal, setShowCtxModal] = useState(false);
  const [newCtxId, setNewCtxId] = useState("");
  const [newCtxType, setNewCtxType] = useState<ContextType>("layer");
  const [newCtxDesc, setNewCtxDesc] = useState("");

  const [showRelModal, setShowRelModal] = useState(false);
  const [relSource, setRelSource] = useState("");
  const [relTarget, setRelTarget] = useState("");
  const [relType, setRelType] = useState<RelType>("above");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editId, setEditId] = useState("");
  const [editType, setEditType] = useState<ContextType>("layer");
  const [editDesc, setEditDesc] = useState("");

  const [showInfoPanel, setShowInfoPanel] = useState(false);

  /* ── pan / zoom shared values ── */
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const savedScale = useSharedValue(1);

  /* ── canvas dimensions ── */
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: SCREEN_W,
    height: 400,
  });

  /* ── storage keys ── */
  const storageKey = `harrisMatrixData:${projectId}`;
  const pendingKey = `harrisMatrixPending:${projectId}`;

  /* ── network listener ── */
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => {
      setIsOnline(!!(s.isConnected && s.isInternetReachable));
    });
    return () => unsub();
  }, []);

  /* ── load data from AsyncStorage ── */
  useEffect(() => {
    (async () => {
      try {
        const [raw, pending] = await Promise.all([
          AsyncStorage.getItem(storageKey),
          AsyncStorage.getItem(pendingKey),
        ]);
        if (raw) {
          const data: SavePayload = JSON.parse(raw);
          setContexts(
            new Map(data.contexts.map(([id, obj]) => [id, { ...obj, id }])),
          );
          setRelationships(data.relationships || []);
        }
        setHasPending(pending === "true");
      } catch (e) {
        console.error("[HarrisMatrix] load error", e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  /* ── persist to AsyncStorage ── */
  const persist = useCallback(
    async (ctxs: Map<string, ArchContext>, rels: Relationship[]) => {
      const payload: SavePayload = {
        contexts: Array.from(ctxs.entries()),
        relationships: rels,
        groups: [],
        subGroups: [],
        phases: [],
      };
      await AsyncStorage.setItem(storageKey, JSON.stringify(payload));
      await AsyncStorage.setItem(pendingKey, "true");
      setHasPending(true);
    },
    [storageKey, pendingKey],
  );

  /* ── sync to server ── */
  const syncToServer = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        try {
          await api.put(`/projects/${projectId}/harris-matrix`, {
            data: JSON.parse(raw),
          });
        } catch (e: any) {
          if (e.response?.status !== 404) throw e;
        }
        await AsyncStorage.setItem(pendingKey, "false");
        setHasPending(false);
      }
    } catch (e) {
      console.error("[HarrisMatrix] sync error", e);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, storageKey, pendingKey, projectId]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && hasPending) syncToServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, hasPending]);

  /* ── computed layout ── */
  const positions = useMemo(
    () => computeLayout(contexts, relationships),
    [contexts, relationships],
  );

  // SVG viewport bounds
  const svgBounds = useMemo(() => {
    if (positions.size === 0)
      return { minX: 0, minY: 0, width: SCREEN_W, height: 400 };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const { x, y } of positions.values()) {
      if (x - NODE_W / 2 < minX) minX = x - NODE_W / 2;
      if (y - NODE_H / 2 < minY) minY = y - NODE_H / 2;
      if (x + NODE_W / 2 > maxX) maxX = x + NODE_W / 2;
      if (y + NODE_H / 2 > maxY) maxY = y + NODE_H / 2;
    }
    const pad = 60;
    const width = Math.max(maxX - minX + pad * 2, SCREEN_W);
    const height = Math.max(maxY - minY + pad * 2, 400);
    return {
      minX: minX - pad,
      minY: minY - pad,
      width,
      height,
    };
  }, [positions]);

  // Shift all positions so the content coordinate system starts at (0, 0)
  // This lets us render both the SVG edges and the overlay node Views in the same space.
  const shiftedPositions = useMemo(() => {
    const shifted = new Map<string, { x: number; y: number }>();
    for (const [id, pos] of positions) {
      shifted.set(id, {
        x: pos.x - svgBounds.minX,
        y: pos.y - svgBounds.minY,
      });
    }
    return shifted;
  }, [positions, svgBounds.minX, svgBounds.minY]);

  /* ── computed edges ── */
  const edges = useMemo(() => {
    const result: {
      path: string;
      isCut: boolean;
      isContemporary: boolean;
    }[] = [];
    for (const rel of relationships) {
      // Contemporary / equivalent → horizontal line
      if (["contemporary_with", "equivalent", "same_as"].includes(rel.type)) {
        const p1 = shiftedPositions.get(rel.from);
        const p2 = shiftedPositions.get(rel.to);
        if (p1 && p2) {
          const x1 = p1.x < p2.x ? p1.x + NODE_W / 2 : p1.x - NODE_W / 2;
          const x2 = p1.x < p2.x ? p2.x - NODE_W / 2 : p2.x + NODE_W / 2;
          result.push({
            path: `M ${x1},${p1.y} L ${x2},${p2.y}`,
            isCut: false,
            isContemporary: true,
          });
        }
        continue;
      }
      // Stratigraphic edge
      let from: string | undefined;
      let to: string | undefined;
      if (["above", "seals", "cuts", "fill_of"].includes(rel.type)) {
        from = rel.to;
        to = rel.from;
      } else if (["below", "sealed_by", "cut_by", "filled_by"].includes(rel.type)) {
        from = rel.from;
        to = rel.to;
      }
      if (from && to) {
        const p1 = shiftedPositions.get(from);
        const p2 = shiftedPositions.get(to);
        if (p1 && p2) {
          result.push({
            path: edgePath(p1, p2),
            isCut: ["cuts", "cut_by"].includes(rel.type),
            isContemporary: false,
          });
        }
      }
    }
    return result;
  }, [relationships, shiftedPositions]);

  /* ── suggest next ID ── */
  const suggestId = useCallback(() => {
    if (contexts.size === 0) return "1001";
    const nums = Array.from(contexts.keys())
      .map((k) => parseInt(k.match(/\d+$/)?.[0] || "", 10))
      .filter((n) => !isNaN(n));
    return nums.length > 0
      ? (Math.max(...nums) + 1).toString()
      : (1000 + contexts.size + 1).toString();
  }, [contexts]);

  /* ───────────── Actions ───────────── */

  const addContext = useCallback(() => {
    const id = newCtxId.trim().toUpperCase();
    if (!id || contexts.has(id)) {
      showAlert("Invalid", `Context "${id}" is empty or already exists.`);
      return;
    }
    const ctx: ArchContext = {
      id,
      x: SCREEN_W / 2,
      y: 200,
      fixed: false,
      type: newCtxType,
      description: newCtxDesc,
      earliestDate: null,
      latestDate: null,
      groupId: null,
      phaseId: null,
    };
    const next = new Map(contexts);
    next.set(id, ctx);
    setContexts(next);
    persist(next, relationships);
    setShowCtxModal(false);
  }, [newCtxId, newCtxType, newCtxDesc, contexts, relationships, persist]);

  const addRelationship = useCallback(() => {
    const next = [
      ...relationships,
      { from: relSource, to: relTarget, type: relType },
    ];
    // Reset fixed so layout recalculates
    const nextCtx = new Map(contexts);
    const c1 = nextCtx.get(relSource);
    const c2 = nextCtx.get(relTarget);
    if (c1) nextCtx.set(relSource, { ...c1, fixed: false });
    if (c2) nextCtx.set(relTarget, { ...c2, fixed: false });
    setContexts(nextCtx);
    setRelationships(next);
    persist(nextCtx, next);
    setShowRelModal(false);
  }, [relSource, relTarget, relType, relationships, contexts, persist]);

  const saveEdit = useCallback(() => {
    const nextCtx = new Map(contexts);
    const old = nextCtx.get(editId);
    if (!old) return;
    nextCtx.set(editId, { ...old, type: editType, description: editDesc });
    setContexts(nextCtx);
    persist(nextCtx, relationships);
    setShowEditModal(false);
  }, [editId, editType, editDesc, contexts, relationships, persist]);

  const deleteNode = useCallback(() => {
    const nextCtx = new Map(contexts);
    nextCtx.delete(editId);
    const nextRels = relationships.filter(
      (r) => r.from !== editId && r.to !== editId,
    );
    setContexts(nextCtx);
    setRelationships(nextRels);
    persist(nextCtx, nextRels);
    setShowEditModal(false);
  }, [editId, contexts, relationships, persist]);

  const clearAll = useCallback(() => {
    showAlert("Clear All?", "This will permanently delete all Harris Matrix data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: () => {
          const empty = new Map<string, ArchContext>();
          setContexts(empty);
          setRelationships([]);
          persist(empty, []);
        },
      },
    ]);
  }, [persist]);

  /* ── open modals / node actions (must be defined before gestures) ── */
  const openNewCtx = useCallback(() => {
    if (!canEdit) return;
    setNewCtxId(suggestId());
    setNewCtxType("layer");
    setNewCtxDesc("");
    setShowCtxModal(true);
  }, [canEdit, suggestId]);

  const onNodePress = useCallback(
    (id: string) => {
      setEditId(id);
      const ctx = contexts.get(id);
      if (ctx) {
        setEditType(ctx.type);
        setEditDesc(ctx.description);
      }
      setShowEditModal(true);
    },
    [contexts],
  );

  const onNodeLongPress = useCallback(
    (id: string) => {
      if (!canEdit) return;
      setRelSource(id);
      const others = Array.from(contexts.keys()).filter((k) => k !== id);
      if (others.length === 0) {
        showAlert("No targets", "Add more contexts first.");
        return;
      }
      setRelTarget(others[0]);
      setRelType("above");
      setShowRelModal(true);
    },
    [canEdit, contexts],
  );

  /* ───────────── Gestures ───────────── */

  const panGesture = Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 0.3), 4);
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const defaultView = useMemo(() => {
    const vpW = canvasDimensions.width || 0;
    const vpH = canvasDimensions.height || 0;
    const contentW = svgBounds.width || 0;
    const contentH = svgBounds.height || 0;
    return {
      x: (vpW - contentW) / 2,
      y: (vpH - contentH) / 2,
    };
  }, [
    canvasDimensions.width,
    canvasDimensions.height,
    svgBounds.width,
    svgBounds.height,
  ]);

  const hasInitializedView = useRef(false);

  useEffect(() => {
    if (hasInitializedView.current) return;
    if (canvasDimensions.width <= 0 || canvasDimensions.height <= 0) return;
    translateX.value = defaultView.x;
    translateY.value = defaultView.y;
    savedTranslateX.value = defaultView.x;
    savedTranslateY.value = defaultView.y;
    scale.value = 1;
    savedScale.value = 1;
    hasInitializedView.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canvasDimensions.width,
    canvasDimensions.height,
    defaultView.x,
    defaultView.y,
  ]);

  useEffect(() => {
    if (contexts.size !== 0) return;
    hasInitializedView.current = false;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    scale.value = 1;
    savedScale.value = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contexts.size]);

  const resetView = useCallback(() => {
    translateX.value = withTiming(defaultView.x);
    translateY.value = withTiming(defaultView.y);
    scale.value = withTiming(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultView.x, defaultView.y]);

  /* ── node colour ── */
  const nodeColor = useCallback(
    (id: string) => {
      const ctx = contexts.get(id);
      if (ctx?.phaseId) return "#28a745";
      if (ctx?.groupId) return "#ffc107";
      return ACCENT;
    },
    [contexts],
  );

  /* ═══════════════════ RENDER ═══════════════════ */

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Loading Harris Matrix…</Text>
      </View>
    );
  }

  const contextList = Array.from(contexts.keys());

  return (
    <SafeAreaView
      style={styles.root}
      edges={Platform.OS === "ios" ? ["bottom"] : []}
    >
      {/* ── Status bar ── */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={[styles.dot, { backgroundColor: statusDotColor }]} />
          <Text style={styles.statusText}>{isOnline ? "Online" : "Offline"}</Text>
          {hasPending && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>Unsaved</Text>
            </View>
          )}
        </View>
        {isSyncing ? (
          <ActivityIndicator size="small" color={ACCENT} />
        ) : isOnline && hasPending ? (
          <TouchableOpacity style={styles.syncBtn} onPress={syncToServer}>
            <Text style={styles.syncBtnText}>Sync</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Toolbar ── */}
      <View style={styles.toolbar}>
        <Pressable style={styles.toolBtn} onPress={resetView}>
          <Text style={styles.toolBtnText}>Reset</Text>
        </Pressable>
        <Pressable style={styles.toolBtn} onPress={() => setShowInfoPanel(true)}>
          <Text style={styles.toolBtnText}>Info</Text>
        </Pressable>
        {canEdit && (
          <Pressable
            style={[styles.toolBtn, styles.toolBtnAccent]}
            onPress={openNewCtx}
          >
            <Text style={[styles.toolBtnText, styles.toolBtnTextOnAccent]}>
              Add Context
            </Text>
          </Pressable>
        )}
        {canEdit && (
          <Pressable
            style={[styles.toolBtn, styles.toolBtnDanger]}
            onPress={clearAll}
          >
            <Text style={[styles.toolBtnText, styles.toolBtnTextOnAccent]}>
              Clear
            </Text>
          </Pressable>
        )}
      </View>

      {/* ── SVG Canvas ── */}
      <View
        style={styles.canvas}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) setCanvasDimensions({ width, height });
        }}
      >
        <GestureDetector gesture={composed}>
          <View style={styles.gestureLayer} collapsable={false}>
            <Animated.View
              style={[
                styles.canvasInner,
                {
                  width: svgBounds.width,
                  height: svgBounds.height,
                },
                animStyle,
              ]}
            >
              <Svg
                pointerEvents="none"
                width={svgBounds.width}
                height={svgBounds.height}
                viewBox={`0 0 ${svgBounds.width} ${svgBounds.height}`}
                preserveAspectRatio="none"
              >
                <Defs>
                  <Marker
                    id="arrow"
                    viewBox="0 -5 10 10"
                    refX="5"
                    refY="0"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto"
                  >
                    <Path d="M0,-5L10,0L0,5" fill={neutralEdgeColor} />
                  </Marker>
                  <Marker
                    id="arrowCut"
                    viewBox="0 -5 10 10"
                    refX="5"
                    refY="0"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto"
                  >
                    <Path d="M0,-5L10,0L0,5" fill={cutEdgeColor} />
                  </Marker>
                </Defs>

                {/* Edges */}
                {edges.map((e, i) => (
                  <Path
                    key={`edge-${i}`}
                    d={e.path}
                    fill="none"
                    stroke={e.isCut ? cutEdgeColor : neutralEdgeColor}
                    strokeWidth={e.isCut ? 2.5 : e.isContemporary ? 1.5 : 2}
                    strokeDasharray={
                      e.isCut ? [6, 4] : e.isContemporary ? [4, 4] : undefined
                    }
                    markerEnd={
                      e.isContemporary
                        ? undefined
                        : e.isCut
                          ? "url(#arrowCut)"
                          : "url(#arrow)"
                    }
                  />
                ))}
              </Svg>

              {/* Overlay Nodes as real RN Views */}
              {contextList.map((id) => {
                const pos = shiftedPositions.get(id);
                if (!pos) return null;
                return (
                  <Pressable
                    key={id}
                    style={[
                      styles.node,
                      {
                        left: pos.x - NODE_W / 2,
                        top: pos.y - NODE_H / 2,
                        width: NODE_W,
                        height: NODE_H,
                        borderRadius: NODE_RX,
                        backgroundColor: nodeColor(id),
                        borderColor: nodeColor(id),
                      },
                    ]}
                    onPress={() => onNodePress(id)}
                    onLongPress={() => onNodeLongPress(id)}
                    delayLongPress={300}
                  >
                    <Text style={styles.nodeText}>{id}</Text>
                  </Pressable>
                );
              })}
            </Animated.View>
          </View>
        </GestureDetector>

        {/* Empty-state overlay */}
        {contexts.size === 0 && (
          <View style={styles.emptyOverlay} pointerEvents="box-none">
            <Text style={styles.emptyTitle}>No contexts yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "+ Add Context" to start building your Harris Matrix
            </Text>
          </View>
        )}
      </View>

      {/* ═══════════ Modals ═══════════ */}

      {/* Info Panel */}
      <Modal
        visible={showInfoPanel}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoPanel(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setShowInfoPanel(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Statistics</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{contexts.size}</Text>
                <Text style={styles.statLabel}>Contexts</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{relationships.length}</Text>
                <Text style={styles.statLabel}>Relations</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowInfoPanel(false)}
            >
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* New Context */}
      <Modal
        visible={showCtxModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCtxModal(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Context</Text>

            <Text style={styles.inputLabel}>Context ID</Text>
            <TextInput
              style={styles.input}
              value={newCtxId}
              onChangeText={setNewCtxId}
              placeholder="e.g., 1001"
              placeholderTextColor={placeholderTextColor}
              autoCapitalize="characters"
            />

            <Text style={styles.inputLabel}>Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
            >
              {(
                ["layer", "deposit", "cut", "fill", "structure"] as ContextType[]
              ).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chipBtn, newCtxType === t && styles.chipBtnActive]}
                  onPress={() => setNewCtxType(t)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      newCtxType === t && styles.chipTextActive,
                    ]}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 60 }]}
              value={newCtxDesc}
              onChangeText={setNewCtxDesc}
              placeholder="Brief description"
              placeholderTextColor={placeholderTextColor}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnAccent]}
                onPress={addContext}
              >
                <Text style={styles.actionBtnText}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnCancel]}
                onPress={() => setShowCtxModal(false)}
              >
                <Text style={styles.actionBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Relationship */}
      <Modal
        visible={showRelModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRelModal(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{relSource} → ?</Text>

            <Text style={styles.inputLabel}>Target</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
            >
              {Array.from(contexts.keys())
                .filter((k) => k !== relSource)
                .map((k) => (
                  <TouchableOpacity
                    key={k}
                    style={[styles.chipBtn, relTarget === k && styles.chipBtnActive]}
                    onPress={() => setRelTarget(k)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        relTarget === k && styles.chipTextActive,
                      ]}
                    >
                      {k}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Relationship</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {REL_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.relRow,
                    relType === opt.value && styles.relRowActive,
                  ]}
                  onPress={() => setRelType(opt.value)}
                >
                  <Text
                    style={[
                      styles.relRowText,
                      relType === opt.value && styles.relRowTextActive,
                    ]}
                  >
                    {opt.label(relSource, relTarget)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnAccent]}
                onPress={addRelationship}
              >
                <Text style={styles.actionBtnText}>Add</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnCancel]}
                onPress={() => setShowRelModal(false)}
              >
                <Text style={styles.actionBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit / View Context */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {canEdit ? "Edit" : "View"}: {editId}
            </Text>

            <Text style={styles.inputLabel}>Type</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
            >
              {(
                ["layer", "deposit", "cut", "fill", "structure"] as ContextType[]
              ).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chipBtn, editType === t && styles.chipBtnActive]}
                  onPress={() => canEdit && setEditType(t)}
                  disabled={!canEdit}
                >
                  <Text
                    style={[
                      styles.chipText,
                      editType === t && styles.chipTextActive,
                    ]}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 60 }]}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="Description"
              placeholderTextColor={placeholderTextColor}
              multiline
              editable={canEdit}
            />

            {/* Relationships for this node */}
            {relationships.filter((r) => r.from === editId || r.to === editId)
              .length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>Relationships</Text>
                {relationships
                  .filter((r) => r.from === editId || r.to === editId)
                  .map((r, i) => (
                    <View key={i} style={styles.relInfoRow}>
                      <Text style={styles.relInfoText}>
                        {r.from} → {r.to} ({r.type.replace(/_/g, " ")})
                      </Text>
                      {canEdit && (
                        <TouchableOpacity
                          onPress={() => {
                            const next = relationships.filter(
                              (_, idx) => idx !== relationships.indexOf(r),
                            );
                            setRelationships(next);
                            persist(contexts, next);
                          }}
                        >
                          <Text style={styles.deleteRelText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
              </View>
            )}

            <View style={styles.modalActions}>
              {canEdit && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnAccent]}
                  onPress={saveEdit}
                >
                  <Text style={styles.actionBtnText}>Save</Text>
                </TouchableOpacity>
              )}
              {canEdit && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnDanger]}
                  onPress={deleteNode}
                >
                  <Text style={styles.actionBtnText}>Delete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnCancel]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.actionBtnText}>
                  {canEdit ? "Cancel" : "Close"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ─────────────────────── Styles ─────────────────────── */

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: isDarkMode ? "#111111" : "#F6F6F6" },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDarkMode ? "#111111" : "#F6F6F6",
    },
    loadingText: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginTop: 12,
      fontSize: 16,
    },

    /* status bar */
    statusBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    statusLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    statusText: {
      fontSize: 13,
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontWeight: "500",
    },
    pendingBadge: {
      backgroundColor: "rgba(255,193,7,0.2)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    pendingText: { fontSize: 11, color: "#ffc107", fontWeight: "600" },
    syncBtn: {
      backgroundColor: ACCENT,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 8,
    },
    syncBtnText: { color: "#FFF", fontSize: 12, fontWeight: "700" },

    /* canvas */
    canvas: {
      flex: 1,
      overflow: "hidden",
      backgroundColor: isDarkMode ? "#101010" : "#F6F6F6",
    },
    gestureLayer: {
      ...StyleSheet.absoluteFillObject,
    },
    canvasInner: {
      position: "relative",
      ...Platform.select({
        ios: {
          // Explicit layout for iOS SVG rendering
          position: "relative",
        },
      }),
    },

    node: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
    },
    nodeText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "600",
    },

    /* empty */
    emptyOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      textAlign: "center",
      paddingHorizontal: 40,
    },

    /* toolbar */
    toolbar: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    toolBtn: {
      flex: 1,
      minWidth: 70,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: isDarkMode ? "#232323" : "#EFEFEF",
      alignItems: "center",
    },
    toolBtnAccent: { backgroundColor: ACCENT },
    toolBtnDanger: { backgroundColor: "#dc3545" },
    toolBtnText: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 13,
      fontWeight: "600",
    },
    toolBtnTextOnAccent: { color: "#FFF" },

    /* modal */
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.24)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalCard: {
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 16,
      padding: 20,
      width: "100%",
      maxWidth: 420,
      maxHeight: "85%",
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: isDarkMode ? "#141414" : "#FFFFFF",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? "#333333" : "#D9D9D9",
      fontSize: 16,
      marginBottom: 12,
    },
    chipBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: isDarkMode ? "#232323" : "#EFEFEF",
      marginRight: 8,
    },
    chipBtnActive: { backgroundColor: ACCENT },
    chipText: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 13,
      fontWeight: "600",
    },
    chipTextActive: { color: "#FFF" },

    relRow: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: isDarkMode ? "#232323" : "#EFEFEF",
      marginBottom: 6,
    },
    relRowActive: { backgroundColor: ACCENT },
    relRowText: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 14,
    },
    relRowTextActive: { color: "#FFF", fontWeight: "600" },

    relInfoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: isDarkMode ? "#242424" : "#F5F5F5",
      borderRadius: 8,
      marginBottom: 4,
    },
    relInfoText: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 13,
      flex: 1,
    },
    deleteRelText: {
      color: "#dc3545",
      fontSize: 16,
      fontWeight: "700",
      paddingLeft: 12,
    },

    modalActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
    },
    actionBtnAccent: { backgroundColor: ACCENT },
    actionBtnDanger: { backgroundColor: "#dc3545" },
    actionBtnCancel: { backgroundColor: isDarkMode ? "#555555" : "#8A8A8A" },
    actionBtnText: { color: "#FFF", fontSize: 15, fontWeight: "600" },

    /* stats */
    statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
    statBox: {
      flex: 1,
      backgroundColor: isDarkMode ? "#232323" : "#EFEFEF",
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
    },
    statValue: { fontSize: 28, fontWeight: "800", color: ACCENT },
    statLabel: {
      fontSize: 12,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginTop: 4,
    },
    closeModalBtn: {
      backgroundColor: isDarkMode ? "#232323" : "#EFEFEF",
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
    },
    closeModalBtnText: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 15,
      fontWeight: "600",
    },
  });

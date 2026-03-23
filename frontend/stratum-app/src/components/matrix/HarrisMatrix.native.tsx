/**
 * @file
 * Harris Matrix component for React Native.
 *
 * Renders the Harris Matrix visualization in a WebView
 * on native platforms.
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
} from "react-native";
import {
  NativeNavigationBar,
  NativeToolbar,
  NativeToolbarButton,
  NativeToolbarMenu,
  NativeButton,
} from "liquid-react";
import Svg, { Path, Defs, Marker } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { showAlert } from "../../utils/alert";
import api from "../../services/api";

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

const NODE_COLORS: Record<ContextType, string> = {
  layer: "#FF2A2A",
  deposit: "#ffc107",
  cut: "#dc3545",
  fill: "#28a745",
  structure: "#9c27b0",
};

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
  /* ── data state ── */
  const [contexts, setContexts] = useState<Map<string, ArchContext>>(new Map());
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasPending, setHasPending] = useState(false);

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
      if (ctx?.phaseId) return "#22C55E";
      if (ctx?.groupId) return "#ffc107";
      return NODE_COLORS[ctx?.type ?? "layer"] ?? ACCENT;
    },
    [contexts],
  );

  /* ═══════════════════ RENDER ═══════════════════ */

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={s.loadingText}>Loading Harris Matrix…</Text>
      </View>
    );
  }

  const contextList = Array.from(contexts.keys());

  return (
    <View style={s.container}>
      {/* ── Native navigation bar ── */}
      <NativeNavigationBar title="Harris Matrix" style={{ width: "100%" }} />

      {/* ── Status strip (counts + pending state) ── */}
      <View style={s.statusStrip}>
        <Text style={s.statusText}>
          {contexts.size} contexts · {relationships.length} relations
        </Text>
        {hasPending && (
          <View style={s.pendingBadge}>
            <Text style={s.pendingBadgeText}>
              {isSyncing ? "Syncing…" : isOnline ? "Pending" : "Offline"}
            </Text>
          </View>
        )}
      </View>

      {/* ── Native toolbar ── */}
      <NativeToolbar translucent={false} style={{ width: "100%" }}>
        {canEdit && <NativeToolbarButton systemItem="add" onPress={openNewCtx} />}
        <NativeToolbarButton systemItem="flexibleSpace" />
        {isSyncing && (
          <ActivityIndicator
            size="small"
            color={ACCENT}
            style={{ marginRight: 8 }}
          />
        )}
        <NativeToolbarMenu
          icon="ellipsis.circle"
          menuItems={[
            {
              id: "resetView",
              title: "Reset View",
              icon: "arrow.up.left.and.arrow.down.right",
            },
            {
              id: "info",
              title: "Statistics",
              icon: "chart.bar.fill",
            },
            ...(isOnline && hasPending && !isSyncing && canEdit
              ? [
                  {
                    id: "sync",
                    title: "Sync Now",
                    icon: "arrow.triangle.2.circlepath",
                  },
                ]
              : []),
            ...(canEdit
              ? [
                  {
                    id: "clear",
                    title: "Clear All",
                    icon: "trash.fill",
                    destructive: true,
                  },
                ]
              : []),
          ]}
          onMenuAction={(e: any) => {
            const id = e.nativeEvent.id;
            if (id === "resetView") resetView();
            else if (id === "info") setShowInfoPanel(true);
            else if (id === "sync") syncToServer();
            else if (id === "clear") clearAll();
          }}
        />
      </NativeToolbar>

      {/* ── Banner ── */}
      <View style={s.banner}>
        <Text style={s.bannerText}>
          {canEdit
            ? "Tap a node to edit · Long-press to add a relationship"
            : "Read-only view. Use desktop for full editing."}
        </Text>
      </View>

      {/* ── SVG Canvas ── */}
      <View
        style={s.svgContainer}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) setCanvasDimensions({ width, height });
        }}
      >
        <GestureDetector gesture={composed}>
          <View style={s.gestureLayer} collapsable={false}>
            <Animated.View
              style={[
                s.canvasInner,
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
                    <Path d="M0,-5L10,0L0,5" fill="#495057" />
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
                    <Path d="M0,-5L10,0L0,5" fill="#dc3545" />
                  </Marker>
                </Defs>

                {/* Edges */}
                {edges.map((e, i) => (
                  <Path
                    key={`edge-${i}`}
                    d={e.path}
                    fill="none"
                    stroke={
                      e.isContemporary ? "#495057" : e.isCut ? "#dc3545" : "#495057"
                    }
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
                      s.node,
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
                    <Text style={s.nodeText}>{id}</Text>
                  </Pressable>
                );
              })}
            </Animated.View>
          </View>
        </GestureDetector>

        {/* Empty-state overlay */}
        {contexts.size === 0 && (
          <View style={s.emptyOverlay} pointerEvents="box-none">
            <Text style={s.emptyTitle}>No contexts yet</Text>
            <Text style={s.emptySubtitle}>
              Tap "+ Context" to start building your Harris Matrix
            </Text>
          </View>
        )}
      </View>

      {/* ── Legend ── */}
      <View style={s.legend}>
        {(["layer", "deposit", "cut", "fill", "structure"] as ContextType[]).map(
          (type) => (
            <View key={type} style={s.legendItem}>
              <View
                style={[s.legendSwatch, { backgroundColor: NODE_COLORS[type] }]}
              />
              <Text style={s.legendLabel}>{type}</Text>
            </View>
          ),
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
        <Pressable style={s.modalBackdrop} onPress={() => setShowInfoPanel(false)}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Statistics</Text>
            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={s.statValue}>{contexts.size}</Text>
                <Text style={s.statLabel}>Contexts</Text>
              </View>
              <View style={s.statBox}>
                <Text style={s.statValue}>{relationships.length}</Text>
                <Text style={s.statLabel}>Relations</Text>
              </View>
            </View>
            <NativeButton
              title="Close"
              buttonStyle="filled"
              onPress={() => setShowInfoPanel(false)}
              style={{ width: "100%", marginTop: 4 }}
            />
          </View>
        </Pressable>
      </Modal>

      {/* New Context */}
      <Modal
        visible={showCtxModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCtxModal(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setShowCtxModal(false)}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>New Context</Text>

            <Text style={s.inputLabel}>Context ID</Text>
            <TextInput
              style={s.input}
              value={newCtxId}
              onChangeText={setNewCtxId}
              placeholder="e.g., 1001"
              placeholderTextColor="#555"
              autoCapitalize="characters"
            />

            <Text style={s.inputLabel}>Type</Text>
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
                  style={[s.chipBtn, newCtxType === t && s.chipBtnActive]}
                  onPress={() => setNewCtxType(t)}
                >
                  <Text style={[s.chipText, newCtxType === t && s.chipTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.inputLabel}>Description</Text>
            <TextInput
              style={[s.input, { height: 60 }]}
              value={newCtxDesc}
              onChangeText={setNewCtxDesc}
              placeholder="Brief description"
              placeholderTextColor="#555"
              multiline
            />

            <View style={s.modalActions}>
              <NativeButton
                title="Create"
                buttonStyle="filled"
                onPress={addContext}
                style={{ flex: 1 }}
              />
              <NativeButton
                title="Cancel"
                buttonStyle="plain"
                onPress={() => setShowCtxModal(false)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Relationship */}
      <Modal
        visible={showRelModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRelModal(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setShowRelModal(false)}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>{relSource} → ?</Text>

            <Text style={s.inputLabel}>Target</Text>
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
                    style={[s.chipBtn, relTarget === k && s.chipBtnActive]}
                    onPress={() => setRelTarget(k)}
                  >
                    <Text style={[s.chipText, relTarget === k && s.chipTextActive]}>
                      {k}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <Text style={s.inputLabel}>Relationship</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {REL_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.relRow, relType === opt.value && s.relRowActive]}
                  onPress={() => setRelType(opt.value)}
                >
                  <Text
                    style={[
                      s.relRowText,
                      relType === opt.value && s.relRowTextActive,
                    ]}
                  >
                    {opt.label(relSource, relTarget)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.modalActions}>
              <NativeButton
                title="Add"
                buttonStyle="filled"
                onPress={addRelationship}
                style={{ flex: 1 }}
              />
              <NativeButton
                title="Cancel"
                buttonStyle="plain"
                onPress={() => setShowRelModal(false)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Edit / View Context */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setShowEditModal(false)}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>
              {canEdit ? "Edit" : "View"}: {editId}
            </Text>

            <Text style={s.inputLabel}>Type</Text>
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
                  style={[s.chipBtn, editType === t && s.chipBtnActive]}
                  onPress={() => canEdit && setEditType(t)}
                  disabled={!canEdit}
                >
                  <Text style={[s.chipText, editType === t && s.chipTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.inputLabel}>Description</Text>
            <TextInput
              style={[s.input, { height: 60 }]}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="Description"
              placeholderTextColor="#555"
              multiline
              editable={canEdit}
            />

            {/* Relationships for this node */}
            {relationships.filter((r) => r.from === editId || r.to === editId)
              .length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={s.inputLabel}>Relationships</Text>
                {relationships
                  .filter((r) => r.from === editId || r.to === editId)
                  .map((r, i) => (
                    <View key={i} style={s.relInfoRow}>
                      <Text style={s.relInfoText}>
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
                          <Text style={s.deleteRelText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
              </View>
            )}

            <View style={s.modalActions}>
              {canEdit && (
                <NativeButton
                  title="Save"
                  buttonStyle="filled"
                  onPress={saveEdit}
                  style={{ flex: 1 }}
                />
              )}
              {canEdit && (
                <TouchableOpacity
                  style={[s.modalActionBtn, s.modalActionBtnDanger]}
                  onPress={deleteNode}
                >
                  <Text style={s.modalActionBtnText}>Delete</Text>
                </TouchableOpacity>
              )}
              <NativeButton
                title={canEdit ? "Cancel" : "Close"}
                buttonStyle="plain"
                onPress={() => setShowEditModal(false)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ─────────────────────── Styles ─────────────────────── */

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
  statusStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "#1A1A1A",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  statusText: {
    fontSize: 12,
    color: "#888888",
  },
  pendingBadge: {
    backgroundColor: "rgba(255,193,7,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadgeText: {
    fontSize: 11,
    color: "#FFC107",
    fontWeight: "600",
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
    color: "#888888",
    textAlign: "center",
  },
  svgContainer: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    overflow: "hidden",
  },
  gestureLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  canvasInner: {
    position: "relative",
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
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
    paddingHorizontal: 40,
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
    maxWidth: 400,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 12,
  },
  modalDetail: {
    fontSize: 14,
    color: "#EAEAEA",
    marginBottom: 4,
  },
  modalMeta: {
    fontSize: 12,
    color: "#888888",
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888888",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#111111",
    color: "#F5F5F5",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    fontSize: 15,
    marginBottom: 12,
  },
  chipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2A2A2A",
    marginRight: 8,
  },
  chipBtnActive: { backgroundColor: "#FF2A2A" },
  chipText: { color: "#EAEAEA", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },
  relRow: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#2A2A2A",
    marginBottom: 6,
  },
  relRowActive: { backgroundColor: "#FF2A2A" },
  relRowText: { color: "#EAEAEA", fontSize: 14 },
  relRowTextActive: { color: "#FFFFFF", fontWeight: "600" },
  relInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    marginBottom: 4,
  },
  relInfoText: { color: "#EAEAEA", fontSize: 13, flex: 1 },
  deleteRelText: {
    color: "#dc3545",
    fontSize: 16,
    fontWeight: "700",
    paddingLeft: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: "center",
  },
  modalActionBtnDanger: {
    backgroundColor: "#7F1D1D",
    borderColor: "rgba(239,68,68,0.35)",
  },
  modalActionBtnText: { color: "#FCA5A5", fontSize: 14, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statBox: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  statValue: { fontSize: 28, fontWeight: "800", color: "#FF2A2A" },
  statLabel: { fontSize: 12, color: "#888888", marginTop: 4 },
});

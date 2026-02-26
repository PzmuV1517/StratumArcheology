/**
 * @file
 * Wheeler Stratigraphic Diagram component for web.
 *
 * Renders a Wheeler Space–Time diagram as an interactive SVG
 * with sloping sequence boundaries, unconformity markers, and
 * cross-hatch hiatus zones — closely following Wheeler (1964).
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
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  useWheelerData,
  WheelerTrench,
  WheelerContextPlacement,
} from "../../hooks/useWheelerData";

/* ───────────────────────── Constants ───────────────────────── */

const CELL_W = 140;
const CELL_H = 60;
const AXIS_LABEL_W = 80;
const AXIS_LABEL_H = 36;
const TOOLBAR_H = 48;

/** Context type used for Wheeler grid cells. */
interface WheelerGridContext {
  id: string;
  type: string;
  description: string;
}

/** Color map for stratigraphic context types. */
const TYPE_COLORS: Record<string, string> = {
  layer: "#FF2A2A",
  deposit: "#ffc107",
  cut: "#dc3545",
  fill: "#28a745",
  structure: "#9c27b0",
};

/* ───────────────────────── Props ───────────────────────── */

interface WheelerDiagramProps {
  projectId: string;
  canEdit?: boolean;
}

/* ───────────────────────── CSS ───────────────────────── */

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  width: "100%",
  backgroundColor: "#111111",
  color: "#F5F5F5",
  fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
  overflow: "hidden",
  position: "relative",
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  padding: "8px 16px",
  backgroundColor: "#1A1A1A",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  flexShrink: 0,
  minHeight: TOOLBAR_H,
};

const buttonStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.15)",
  backgroundColor: "#222222",
  color: "#F5F5F5",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background-color 0.15s",
};

const accentButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: "#FF2A2A",
  borderColor: "#FF2A2A",
};

const svgContainerStyle: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  backgroundColor: "#0A0A0A",
};

const legendStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 16,
  padding: "8px 16px",
  backgroundColor: "#1A1A1A",
  borderTop: "1px solid rgba(255,255,255,0.1)",
  flexShrink: 0,
};

const legendItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "#EAEAEA",
};

const tooltipStyle: React.CSSProperties = {
  position: "fixed",
  padding: "8px 12px",
  backgroundColor: "#222222",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8,
  color: "#F5F5F5",
  fontSize: 12,
  pointerEvents: "none",
  zIndex: 1000,
  maxWidth: 240,
  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
};

const statusBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginLeft: "auto",
  fontSize: 12,
  color: "#888",
};

const emptyStateStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  gap: 16,
  color: "#888",
  fontSize: 14,
};

/* ── Modal/Overlay styles ── */

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: "#1A1A1A",
  border: "1px solid #2A2A2A",
  borderRadius: 12,
  padding: 24,
  minWidth: 360,
  maxWidth: 480,
  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #3A3A3A",
  backgroundColor: "#222222",
  color: "#F5F5F5",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#999",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

/* ───────────────── Help walkthrough styles ───────────────── */

const helpOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.75)",
  zIndex: 3000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const helpCardStyle: React.CSSProperties = {
  backgroundColor: "#1A1A1A",
  border: "1px solid #FF2A2A",
  borderRadius: 16,
  padding: 32,
  maxWidth: 520,
  width: "90%",
  boxShadow: "0 8px 40px rgba(255,42,42,0.15)",
};

/* ───────────────────────── Helpers ───────────────────────── */

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

/** Create placeholder data matching Wheeler (1964) style diagram. */
function createPlaceholderData(): {
  trenches: WheelerTrench[];
  placements: WheelerContextPlacement[];
  contexts: Map<string, WheelerGridContext>;
} {
  const trenches: WheelerTrench[] = [
    { id: "A", label: "Section A", order: 0 },
    { id: "B", label: "Section B", order: 1 },
    { id: "C", label: "Section C", order: 2 },
    { id: "K", label: "Sequence K", order: 3 },
  ];
  const placements: WheelerContextPlacement[] = [
    { contextId: "K1", trenchIds: ["K"], rowStart: 0, rowEnd: 0 },
    { contextId: "A1", trenchIds: ["A", "B"], rowStart: 1, rowEnd: 1 },
    { contextId: "K2", trenchIds: ["K"], rowStart: 1, rowEnd: 1 },
    { contextId: "A2", trenchIds: ["A", "B"], rowStart: 2, rowEnd: 2 },
    { contextId: "K3", trenchIds: ["K"], rowStart: 2, rowEnd: 2 },
    { contextId: "A3", trenchIds: ["A", "B", "C"], rowStart: 3, rowEnd: 3 },
    { contextId: "K4", trenchIds: ["K"], rowStart: 3, rowEnd: 3 },
    { contextId: "A4", trenchIds: ["B", "C"], rowStart: 4, rowEnd: 4 },
    { contextId: "K5", trenchIds: ["K"], rowStart: 4, rowEnd: 4 },
    { contextId: "A5", trenchIds: ["C"], rowStart: 5, rowEnd: 5 },
    { contextId: "K6", trenchIds: ["K"], rowStart: 5, rowEnd: 5 },
    { contextId: "B1", trenchIds: ["A", "B", "C", "K"], rowStart: 6, rowEnd: 6 },
    { contextId: "B2", trenchIds: ["A", "B"], rowStart: 7, rowEnd: 7 },
    { contextId: "K8", trenchIds: ["K"], rowStart: 7, rowEnd: 7 },
    { contextId: "B3", trenchIds: ["A"], rowStart: 8, rowEnd: 8 },
    { contextId: "K9", trenchIds: ["K"], rowStart: 8, rowEnd: 8 },
  ];
  const contexts = new Map<string, WheelerGridContext>([
    ["K1", { id: "K1", type: "layer", description: "Basal unit" }],
    ["A1", { id: "A1", type: "deposit", description: "Sequence A – Unit 1" }],
    ["K2", { id: "K2", type: "layer", description: "Continuity surface" }],
    ["A2", { id: "A2", type: "deposit", description: "Sequence A – Unit 2" }],
    ["K3", { id: "K3", type: "layer", description: "Continuity surface" }],
    ["A3", { id: "A3", type: "deposit", description: "Sequence A – Unit 3" }],
    ["K4", { id: "K4", type: "layer", description: "Continuity surface" }],
    ["A4", { id: "A4", type: "deposit", description: "Sequence A – Unit 4" }],
    ["K5", { id: "K5", type: "layer", description: "Continuity surface" }],
    ["A5", { id: "A5", type: "fill", description: "Sequence A – Unit 5" }],
    ["K6", { id: "K6", type: "layer", description: "Continuity surface" }],
    [
      "B1",
      {
        id: "B1",
        type: "structure",
        description: "Sequence B – Unit 1 (unconformity)",
      },
    ],
    ["B2", { id: "B2", type: "deposit", description: "Sequence B – Unit 2" }],
    ["K8", { id: "K8", type: "layer", description: "Continuity surface" }],
    ["B3", { id: "B3", type: "deposit", description: "Sequence B – Unit 3" }],
    ["K9", { id: "K9", type: "layer", description: "Continuity surface" }],
  ]);
  return { trenches, placements, contexts };
}

/* ────────────── Help walkthrough steps ────────────── */

interface HelpStep {
  title: string;
  description: string;
  icon: string;
  shortcut?: string;
}

const HELP_STEPS: HelpStep[] = [
  {
    title: "Add Trench",
    description:
      "Add a new trench/section column to the X-axis. Each trench represents a spatial position on the site. Click the '+ Trench' button in the toolbar.",
    icon: "📐",
    shortcut: "toolbar → + Trench",
  },
  {
    title: "Add Context",
    description:
      "Place a stratigraphic unit on the diagram. Assign it a context ID, choose its type (layer, deposit, cut, fill, structure), select which trenches it spans, and set the time-row range. Click '+ Context' in the toolbar.",
    icon: "🧱",
    shortcut: "toolbar → + Context",
  },
  {
    title: "Edit / Remove",
    description:
      "Hover over a filled cell and click to inspect it. Use the context menu (right-click or click the ✕ next to a trench label) to remove items.",
    icon: "✏️",
  },
  {
    title: "Auto-layout",
    description:
      "Automatically re-distributes all context placements into evenly-spaced rows. Useful after bulk edits.",
    icon: "📊",
    shortcut: "toolbar → Auto-layout",
  },
  {
    title: "Save",
    description:
      "Saves the current diagram state to the server. The button turns red when you have unsaved changes. Your work is versioned in Time Machine.",
    icon: "💾",
    shortcut: "toolbar → Save",
  },
  {
    title: "Understanding the Diagram",
    description:
      "The Wheeler diagram (Wheeler, 1964) plots time (Y-axis, oldest at bottom) against spatial position (X-axis, trenches). Filled cells show where a stratigraphic unit was deposited. Empty cross-hatched cells represent lacunae (hiatuses) — gaps in the stratigraphic record. Unconformity boundaries are shown as wavy lines between sequences.",
    icon: "📖",
  },
];

/* ───────────────────────── Component ───────────────────────── */

export const WheelerDiagram: React.FC<WheelerDiagramProps> = ({
  projectId,
  canEdit = true,
}) => {
  const {
    data,
    loading,
    error,
    dirty,
    save,
    addTrench,
    removeTrench,
    updatePlacement,
    removePlacement,
    setData,
  } = useWheelerData(projectId);

  // Local context metadata
  const [contexts, setContexts] = useState<Map<string, WheelerGridContext>>(
    () => new Map(),
  );

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    placement: WheelerContextPlacement;
  } | null>(null);

  // Modal states
  const [showTrenchModal, setShowTrenchModal] = useState(false);
  const [showContextModal, setShowContextModal] = useState(false);
  const [showHelpOverlay, setShowHelpOverlay] = useState(false);
  const [helpStepIdx, setHelpStepIdx] = useState(0);

  // Trench modal form
  const [trenchFormId, setTrenchFormId] = useState("");
  const [trenchFormLabel, setTrenchFormLabel] = useState("");
  const [trenchFormError, setTrenchFormError] = useState("");

  // Context modal form
  const [ctxFormId, setCtxFormId] = useState("");
  const [ctxFormType, setCtxFormType] = useState("layer");
  const [ctxFormDesc, setCtxFormDesc] = useState("");
  const [ctxFormTrenches, setCtxFormTrenches] = useState<string[]>([]);
  const [ctxFormRowStart, setCtxFormRowStart] = useState("0");
  const [ctxFormRowEnd, setCtxFormRowEnd] = useState("0");
  const [ctxFormError, setCtxFormError] = useState("");

  // Ref for scrollable SVG container
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Effective data
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

  /* ── Modal handlers ── */

  const openTrenchModal = useCallback(() => {
    setTrenchFormId("");
    setTrenchFormLabel("");
    setTrenchFormError("");
    setShowTrenchModal(true);
  }, []);

  const submitTrench = useCallback(() => {
    const id = trenchFormId.trim();
    const label = trenchFormLabel.trim() || id;
    if (!id) {
      setTrenchFormError("Trench ID is required.");
      return;
    }
    if (data.trenches.find((t) => t.id === id)) {
      setTrenchFormError(`Trench "${id}" already exists.`);
      return;
    }
    const maxOrder = data.trenches.reduce((max, t) => Math.max(max, t.order), -1);
    addTrench({ id, label, order: maxOrder + 1 });
    setShowTrenchModal(false);
  }, [trenchFormId, trenchFormLabel, data.trenches, addTrench]);

  const openContextModal = useCallback(() => {
    setCtxFormId("");
    setCtxFormType("layer");
    setCtxFormDesc("");
    setCtxFormTrenches([]);
    setCtxFormRowStart("0");
    setCtxFormRowEnd("0");
    setCtxFormError("");
    setShowContextModal(true);
  }, []);

  const submitContext = useCallback(() => {
    const id = ctxFormId.trim();
    if (!id) {
      setCtxFormError("Context ID is required.");
      return;
    }
    if (ctxFormTrenches.length === 0) {
      setCtxFormError("Select at least one trench.");
      return;
    }
    const rowStart = parseInt(ctxFormRowStart, 10);
    const rowEnd = parseInt(ctxFormRowEnd, 10);
    if (isNaN(rowStart) || isNaN(rowEnd) || rowStart < 0 || rowEnd < rowStart) {
      setCtxFormError("Invalid row range.");
      return;
    }
    updatePlacement({
      contextId: id,
      trenchIds: ctxFormTrenches,
      rowStart,
      rowEnd,
    });
    setContexts((prev) => {
      const next = new Map(prev);
      next.set(id, {
        id,
        type: ctxFormType,
        description: ctxFormDesc.trim(),
      });
      return next;
    });
    setShowContextModal(false);
  }, [
    ctxFormId,
    ctxFormType,
    ctxFormDesc,
    ctxFormTrenches,
    ctxFormRowStart,
    ctxFormRowEnd,
    updatePlacement,
  ]);

  const handleAutoLayout = useCallback(() => {
    if (data.placements.length === 0) return;
    const sorted = [...data.placements].sort((a, b) => a.rowStart - b.rowStart);
    const result = sorted.map((p, i) => ({
      ...p,
      rowStart: i,
      rowEnd: i,
    }));
    setData({ ...data, placements: result });
  }, [data, setData]);

  const handleSave = useCallback(async () => {
    await save();
  }, [save]);

  const handleCellHover = useCallback(
    (e: React.MouseEvent, placement: WheelerContextPlacement | null) => {
      if (!placement) {
        setTooltip(null);
        return;
      }
      setTooltip({
        x: e.clientX + 12,
        y: e.clientY - 8,
        placement,
      });
    },
    [],
  );

  const handleCellLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const getColor = useCallback(
    (contextId: string): string => {
      const ctx = effectiveContexts.get(contextId);
      return TYPE_COLORS[ctx?.type ?? "layer"] ?? TYPE_COLORS.layer;
    },
    [effectiveContexts],
  );

  /* ── Help walkthrough ── */

  const openHelp = useCallback(() => {
    setHelpStepIdx(0);
    setShowHelpOverlay(true);
  }, []);

  const nextHelpStep = useCallback(() => {
    if (helpStepIdx < HELP_STEPS.length - 1) {
      setHelpStepIdx((i) => i + 1);
    } else {
      setShowHelpOverlay(false);
    }
  }, [helpStepIdx]);

  const prevHelpStep = useCallback(() => {
    if (helpStepIdx > 0) setHelpStepIdx((i) => i - 1);
  }, [helpStepIdx]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowTrenchModal(false);
        setShowContextModal(false);
        setShowHelpOverlay(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /** Toggle a trench in the context form multi-select. */
  const toggleCtxTrench = useCallback((tid: string) => {
    setCtxFormTrenches((prev) =>
      prev.includes(tid) ? prev.filter((x) => x !== tid) : [...prev, tid],
    );
  }, []);

  /* ── Unconformity boundary detection ── */
  const unconformityRows = useMemo(() => {
    const result: number[] = [];
    for (let r = 1; r < totalRows - 1; r++) {
      const isEmpty = occupancy[r].every((c) => c === null);
      const hasBefore = occupancy[r - 1].some((c) => c !== null);
      const hasAfter = occupancy[r + 1]?.some((c) => c !== null);
      if (isEmpty && hasBefore && hasAfter) {
        result.push(r);
      }
    }
    return result;
  }, [occupancy, totalRows]);

  /* ──────────────────── Rendering ──────────────────── */

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={emptyStateStyle}>
          <span>Loading Wheeler data…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={emptyStateStyle}>
          <span style={{ color: "#dc3545" }}>Error: {error}</span>
        </div>
      </div>
    );
  }

  const helpStep = HELP_STEPS[helpStepIdx];

  return (
    <div style={containerStyle}>
      {/* ─── Toolbar ─── */}
      <div style={toolbarStyle}>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#F5F5F5" }}>
          Wheeler Diagram
        </span>
        {isPlaceholder && (
          <span
            style={{
              fontSize: 11,
              color: "#ffc107",
              backgroundColor: "rgba(255,193,7,0.12)",
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            Sample Data (Wheeler 1964)
          </span>
        )}
        {canEdit && (
          <>
            <button
              type="button"
              style={buttonStyle}
              onClick={openTrenchModal}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#333")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#222222")
              }
            >
              + Trench
            </button>
            <button
              type="button"
              style={buttonStyle}
              onClick={openContextModal}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#333")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#222222")
              }
            >
              + Context
            </button>
            <button
              type="button"
              style={buttonStyle}
              onClick={handleAutoLayout}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#333")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#222222")
              }
            >
              Auto-layout
            </button>
            <button
              type="button"
              style={dirty ? accentButtonStyle : buttonStyle}
              onClick={handleSave}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = dirty ? "#CC2222" : "#333")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = dirty
                  ? "#FF2A2A"
                  : "#222222")
              }
            >
              {dirty ? "● Save" : "Save"}
            </button>
          </>
        )}

        {/* Help button */}
        <button
          type="button"
          style={{
            ...buttonStyle,
            backgroundColor: "transparent",
            border: "1px solid #FF2A2A",
            color: "#FF2A2A",
            borderRadius: "50%",
            width: 32,
            height: 32,
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 700,
            marginLeft: 4,
          }}
          onClick={openHelp}
          title="How to use the Wheeler Diagram"
        >
          ?
        </button>

        <div style={statusBarStyle}>
          {dirty && <span style={{ color: "#ffc107" }}>Unsaved changes</span>}
          <span>
            {sortedTrenches.length} trenches · {effectivePlacements.length} contexts
            · {totalRows} rows
          </span>
        </div>
      </div>

      {/* ─── SVG Grid ─── */}
      <div style={svgContainerStyle} ref={svgContainerRef}>
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{ minWidth: svgWidth, minHeight: svgHeight }}
        >
          <defs>
            {/* Hiatus cross-hatch pattern */}
            <pattern
              id="hiatus-pattern"
              patternUnits="userSpaceOnUse"
              width={8}
              height={8}
            >
              <path
                d="M0,8 L8,0 M-2,2 L2,-2 M6,10 L10,6"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            </pattern>
            {/* Unconformity wavy pattern */}
            <pattern
              id="unconformity-pattern"
              patternUnits="userSpaceOnUse"
              width={24}
              height={8}
            >
              <path
                d="M0,4 Q6,0 12,4 T24,4"
                stroke="#ffc107"
                strokeWidth={2}
                fill="none"
                opacity={0.6}
              />
            </pattern>
          </defs>

          {/* X-axis labels (trench IDs) with optional delete button */}
          {sortedTrenches.map((trench, colIdx) => {
            const tx = AXIS_LABEL_W + colIdx * CELL_W + CELL_W / 2;
            return (
              <g key={`x-${trench.id}`}>
                <text
                  x={tx}
                  y={AXIS_LABEL_H / 2 + 4}
                  textAnchor="middle"
                  fill="#EAEAEA"
                  fontSize={12}
                  fontWeight={600}
                  fontFamily="'Inter', system-ui, sans-serif"
                >
                  {trench.label}
                </text>
                {canEdit && !isPlaceholder && (
                  <text
                    x={tx + CELL_W / 2 - 12}
                    y={AXIS_LABEL_H / 2 + 5}
                    textAnchor="middle"
                    fill="#666"
                    fontSize={11}
                    fontFamily="'Inter', system-ui, sans-serif"
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove trench "${trench.label}"? This will also remove it from all placements.`,
                        )
                      ) {
                        removeTrench(trench.id);
                      }
                    }}
                  >
                    ✕
                  </text>
                )}
              </g>
            );
          })}

          {/* Y-axis labels (time slices, oldest at bottom) */}
          {Array.from({ length: totalRows }, (_, rowIdx) => {
            const displayRow = totalRows - rowIdx;
            const yCenter = AXIS_LABEL_H + rowIdx * CELL_H + CELL_H / 2 + 4;
            return (
              <text
                key={`y-${rowIdx}`}
                x={AXIS_LABEL_W - 10}
                y={yCenter}
                textAnchor="end"
                fill="#888"
                fontSize={11}
                fontFamily="'Inter', system-ui, sans-serif"
              >
                t{displayRow}
              </text>
            );
          })}

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
                const ctx = effectiveContexts.get(placement.contextId);

                return (
                  <g
                    key={`cell-${rowIdx}-${colIdx}`}
                    onMouseMove={(e) => handleCellHover(e, placement)}
                    onMouseLeave={handleCellLeave}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      if (canEdit && !isPlaceholder) {
                        if (
                          window.confirm(`Remove context "${placement.contextId}"?`)
                        ) {
                          removePlacement(placement.contextId);
                        }
                      }
                    }}
                  >
                    <rect
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
                      <>
                        <text
                          x={x + CELL_W / 2}
                          y={y + CELL_H / 2 - 4}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize={13}
                          fontWeight={700}
                          fontFamily="'Inter', system-ui, sans-serif"
                        >
                          {placement.contextId}
                        </text>
                        {ctx && (
                          <text
                            x={x + CELL_W / 2}
                            y={y + CELL_H / 2 + 12}
                            textAnchor="middle"
                            fill="rgba(255,255,255,0.8)"
                            fontSize={10}
                            fontFamily="'Inter', system-ui, sans-serif"
                          >
                            {ctx.type}
                          </text>
                        )}
                      </>
                    )}
                  </g>
                );
              }

              return (
                <g key={`cell-${rowIdx}-${colIdx}`}>
                  <rect
                    x={x + 1}
                    y={y + 1}
                    width={CELL_W - 2}
                    height={CELL_H - 2}
                    rx={4}
                    fill="url(#hiatus-pattern)"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={1}
                  />
                </g>
              );
            }),
          )}

          {/* Unconformity wavy lines */}
          {unconformityRows.map((rowIdx) => {
            const y = AXIS_LABEL_H + rowIdx * CELL_H;
            const width = sortedTrenches.length * CELL_W;
            return (
              <g key={`unconf-${rowIdx}`}>
                <rect
                  x={AXIS_LABEL_W}
                  y={y}
                  width={width}
                  height={CELL_H}
                  fill="url(#unconformity-pattern)"
                  opacity={0.5}
                />
                <text
                  x={AXIS_LABEL_W + width / 2}
                  y={y + CELL_H / 2 + 4}
                  textAnchor="middle"
                  fill="#ffc107"
                  fontSize={10}
                  fontWeight={600}
                  fontFamily="'Inter', system-ui, sans-serif"
                  opacity={0.8}
                >
                  Unconformity
                </text>
              </g>
            );
          })}

          {/* Grid outline */}
          <rect
            x={AXIS_LABEL_W}
            y={AXIS_LABEL_H}
            width={sortedTrenches.length * CELL_W}
            height={totalRows * CELL_H}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
            rx={4}
          />

          {/* Y-axis title */}
          <text
            x={14}
            y={AXIS_LABEL_H + (totalRows * CELL_H) / 2}
            textAnchor="middle"
            fill="#888"
            fontSize={11}
            fontWeight={600}
            fontFamily="'Inter', system-ui, sans-serif"
            transform={`rotate(-90, 14, ${AXIS_LABEL_H + (totalRows * CELL_H) / 2})`}
          >
            Time →
          </text>
        </svg>
      </div>

      {/* ─── Legend ─── */}
      <div style={legendStyle}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#888",
            marginRight: 4,
          }}
        >
          Legend:
        </span>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={legendItemStyle}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                backgroundColor: color,
              }}
            />
            <span>{type}</span>
          </div>
        ))}
        <div style={legendItemStyle}>
          <svg width={12} height={12}>
            <defs>
              <pattern
                id="legend-hiatus"
                patternUnits="userSpaceOnUse"
                width={6}
                height={6}
              >
                <path
                  d="M0,6 L6,0 M-1,1 L1,-1 M5,7 L7,5"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth={1}
                />
              </pattern>
            </defs>
            <rect
              width={12}
              height={12}
              rx={2}
              fill="url(#legend-hiatus)"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={0.5}
            />
          </svg>
          <span>hiatus / lacuna</span>
        </div>
        <div style={legendItemStyle}>
          <svg width={24} height={12}>
            <path
              d="M0,6 Q6,2 12,6 T24,6"
              stroke="#ffc107"
              strokeWidth={2}
              fill="none"
              opacity={0.7}
            />
          </svg>
          <span>unconformity</span>
        </div>
      </div>

      {/* ─── Tooltip ─── */}
      {tooltip && (
        <div style={{ ...tooltipStyle, left: tooltip.x, top: tooltip.y }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {tooltip.placement.contextId}
          </div>
          {effectiveContexts.get(tooltip.placement.contextId) && (
            <>
              <div style={{ color: "#EAEAEA", marginBottom: 2 }}>
                Type: {effectiveContexts.get(tooltip.placement.contextId)?.type}
              </div>
              <div style={{ color: "#EAEAEA" }}>
                {effectiveContexts.get(tooltip.placement.contextId)?.description}
              </div>
            </>
          )}
          <div style={{ color: "#888", marginTop: 4, fontSize: 11 }}>
            Trenches: {tooltip.placement.trenchIds.join(", ")} · Rows t
            {totalRows - tooltip.placement.rowStart}–t
            {totalRows - tooltip.placement.rowEnd}
          </div>
        </div>
      )}

      {/* ─── Add Trench Modal ─── */}
      {showTrenchModal && (
        <div
          style={modalOverlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTrenchModal(false);
          }}
        >
          <div style={modalContentStyle}>
            <h3
              style={{
                margin: "0 0 16px",
                fontSize: 18,
                fontWeight: 700,
                color: "#F5F5F5",
              }}
            >
              Add Trench / Section
            </h3>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Trench ID *</label>
              <input
                style={inputStyle}
                placeholder="e.g. T5, North Section"
                value={trenchFormId}
                onChange={(e) => {
                  setTrenchFormId(e.target.value);
                  setTrenchFormError("");
                }}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && submitTrench()}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Display Label (optional)</label>
              <input
                style={inputStyle}
                placeholder="Leave blank to use ID"
                value={trenchFormLabel}
                onChange={(e) => setTrenchFormLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitTrench()}
              />
            </div>

            {trenchFormError && (
              <div
                style={{
                  color: "#dc3545",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {trenchFormError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => setShowTrenchModal(false)}
              >
                Cancel
              </button>
              <button type="button" style={accentButtonStyle} onClick={submitTrench}>
                Add Trench
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Context Modal ─── */}
      {showContextModal && (
        <div
          style={modalOverlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowContextModal(false);
          }}
        >
          <div style={modalContentStyle}>
            <h3
              style={{
                margin: "0 0 16px",
                fontSize: 18,
                fontWeight: 700,
                color: "#F5F5F5",
              }}
            >
              Add / Edit Context Placement
            </h3>

            {/* Context ID */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Context ID *</label>
              <input
                style={inputStyle}
                placeholder="e.g. SU-007, A3"
                value={ctxFormId}
                onChange={(e) => {
                  setCtxFormId(e.target.value);
                  setCtxFormError("");
                }}
                autoFocus
              />
            </div>

            {/* Type */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Type</label>
              <select
                style={selectStyle}
                value={ctxFormType}
                onChange={(e) => setCtxFormType(e.target.value)}
              >
                {Object.keys(TYPE_COLORS).map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Description</label>
              <input
                style={inputStyle}
                placeholder="Brief description of the context"
                value={ctxFormDesc}
                onChange={(e) => setCtxFormDesc(e.target.value)}
              />
            </div>

            {/* Trench selection */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Trenches *</label>
              {data.trenches.length === 0 ? (
                <div style={{ color: "#888", fontSize: 13 }}>
                  No trenches yet. Add trenches first.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {data.trenches.map((t) => {
                    const selected = ctxFormTrenches.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        style={{
                          padding: "4px 12px",
                          borderRadius: 16,
                          border: selected
                            ? "1px solid #FF2A2A"
                            : "1px solid #3A3A3A",
                          backgroundColor: selected ? "rgba(255,42,42,0.2)" : "#222",
                          color: selected ? "#FF2A2A" : "#999",
                          fontSize: 13,
                          cursor: "pointer",
                          fontWeight: selected ? 600 : 400,
                        }}
                        onClick={() => toggleCtxTrench(t.id)}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Row range */}
            <div
              style={{
                display: "flex",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Row Start (0 = oldest)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  value={ctxFormRowStart}
                  onChange={(e) => setCtxFormRowStart(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Row End (inclusive)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  value={ctxFormRowEnd}
                  onChange={(e) => setCtxFormRowEnd(e.target.value)}
                />
              </div>
            </div>

            {ctxFormError && (
              <div
                style={{
                  color: "#dc3545",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {ctxFormError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => setShowContextModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={accentButtonStyle}
                onClick={submitContext}
              >
                Add Context
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Help Walkthrough Overlay ─── */}
      {showHelpOverlay && helpStep && (
        <div
          style={helpOverlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHelpOverlay(false);
          }}
        >
          <div style={helpCardStyle}>
            {/* Step indicator */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 20,
              }}
            >
              {HELP_STEPS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === helpStepIdx ? 24 : 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor:
                      i === helpStepIdx ? "#FF2A2A" : "rgba(255,255,255,0.2)",
                    transition: "all 0.2s",
                  }}
                />
              ))}
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: "#666",
                }}
              >
                {helpStepIdx + 1} / {HELP_STEPS.length}
              </span>
            </div>

            {/* Content */}
            <div
              style={{
                fontSize: 40,
                marginBottom: 12,
              }}
            >
              {helpStep.icon}
            </div>
            <h3
              style={{
                margin: "0 0 8px",
                fontSize: 20,
                fontWeight: 700,
                color: "#F5F5F5",
              }}
            >
              {helpStep.title}
            </h3>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: 14,
                lineHeight: 1.6,
                color: "#BDBDBD",
              }}
            >
              {helpStep.description}
            </p>
            {helpStep.shortcut && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "rgba(255,42,42,0.1)",
                  border: "1px solid rgba(255,42,42,0.3)",
                  borderRadius: 6,
                  padding: "4px 12px",
                  marginBottom: 20,
                }}
              >
                <span style={{ fontSize: 12, color: "#FF2A2A" }}>→</span>
                <span
                  style={{
                    fontSize: 13,
                    color: "#FF2A2A",
                    fontWeight: 600,
                    fontFamily: "'SF Mono', monospace",
                  }}
                >
                  {helpStep.shortcut}
                </span>
              </div>
            )}

            {/* Nav buttons */}
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              <button
                type="button"
                style={{
                  ...buttonStyle,
                  opacity: helpStepIdx === 0 ? 0.4 : 1,
                }}
                onClick={prevHelpStep}
                disabled={helpStepIdx === 0}
              >
                ← Previous
              </button>
              <button type="button" style={accentButtonStyle} onClick={nextHelpStep}>
                {helpStepIdx === HELP_STEPS.length - 1 ? "Got it!" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WheelerDiagram;

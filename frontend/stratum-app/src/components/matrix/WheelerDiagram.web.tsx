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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  WheelerLacuna,
} from "../../hooks/useWheelerData";
import { WheelerPublicationView } from "./WheelerPublicationView.web";

/* ───────────────── Micro-icons (inline SVG) ───────────────── */

const IconEdit = () => (
  <svg
    width={12}
    height={12}
    viewBox="0 0 12 12"
    fill="none"
    style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
  >
    <path
      d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M7 3L9 5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const IconVisual = () => (
  <svg
    width={13}
    height={12}
    viewBox="0 0 13 12"
    fill="none"
    style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
  >
    <rect
      x="1"
      y="6"
      width="2.5"
      height="5"
      rx="0.4"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    <rect
      x="5"
      y="3.5"
      width="2.5"
      height="7.5"
      rx="0.4"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    <rect
      x="9"
      y="1"
      width="2.5"
      height="10"
      rx="0.4"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
);

const IconDoc = () => (
  <svg
    width={11}
    height={13}
    viewBox="0 0 11 13"
    fill="none"
    style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
  >
    <path
      d="M1.5 1H7L9.5 3.5V12H1.5V1Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M6.5 1V4H9.5" stroke="currentColor" strokeWidth="1.2" />
    <path
      d="M3.5 6H7M3.5 8.5H6"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const IconFlask = () => (
  // disabled for now since the demo button was removed for presentation
  // can re-enable if we add the demo button back or we could use it
  // for an export function in the future
  <svg
    width={11}
    height={13}
    viewBox="0 0 11 13"
    fill="none"
    style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
  >
    <path
      d="M3.5 1V5L1 10.5C0.7 11.2 1.2 12 2 12H9C9.8 12 10.3 11.2 10 10.5L7.5 5V1"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M2.5 1H8.5"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    <circle cx="4" cy="9" r="0.9" fill="currentColor" opacity="0.5" />
    <circle cx="6.5" cy="8" r="0.7" fill="currentColor" opacity="0.4" />
  </svg>
);

const IconDownload = () => (
  <svg
    width={12}
    height={13}
    viewBox="0 0 12 13"
    fill="none"
    style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
  >
    <path
      d="M6 1V9M3.5 6.5L6 9L8.5 6.5"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M1 11.5H11"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const IconGrid = () => (
  <svg
    width={38}
    height={38}
    viewBox="0 0 38 38"
    fill="none"
    style={{ display: "block", opacity: 0.25 }}
  >
    <rect
      x="2"
      y="2"
      width="15"
      height="15"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="21"
      y="2"
      width="15"
      height="15"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="2"
      y="21"
      width="15"
      height="15"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="21"
      y="21"
      width="15"
      height="15"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const IconRuler = () => (
  <svg
    width={38}
    height={38}
    viewBox="0 0 38 38"
    fill="none"
    style={{ display: "block", opacity: 0.25 }}
  >
    <rect
      x="4"
      y="14"
      width="30"
      height="10"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
      transform="rotate(-45 19 19)"
    />
    <path
      d="M10 28L14 24M15 24L19 20M20 20L24 16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/* ───────────────────────── Constants ───────────────────────── */

const CELL_W = 140;
const CELL_H = 60;
const AXIS_LABEL_W = 80;
const AXIS_LABEL_H = 36;
const TOOLBAR_H = 48;

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
  minHeight: 0,
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

/* ────────────── Help walkthrough steps ────────────── */

interface HelpStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  shortcut?: string;
}

/* Larger help-overlay icons (32px) */
const HelpIconRuler = () => (
  <svg
    width={32}
    height={32}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" />
    <path d="M8 8h2M8 12h2M8 16h2M15 8h1M15 12h1M15 16h1" />
  </svg>
);
const HelpIconLayers = () => (
  <svg
    width={32}
    height={32}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2L2 7l10 5 10-5-10-5Z" />
    <path d="M2 12l10 5 10-5" />
    <path d="M2 17l10 5 10-5" />
  </svg>
);
const HelpIconPencil = () => (
  <svg
    width={32}
    height={32}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);
const HelpIconBarChart = () => (
  <svg
    width={32}
    height={32}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 3v18h18" />
    <path d="M7 16V10M11 16V4M15 16V8M19 16V12" />
  </svg>
);
const HelpIconSave = () => (
  <svg
    width={32}
    height={32}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </svg>
);
const HelpIconBook = () => (
  <svg
    width={32}
    height={32}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
  </svg>
);

const HELP_STEPS: HelpStep[] = [
  {
    title: "Add a Trench",
    description:
      "Trenches (or sections) form the X-axis — each one is a spatial position on your site. Hit '+ Trench' in the toolbar, give it an ID and an optional display label, then press Add.",
    icon: <HelpIconRuler />,
    shortcut: "toolbar → + Trench",
  },
  {
    title: "Add a Context",
    description:
      "A context is a single stratigraphic unit (e.g. SU-007). Set its type (layer, deposit, cut, fill, structure), write a short description and any longer field notes, pick which trenches it spans, and set the time-row range (row 0 = oldest).",
    icon: <HelpIconLayers />,
    shortcut: "toolbar → + Context",
  },
  {
    title: "Edit or Delete a Context",
    description:
      "Click any filled cell in Edit mode to re-open its form — change the type, description, notes, trench span, or row range. Use the Delete button inside the form to remove it entirely.",
    icon: <HelpIconPencil />,
  },
  {
    title: "Mark a Lacuna",
    description:
      "A lacuna is a missing interval within a sequence — rock that was never deposited, eroded away, or not excavated. It renders as a cross-hatched amber zone. Use '+ Lacuna' and define the affected trenches and row range.",
    icon: <HelpIconBarChart />,
    shortcut: "toolbar → + Lacuna",
  },
  {
    title: "Save, Pull & Discard",
    description:
      "'Save' pushes your local changes to the server (button turns red when unsaved). 'Pull' fetches the latest server version — use it any time to sync. 'Discard' throws away all unsaved local changes and reloads from the last saved version.",
    icon: <HelpIconSave />,
    shortcut: "toolbar → Save / Pull / Discard",
  },
  {
    title: "Reading the Diagram",
    description:
      "The Wheeler diagram (Wheeler, 1964) plots time on the Y-axis (oldest at bottom) against spatial position on the X-axis. Filled cells show deposited units; empty hatched cells are hiatuses. Diagonal edges with arrows show migration between trenches. The Publication view exports a print-quality B&W SVG including context descriptions.",
    icon: <HelpIconBook />,
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
    version,
    hasServerChanges,
    load,
    save,
    addTrench,
    removeTrench,
    updatePlacement,
    removePlacement,
    setData,
    checkForUpdates,
    pull,
    renderUrl,
    renderVersion,
    addLacuna,
    removeLacuna,
  } = useWheelerData(projectId);

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
  const [ctxEditMode, setCtxEditMode] = useState(false);
  const [ctxFormType, setCtxFormType] = useState("layer");
  const [ctxFormDesc, setCtxFormDesc] = useState("");
  const [ctxFormNotes, setCtxFormNotes] = useState("");
  const [ctxFormTrenches, setCtxFormTrenches] = useState<string[]>([]);
  const [ctxFormRowStart, setCtxFormRowStart] = useState("0");
  const [ctxFormRowEnd, setCtxFormRowEnd] = useState("0");
  const [ctxFormError, setCtxFormError] = useState("");

  // Lacuna modal state
  const [showLacunaModal, setShowLacunaModal] = useState(false);
  const [lacunaFormTrenches, setLacunaFormTrenches] = useState<string[]>([]);
  const [lacunaFormRowStart, setLacunaFormRowStart] = useState("0");
  const [lacunaFormRowEnd, setLacunaFormRowEnd] = useState("0");
  const [lacunaFormLabel, setLacunaFormLabel] = useState("");
  const [lacunaFormError, setLacunaFormError] = useState("");

  // Ref for scrollable SVG container
  const svgContainerRef = useRef<HTMLDivElement>(null);
  // Ref for hidden CSV import file input
  const importInputRef = useRef<HTMLInputElement>(null);

  // View mode toggle: edit (grid) vs visual (Wheeler diagram)
  const [viewMode, setViewMode] = useState<"edit" | "visual" | "publication">(
    "edit",
  );

  // Conflict resolution modal
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Mode switcher expand-on-hover
  const [modeSwitcherOpen, setModeSwitcherOpen] = useState(false);

  // Collapse the edit toolbar buttons
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);

  // Check for server updates on mount
  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  const totalRows = useMemo(() => {
    if (data.placements.length === 0) return 6;
    return Math.max(...data.placements.map((p) => p.rowEnd)) + 1;
  }, [data.placements]);

  const sortedTrenches = useMemo(
    () => [...data.trenches].sort((a, b) => a.order - b.order),
    [data.trenches],
  );

  const occupancy = useMemo(
    () => buildOccupancy(sortedTrenches, data.placements, totalRows),
    [sortedTrenches, data.placements, totalRows],
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

  const openContextModal = useCallback((existing?: WheelerContextPlacement) => {
    setCtxEditMode(!!existing);
    setCtxFormId(existing?.contextId ?? "");
    setCtxFormType(existing?.type ?? "layer");
    setCtxFormDesc(existing?.description ?? "");
    setCtxFormNotes(existing?.notes ?? "");
    setCtxFormTrenches(existing?.trenchIds ?? []);
    setCtxFormRowStart(String(existing?.rowStart ?? 0));
    setCtxFormRowEnd(String(existing?.rowEnd ?? 0));
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
      type: ctxFormType,
      description: ctxFormDesc.trim() || undefined,
      notes: ctxFormNotes.trim() || undefined,
    });
    setShowContextModal(false);
  }, [
    ctxFormId,
    ctxFormType,
    ctxFormDesc,
    ctxFormNotes,
    ctxFormTrenches,
    ctxFormRowStart,
    ctxFormRowEnd,
    updatePlacement,
  ]);

  const openLacunaModal = useCallback(() => {
    setLacunaFormTrenches([]);
    setLacunaFormRowStart("0");
    setLacunaFormRowEnd("0");
    setLacunaFormLabel("");
    setLacunaFormError("");
    setShowLacunaModal(true);
  }, []);

  const submitLacuna = useCallback(() => {
    if (lacunaFormTrenches.length === 0) {
      setLacunaFormError("Select at least one trench.");
      return;
    }
    const rowStart = parseInt(lacunaFormRowStart, 10);
    const rowEnd = parseInt(lacunaFormRowEnd, 10);
    if (isNaN(rowStart) || isNaN(rowEnd) || rowStart < 0 || rowEnd < rowStart) {
      setLacunaFormError("Invalid row range — rowEnd must be ≥ rowStart.");
      return;
    }
    addLacuna({
      id: `lac-${Date.now()}`,
      trenchIds: lacunaFormTrenches,
      rowStart,
      rowEnd,
      label: lacunaFormLabel.trim() || undefined,
    });
    setShowLacunaModal(false);
  }, [
    lacunaFormTrenches,
    lacunaFormRowStart,
    lacunaFormRowEnd,
    lacunaFormLabel,
    addLacuna,
  ]);

  // ── Debug helper: fill diagram with realistic sample data ──────────────
  // eslint disabled for this function since its just a dev helper
  // NOTE: delete this in production
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleLoadDemo = useCallback(() => {
    const demoTrenches = [
      { id: "T1", label: "Trench I", order: 0 },
      { id: "T2", label: "Trench II", order: 1 },
      { id: "T3", label: "Trench III", order: 2 },
      { id: "T4", label: "Trench IV", order: 3 },
    ];
    const demoPlacements = [
      // t1 – natural subsoil spans all trenches
      {
        contextId: "SU-101",
        trenchIds: ["T1", "T2", "T3", "T4"],
        rowStart: 0,
        rowEnd: 0,
      },
      // t2 – early alluvial deposit, partial
      { contextId: "SU-102", trenchIds: ["T1", "T2", "T3"], rowStart: 1, rowEnd: 1 },
      { contextId: "SU-103", trenchIds: ["T4"], rowStart: 1, rowEnd: 1 },
      // t3 – deposition continues then retreats left (vacuity on right)
      { contextId: "SU-104", trenchIds: ["T1", "T2"], rowStart: 2, rowEnd: 2 },
      { contextId: "SU-105", trenchIds: ["T3"], rowStart: 2, rowEnd: 3 },
      // t4 – hiatus gap (rows 3 has only T3, row 4 is truly empty → hiatus)
      // t5 – re-occupation after hiatus
      { contextId: "SU-106", trenchIds: ["T2", "T3", "T4"], rowStart: 5, rowEnd: 5 },
      { contextId: "SU-107", trenchIds: ["T1"], rowStart: 5, rowEnd: 6 },
      // t6-t7 – structure period
      { contextId: "SU-108", trenchIds: ["T2", "T3"], rowStart: 6, rowEnd: 7 },
      { contextId: "SU-109", trenchIds: ["T4"], rowStart: 6, rowEnd: 6 },
      // t8 – latest layer
      {
        contextId: "SU-110",
        trenchIds: ["T1", "T2", "T3", "T4"],
        rowStart: 8,
        rowEnd: 8,
      },
    ];
    const demoMeta: Record<string, { type: string; description: string }> = {
      "SU-101": { type: "layer", description: "Natural subsoil" },
      "SU-102": { type: "deposit", description: "Alluvial deposit" },
      "SU-103": { type: "deposit", description: "Localised silting" },
      "SU-104": { type: "fill", description: "Mixed fill" },
      "SU-105": { type: "structure", description: "Wall foundation" },
      "SU-106": { type: "layer", description: "Post-hiatus re-occupation" },
      "SU-107": { type: "cut", description: "Robber trench" },
      "SU-108": { type: "structure", description: "Masonry course" },
      "SU-109": { type: "fill", description: "Construction backfill" },
      "SU-110": { type: "layer", description: "Topsoil (modern)" },
    };
    const enriched = demoPlacements.map((p) => ({ ...p, ...demoMeta[p.contextId] }));
    setData({ trenches: demoTrenches, placements: enriched });
  }, [setData]);

  const handleSave = useCallback(async () => {
    await save();
  }, [save]);

  // ── CSV Export ────────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    const esc = (s: string) =>
      s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;

    const lines: string[] = [];

    // Trenches section
    lines.push("SECTION,TRENCHES");
    lines.push("id,label,order");
    for (const t of data.trenches) {
      lines.push([esc(t.id), esc(t.label), String(t.order)].join(","));
    }

    // Placements section
    lines.push("");
    lines.push("SECTION,PLACEMENTS");
    lines.push("contextId,trenchIds,rowStart,rowEnd,type,description,notes");
    for (const p of data.placements) {
      lines.push(
        [
          esc(p.contextId),
          esc(p.trenchIds.join("|"))  ,
          String(p.rowStart),
          String(p.rowEnd),
          esc(p.type ?? ""),
          esc(p.description ?? ""),
          esc(p.notes ?? ""),
        ].join(","),
      );
    }

    // Lacunae section
    lines.push("");
    lines.push("SECTION,LACUNAE");
    lines.push("id,trenchIds,rowStart,rowEnd,label");
    for (const l of data.lacunae ?? []) {
      lines.push(
        [
          esc(l.id),
          esc(l.trenchIds.join("|"))  ,
          String(l.rowStart),
          String(l.rowEnd),
          esc(l.label ?? ""),
        ].join(","),
      );
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wheeler-diagram.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  // ── CSV Import ────────────────────────────────────────────────────────────
  const handleImportCSV = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset so the same file can be re-imported
      e.target.value = "";

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string;
          const rawLines = text.split(/\r?\n/);

          // Minimal CSV parser that handles "quoted,fields"
          const parseRow = (line: string): string[] => {
            const cells: string[] = [];
            let cur = "";
            let inQ = false;
            for (let i = 0; i < line.length; i++) {
              const ch = line[i];
              if (inQ) {
                if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
                else if (ch === '"')                    { inQ = false; }
                else                                    { cur += ch; }
              } else {
                if      (ch === '"') { inQ = true; }
                else if (ch === ",") { cells.push(cur); cur = ""; }
                else                 { cur += ch; }
              }
            }
            cells.push(cur);
            return cells;
          };

          type Section = "none" | "TRENCHES" | "PLACEMENTS" | "LACUNAE";
          let section: Section = "none";
          let skipHeader = false;

          const trenches: typeof data.trenches = [];
          const placements: typeof data.placements = [];
          const lacunae: NonNullable<typeof data.lacunae> = [];

          for (const raw of rawLines) {
            const line = raw.trim();
            if (!line) continue;

            if (line.startsWith("SECTION,")) {
              section = line.split(",")[1] as Section;
              skipHeader = true;
              continue;
            }
            if (skipHeader) { skipHeader = false; continue; }

            const cells = parseRow(line);

            if (section === "TRENCHES") {
              const [id, label, order] = cells;
              if (id) trenches.push({ id, label: label ?? id, order: Number(order ?? 0) });
            } else if (section === "PLACEMENTS") {
              const [contextId, trenchIdsRaw, rowStart, rowEnd, type, description, notes] = cells;
              if (contextId) {
                placements.push({
                  contextId,
                  trenchIds: (trenchIdsRaw ?? "").split("|").filter(Boolean),
                  rowStart: Number(rowStart ?? 0),
                  rowEnd:   Number(rowEnd   ?? 0),
                  type:        type        || undefined,
                  description: description || undefined,
                  notes:       notes       || undefined,
                });
              }
            } else if (section === "LACUNAE") {
              const [id, trenchIdsRaw, rowStart, rowEnd, label] = cells;
              if (id) {
                lacunae.push({
                  id,
                  trenchIds: (trenchIdsRaw ?? "").split("|").filter(Boolean),
                  rowStart: Number(rowStart ?? 0),
                  rowEnd:   Number(rowEnd   ?? 0),
                  label: label || undefined,
                });
              }
            }
          }

          setData({ trenches, placements, lacunae });
        } catch {
          alert("Failed to parse CSV — make sure it was exported from this app.");
        }
      };
      reader.readAsText(file);
    },
    [setData],
  );

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
      const placement = data.placements.find((p) => p.contextId === contextId);
      return TYPE_COLORS[placement?.type ?? "layer"] ?? TYPE_COLORS.layer;
    },
    [data.placements],
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

  /* ──────────── Visual Mode: Wheeler 1964-style Renderer ──────────── */

  const renderVisualView = () => {
    const cols = sortedTrenches.length;
    if (cols === 0) return null;

    // Layout constants — the diagram spans a continuous coordinate space
    const PAD_L = 100; // left margin for Y-axis labels
    const PAD_R = 60;
    const PAD_T = 56; // top margin for X-axis labels
    const PAD_B = 50;
    // Each trench column = a proportional slice of B (horizontal distance)
    const COL_W = 160;
    const graphW = cols * COL_W;
    // Each row = a proportional time slice
    const ROW_H = 70;
    const graphH = totalRows * ROW_H;
    const totalW = PAD_L + graphW + PAD_R;
    const totalH = PAD_T + graphH + PAD_B;

    // Helpers: map (col, row) to SVG coordinates
    // row 0 = oldest → bottom; row N-1 = youngest → top (inverted Y)
    const xOf = (col: number) => PAD_L + col * COL_W;
    const yOf = (row: number) => PAD_T + (totalRows - 1 - row) * ROW_H;

    /* ── Build row extents: per-row leftmost/rightmost occupied column ── */
    interface RowExtent {
      left: number;
      right: number;
    }
    const rowExts: RowExtent[] = [];
    for (let r = 0; r < totalRows; r++) {
      let left = -1;
      let right = -1;
      for (let c = 0; c < cols; c++) {
        if (occupancy[r][c] !== null) {
          if (left === -1) left = c;
          right = c;
        }
      }
      rowExts.push({ left, right });
    }

    /* ── Group contiguous occupied rows into "sequences" ──
     * A sequence is a run of rows where at least one column is occupied,
     * separated by empty rows (hiatuses). */
    interface Sequence {
      rowStart: number; // oldest row (inclusive)
      rowEnd: number; // youngest row (inclusive)
      extents: RowExtent[]; // per-row left/right within this sequence
    }
    const sequences: Sequence[] = [];
    let seqStart = -1;
    for (let r = 0; r < totalRows; r++) {
      if (rowExts[r].left >= 0) {
        if (seqStart < 0) seqStart = r;
      } else if (seqStart >= 0) {
        sequences.push({
          rowStart: seqStart,
          rowEnd: r - 1,
          extents: rowExts.slice(seqStart, r),
        });
        seqStart = -1;
      }
    }
    if (seqStart >= 0) {
      sequences.push({
        rowStart: seqStart,
        rowEnd: totalRows - 1,
        extents: rowExts.slice(seqStart, totalRows),
      });
    }

    /* ── Build a closed polygon for each sequence ──
     * Walk left boundary bottom→top, then right boundary top→bottom.
     * Where the extent changes between rows, the boundary is DIAGONAL
     * (the characteristic Wheeler sloping line). */
    const buildSequencePolygon = (seq: Sequence): string => {
      const pts: string[] = [];
      // Left boundary: bottom to top
      for (let i = 0; i < seq.extents.length; i++) {
        const r = seq.rowStart + i;
        const ext = seq.extents[i];
        const x = xOf(ext.left);
        // bottom edge of this row
        pts.push(`${x},${yOf(r) + ROW_H}`);
        // top edge of this row (if different from next row's bottom)
        pts.push(`${x},${yOf(r)}`);
      }
      // Right boundary: top to bottom
      for (let i = seq.extents.length - 1; i >= 0; i--) {
        const r = seq.rowStart + i;
        const ext = seq.extents[i];
        const x = xOf(ext.right + 1);
        pts.push(`${x},${yOf(r)}`);
        pts.push(`${x},${yOf(r) + ROW_H}`);
      }
      return pts.join(" ");
    };

    /* ── Identify hiatus rows (empty rows between sequences) ── */
    const hiatusRanges: { start: number; end: number }[] = [];
    for (let i = 0; i < sequences.length - 1; i++) {
      const gapStart = sequences[i].rowEnd + 1;
      const gapEnd = sequences[i + 1].rowStart - 1;
      if (gapStart <= gapEnd) {
        hiatusRanges.push({ start: gapStart, end: gapEnd });
      }
    }

    /* ── Degradation vacuity: within a sequence, areas where deposition
     * stopped laterally (left side contracts upward). We detect this
     * when leftExtent increases going up, forming a triangular void. ── */
    interface VacuityPoly {
      points: string;
      seqIdx: number;
    }
    const vacuityPolys: VacuityPoly[] = [];
    sequences.forEach((seq, si) => {
      for (let i = 1; i < seq.extents.length; i++) {
        const prev = seq.extents[i - 1];
        const curr = seq.extents[i];
        const rPrev = seq.rowStart + i - 1;
        const rCurr = seq.rowStart + i;
        // Left vacuity: deposition retreated from left
        if (curr.left > prev.left) {
          const pts = [
            `${xOf(prev.left)},${yOf(rPrev)}`,
            `${xOf(curr.left)},${yOf(rCurr)}`,
            `${xOf(curr.left)},${yOf(rCurr) + ROW_H}`,
            `${xOf(prev.left)},${yOf(rPrev)}`,
          ].join(" ");
          vacuityPolys.push({ points: pts, seqIdx: si });
        }
        // Right vacuity: deposition retreated from right
        if (curr.right < prev.right) {
          const pts = [
            `${xOf(prev.right + 1)},${yOf(rPrev)}`,
            `${xOf(curr.right + 1)},${yOf(rCurr)}`,
            `${xOf(curr.right + 1)},${yOf(rCurr) + ROW_H}`,
            `${xOf(prev.right + 1)},${yOf(rPrev)}`,
          ].join(" ");
          vacuityPolys.push({ points: pts, seqIdx: si });
        }
      }
    });

    /* ── Collect diagonal boundary line segments ── */
    interface BoundaryLine {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      dashed?: boolean;
    }
    const boundaryLines: BoundaryLine[] = [];
    sequences.forEach((seq) => {
      for (let i = 1; i < seq.extents.length; i++) {
        const prev = seq.extents[i - 1];
        const curr = seq.extents[i];
        const rPrev = seq.rowStart + i - 1;
        const rCurr = seq.rowStart + i;
        if (curr.left !== prev.left) {
          boundaryLines.push({
            x1: xOf(prev.left),
            y1: yOf(rPrev),
            x2: xOf(curr.left),
            y2: yOf(rCurr),
          });
        }
        if (curr.right !== prev.right) {
          boundaryLines.push({
            x1: xOf(prev.right + 1),
            y1: yOf(rPrev),
            x2: xOf(curr.right + 1),
            y2: yOf(rCurr),
          });
        }
      }
    });

    // Sequence colors (cycle through Stratum palette)
    const SEQ_COLORS = [
      "rgba(255,42,42,0.35)",
      "rgba(42,130,255,0.35)",
      "rgba(42,255,130,0.30)",
      "rgba(200,130,255,0.30)",
      "rgba(255,200,42,0.30)",
    ];

    return (
      <svg
        width={totalW}
        height={totalH}
        style={{ minWidth: totalW, minHeight: totalH }}
      >
        <defs>
          {/* Cross-hatch for degradation vacuity */}
          <pattern
            id="w-vacuity-hatch"
            patternUnits="userSpaceOnUse"
            width={8}
            height={8}
            patternTransform="rotate(45)"
          >
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={8}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={1}
            />
          </pattern>
          {/* Diagonal hatch for lacuna/hiatus areas */}
          <pattern
            id="w-hiatus-hatch"
            patternUnits="userSpaceOnUse"
            width={10}
            height={10}
          >
            <path
              d="M0,10 L10,0 M-2,2 L2,-2 M8,12 L12,8"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          </pattern>
          {/* Horizontal lines for lacuna zones */}
          <pattern
            id="w-lacuna-hatch"
            patternUnits="userSpaceOnUse"
            width={1}
            height={7}
          >
            <line
              x1={0}
              y1={0}
              x2={1}
              y2={0}
              stroke="rgba(255,180,50,0.30)"
              strokeWidth={1}
            />
          </pattern>
          {/* Arrowhead for migration direction on boundary diagonals */}
          <marker
            id="w-arrow"
            markerWidth={8}
            markerHeight={6}
            refX={7}
            refY={3}
            orient="auto"
          >
            <path d="M0,0 L8,3 L0,6 Z" fill="#FF2A2A" opacity={0.75} />
          </marker>
          <marker
            id="w-arrow-rev"
            markerWidth={8}
            markerHeight={6}
            refX={1}
            refY={3}
            orient="auto-start-reverse"
          >
            <path d="M8,0 L0,3 L8,6 Z" fill="#FF2A2A" opacity={0.75} />
          </marker>
        </defs>

        {/* ── Background ── */}
        <rect x={PAD_L} y={PAD_T} width={graphW} height={graphH} fill="#0A0A0A" />

        {/* Subtle horizontal time-lines */}
        {Array.from({ length: totalRows + 1 }, (_, r) => (
          <line
            key={`tl-${r}`}
            x1={PAD_L}
            y1={PAD_T + r * ROW_H}
            x2={PAD_L + graphW}
            y2={PAD_T + r * ROW_H}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={0.5}
            strokeDasharray="4,6"
          />
        ))}

        {/* ── Sequence polygons (filled deposit areas) ── */}
        {sequences.map((seq, si) => (
          <polygon
            key={`seq-${si}`}
            points={buildSequencePolygon(seq)}
            fill={SEQ_COLORS[si % SEQ_COLORS.length]}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1}
          />
        ))}

        {/* ── Hiatus zones ── */}
        {hiatusRanges.map((h, hi) => {
          const y1 = yOf(h.end);
          const y2 = yOf(h.start) + ROW_H;
          return (
            <g key={`hz-${hi}`}>
              <rect
                x={PAD_L}
                y={y1}
                width={graphW}
                height={y2 - y1}
                fill="url(#w-hiatus-hatch)"
              />
              <line
                x1={PAD_L}
                y1={y1}
                x2={PAD_L + graphW}
                y2={y1}
                stroke="#ffc107"
                strokeWidth={1.5}
                strokeDasharray="8,4"
                opacity={0.5}
              />
              <line
                x1={PAD_L}
                y1={y2}
                x2={PAD_L + graphW}
                y2={y2}
                stroke="#ffc107"
                strokeWidth={1.5}
                strokeDasharray="8,4"
                opacity={0.5}
              />
              <text
                x={PAD_L + 20}
                y={(y1 + y2) / 2 + 4}
                fill="#ffc107"
                fontSize={12}
                fontWeight={700}
                fontFamily="'Inter', system-ui, sans-serif"
                opacity={0.8}
                letterSpacing={2}
              >
                HIATUS
              </text>
              <text
                x={PAD_L + 20}
                y={(y1 + y2) / 2 + 18}
                fill="#ffc107"
                fontSize={9}
                fontFamily="'Inter', system-ui, sans-serif"
                opacity={0.5}
              >
                (Nondeposition-erosion cyclic phase)
              </text>
            </g>
          );
        })}

        {/* ── Degradation vacuity cross-hatch ── */}
        {vacuityPolys.map((vp, vi) => (
          <g key={`vac-${vi}`}>
            <polygon points={vp.points} fill="url(#w-vacuity-hatch)" stroke="none" />
            {/* Dashed outline for the vacuity */}
            <polygon
              points={vp.points}
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          </g>
        ))}

        {/* ── Diagonal boundary lines with migration arrows ── */}
        {boundaryLines.map((bl, i) => (
          <line
            key={`bl-${i}`}
            x1={bl.x1}
            y1={bl.y1}
            x2={bl.x2}
            y2={bl.y2}
            stroke="#FF2A2A"
            strokeWidth={2}
            opacity={0.7}
            markerEnd="url(#w-arrow)"
          />
        ))}

        {/* ── Context labels inside the deposit areas ── */}
        {data.placements.map((p) => {
          const indices = p.trenchIds
            .map((tid) => sortedTrenches.findIndex((t) => t.id === tid))
            .filter((i) => i >= 0)
            .sort((a, b) => a - b);
          if (indices.length === 0) return null;
          const leftCol = indices[0];
          const rightCol = indices[indices.length - 1];
          const cx = (xOf(leftCol) + xOf(rightCol + 1)) / 2;
          const cy = (yOf(p.rowEnd) + yOf(p.rowStart) + ROW_H) / 2;
          return (
            <g
              key={`cl-${p.contextId}`}
              onMouseMove={(e) => handleCellHover(e, p)}
              onMouseLeave={handleCellLeave}
              style={{ cursor: "pointer" }}
              onClick={() => canEdit && openContextModal(p)}
            >
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                fill="#F5F5F5"
                fontSize={13}
                fontWeight={700}
                fontFamily="'Inter', system-ui, sans-serif"
              >
                {p.contextId}
              </text>
              {p.type && (
                <text
                  x={cx}
                  y={cy + 14}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.5)"
                  fontSize={9}
                  fontFamily="'Inter', system-ui, sans-serif"
                >
                  {p.type}
                </text>
              )}
            </g>
          );
        })}

        {/* ── Sequence labels ── */}
        {sequences.map((seq, si) => {
          // Place label near the widest row of the sequence
          let widest = 0;
          let widestRow = 0;
          seq.extents.forEach((ext, i) => {
            const w = ext.right - ext.left;
            if (w > widest) {
              widest = w;
              widestRow = i;
            }
          });
          const r = seq.rowStart + widestRow;
          const ext = seq.extents[widestRow];
          const cx = (xOf(ext.left) + xOf(ext.right + 1)) / 2;
          const cy = yOf(r) + ROW_H / 2;
          return (
            <g key={`sl-${si}`}>
              <text
                x={cx}
                y={cy + 28}
                textAnchor="middle"
                fill="rgba(255,255,255,0.25)"
                fontSize={10}
                fontWeight={600}
                fontFamily="'Inter', system-ui, sans-serif"
                letterSpacing={1.5}
              >
                SEQUENCE {String.fromCharCode(65 + si)}
              </text>
            </g>
          );
        })}

        {/* ── Lacuna zones (data-driven missing intervals) ── */}
        {(data.lacunae ?? []).map((lac) => {
          const colIndices = lac.trenchIds
            .map((tid) => sortedTrenches.findIndex((t) => t.id === tid))
            .filter((ci) => ci >= 0)
            .sort((a, b) => a - b);
          if (colIndices.length === 0) return null;
          const leftCol = colIndices[0];
          const rightCol = colIndices[colIndices.length - 1];
          const x = xOf(leftCol);
          const w = xOf(rightCol + 1) - x;
          const y = yOf(lac.rowEnd);
          const h = yOf(lac.rowStart) + ROW_H - y;
          const lbl = lac.label ?? "LACUNA";
          return (
            <g key={`lac-${lac.id}`}>
              {/* Hatched fill */}
              <rect x={x} y={y} width={w} height={h} fill="url(#w-lacuna-hatch)" />
              {/* Amber dashed outline */}
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill="none"
                stroke="#ffc107"
                strokeWidth={1.5}
                strokeDasharray="6,3"
                opacity={0.7}
              />
              {/* Label */}
              <text
                x={x + w / 2}
                y={y + h / 2 + 4}
                textAnchor="middle"
                fill="#ffc107"
                fontSize={10}
                fontWeight={700}
                fontFamily="'Inter', system-ui, sans-serif"
                letterSpacing={1.5}
                opacity={0.85}
              >
                {lbl}
              </text>
              <text
                x={x + w / 2}
                y={y + h / 2 + 16}
                textAnchor="middle"
                fill="rgba(255,193,7,0.45)"
                fontSize={8}
                fontFamily="'Inter', system-ui, sans-serif"
              >
                (missing interval)
              </text>
              {/* Remove button in edit mode */}
              {canEdit && (
                <text
                  x={x + w - 6}
                  y={y + 12}
                  textAnchor="end"
                  fill="rgba(255,255,255,0.25)"
                  fontSize={10}
                  style={{ cursor: "pointer" }}
                  onClick={() => removeLacuna(lac.id)}
                >
                  ✕
                </text>
              )}
            </g>
          );
        })}

        {/* ── X-axis: section/trench labels ── */}
        {sortedTrenches.map((trench, i) => (
          <g key={`xl-${trench.id}`}>
            <text
              x={xOf(i) + COL_W / 2}
              y={PAD_T - 18}
              textAnchor="middle"
              fill="#EAEAEA"
              fontSize={13}
              fontWeight={600}
              fontFamily="'Inter', system-ui, sans-serif"
            >
              {trench.label}
            </text>
            <line
              x1={xOf(i) + COL_W / 2}
              y1={PAD_T - 10}
              x2={xOf(i) + COL_W / 2}
              y2={PAD_T}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
            />
          </g>
        ))}

        {/* ── Y-axis: time labels ── */}
        {Array.from({ length: totalRows }, (_, r) => (
          <g key={`yl-${r}`}>
            <text
              x={PAD_L - 16}
              y={yOf(r) + ROW_H / 2 + 4}
              textAnchor="end"
              fill="#888"
              fontSize={11}
              fontFamily="'Inter', system-ui, sans-serif"
            >
              t{r + 1}
            </text>
            <line
              x1={PAD_L - 6}
              y1={yOf(r) + ROW_H / 2}
              x2={PAD_L}
              y2={yOf(r) + ROW_H / 2}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
            />
          </g>
        ))}

        {/* ── Axis titles ── */}
        <text
          x={20}
          y={PAD_T + graphH / 2}
          textAnchor="middle"
          fill="#666"
          fontSize={11}
          fontWeight={600}
          fontFamily="'Inter', system-ui, sans-serif"
          transform={`rotate(-90, 20, ${PAD_T + graphH / 2})`}
        >
          Time →
        </text>
        <text
          x={PAD_L + graphW / 2}
          y={totalH - 12}
          textAnchor="middle"
          fill="#666"
          fontSize={11}
          fontWeight={600}
          fontFamily="'Inter', system-ui, sans-serif"
        >
          B (Horizontal Distance)
        </text>

        {/* ── Graph border ── */}
        <rect
          x={PAD_L}
          y={PAD_T}
          width={graphW}
          height={graphH}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
        />
      </svg>
    );
  };

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
        <span
          style={{ fontWeight: 700, fontSize: 14, color: "#F5F5F5", marginRight: 4 }}
        >
          Wheeler Diagram
        </span>

        {/* ─── View mode tabs (hover-to-expand animated pill) ─── */}
        {(() => {
          const PILL_W = 108;
          const PILL_PAD = 3;
          const modes = ["edit", "visual", "publication"] as const;
          const modeIdx = modes.indexOf(viewMode);
          const trackOffset = modeSwitcherOpen ? 0 : -(modeIdx * PILL_W);
          const wrapperW = modeSwitcherOpen
            ? modes.length * PILL_W + PILL_PAD * 2
            : PILL_W + PILL_PAD * 2;
          return (
            <div
              onMouseEnter={() => setModeSwitcherOpen(true)}
              onMouseLeave={() => setModeSwitcherOpen(false)}
              style={{
                position: "relative",
                flexShrink: 0,
                borderRadius: 8,
                backgroundColor: "#111",
                overflow: "hidden",
                width: wrapperW,
                transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
                padding: PILL_PAD,
              }}
            >
              {/* Sliding active indicator */}
              <div
                style={{
                  position: "absolute",
                  top: PILL_PAD,
                  left: modeSwitcherOpen ? PILL_PAD + modeIdx * PILL_W : PILL_PAD,
                  width: PILL_W,
                  height: `calc(100% - ${PILL_PAD * 2}px)`,
                  backgroundColor: "#FF2A2A",
                  borderRadius: 6,
                  transition: "left 0.2s cubic-bezier(0.4,0,0.2,1)",
                  pointerEvents: "none",
                }}
              />
              {/* Track */}
              <div
                style={{
                  display: "flex",
                  transform: `translateX(${trackOffset}px)`,
                  transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
                }}
              >
                {modes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    style={{
                      width: PILL_W,
                      flexShrink: 0,
                      padding: "5px 0",
                      background: "transparent",
                      border: "none",
                      borderRadius: 6,
                      color: viewMode === mode ? "#fff" : "#aaa",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      position: "relative",
                      transition: "color 0.15s",
                    }}
                  >
                    {mode === "edit" && (
                      <>
                        <IconEdit /> Edit
                      </>
                    )}
                    {mode === "visual" && (
                      <>
                        <IconVisual /> Visual
                      </>
                    )}
                    {mode === "publication" && (
                      <>
                        <IconDoc /> Publication
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ─── Spacer: fills space between mode switcher and action buttons ─── */}
        <div
          style={{
            flex: 1,
            minWidth: 16,
            display: "flex",
            alignItems: "center",
            paddingLeft: 12,
            overflow: "hidden",
          }}
        >
          {dirty && (
            <span
              style={{
                fontSize: 11,
                color: "#666",
                whiteSpace: "nowrap",
                userSelect: "none",
              }}
            >
              ● unsaved
            </span>
          )}
        </div>

        {/* Collapse / expand the edit toolbar */}
        {canEdit && viewMode === "edit" && (
          <button
            type="button"
            onClick={() => setToolbarCollapsed((c) => !c)}
            title={
              toolbarCollapsed ? "Show toolbar buttons" : "Hide toolbar buttons"
            }
            style={{
              ...buttonStyle,
              width: 26,
              height: 26,
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
              flexShrink: 0,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{
                transform: toolbarCollapsed ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
                display: "block",
              }}
            >
              <polyline
                points="4,2 9,6 4,10"
                stroke="#888"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
        )}

        {canEdit && viewMode === "edit" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              overflow: "hidden",
              maxWidth: toolbarCollapsed ? 0 : 1000,
              opacity: toolbarCollapsed ? 0 : 1,
              transition:
                "max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s cubic-bezier(0.4,0,0.2,1)",
              flexShrink: 0,
            }}
          >
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
              onClick={() => openContextModal()}
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
              onClick={openLacunaModal}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#333")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#222222")
              }
              title="Mark a missing interval (lacuna) within a sequence"
            >
              + Lacuna
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
            <button
              type="button"
              style={{
                ...buttonStyle,
                ...(hasServerChanges
                  ? {
                      backgroundColor: "#1a6b3c",
                      border: "1px solid #2ecc71",
                      color: "#fff",
                    }
                  : {}),
              }}
              onClick={() => {
                if (dirty) {
                  setShowConflictModal(true);
                } else {
                  pull();
                }
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = hasServerChanges
                  ? "#15552f"
                  : "#333")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = hasServerChanges
                  ? "#1a6b3c"
                  : "#222222")
              }
              title={
                hasServerChanges
                  ? "Server has a newer version — click to pull"
                  : "Pull latest from server"
              }
            >
              <IconDownload /> Pull
            </button>
            {dirty && (
              <button
                type="button"
                style={{
                  ...buttonStyle,
                  color: "#aaa",
                  borderColor: "rgba(255,255,255,0.1)",
                }}
                onClick={() => {
                  if (
                    window.confirm(
                      "Discard all unsaved changes and reload from server?",
                    )
                  ) {
                    load();
                  }
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#2a2a2a")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#222222")
                }
                title="Throw away unsaved changes and reload from server"
              >
                Discard
              </button>
            )}

            {/* ── CSV divider ── */}
            <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

            {/* Export CSV */}
            <button
              type="button"
              style={buttonStyle}
              onClick={handleExportCSV}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#333")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#222222")}
              title="Export diagram as CSV"
            >
              ↓ CSV
            </button>

            {/* Import CSV */}
            <button
              type="button"
              style={buttonStyle}
              onClick={() => importInputRef.current?.click()}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#333")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#222222")}
              title="Import diagram from CSV (replaces current data)"
            >
              ↑ CSV
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={handleImportCSV}
            />
          </div>
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
          {hasServerChanges && (
            <span style={{ color: "#2ecc71" }}>⬇ Server update available</span>
          )}
          {!dirty && !hasServerChanges && (
            <span style={{ color: "#4caf50" }}>✓ Up to date</span>
          )}
          <span>
            {sortedTrenches.length} trenches · {data.placements.length} contexts ·{" "}
            {(data.lacunae ?? []).length > 0 && `${data.lacunae!.length} lacunae · `}
            {totalRows} rows · v{version}
          </span>
        </div>
      </div>

      {/* ─── Diagram Content ─── */}
      {viewMode === "publication" ? (
        <WheelerPublicationView
          renderUrl={renderUrl}
          renderVersion={renderVersion}
          currentVersion={version}
          dirty={dirty}
        />
      ) : viewMode === "visual" ? (
        <div style={svgContainerStyle} ref={svgContainerRef}>
          {data.trenches.length === 0 ? (
            <div style={emptyStateStyle}>
              <IconVisual />
              <span>No data to visualize yet</span>
              <span style={{ fontSize: 12, color: "#666" }}>
                Switch to Edit mode and add trenches &amp; contexts first
              </span>
            </div>
          ) : (
            renderVisualView()
          )}
        </div>
      ) : data.trenches.length === 0 ? (
        <div style={{ ...emptyStateStyle, flex: 1, minHeight: 0 }}>
          <IconRuler />
          <span>Add a trench to get started</span>
          <span style={{ fontSize: 12, color: "#666" }}>
            Use the + Trench button above, then add contexts
          </span>
        </div>
      ) : (
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
                  {canEdit && (
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
              const displayRow = rowIdx + 1;
              const yCenter =
                AXIS_LABEL_H + (totalRows - 1 - rowIdx) * CELL_H + CELL_H / 2 + 4;
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
                const y = AXIS_LABEL_H + (totalRows - 1 - rowIdx) * CELL_H;

                if (placement) {
                  const isTopLeftCol =
                    colIdx === 0 ||
                    !placement.trenchIds.includes(
                      sortedTrenches[colIdx - 1]?.id ?? "",
                    );
                  const isTopRow = rowIdx === placement.rowEnd;

                  const color = getColor(placement.contextId);

                  return (
                    <g
                      key={`cell-${rowIdx}-${colIdx}`}
                      onMouseMove={(e) => handleCellHover(e, placement)}
                      onMouseLeave={handleCellLeave}
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        if (canEdit) {
                          openContextModal(placement);
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
                          {placement.type && (
                            <text
                              x={x + CELL_W / 2}
                              y={y + CELL_H / 2 + 12}
                              textAnchor="middle"
                              fill="rgba(255,255,255,0.8)"
                              fontSize={10}
                              fontFamily="'Inter', system-ui, sans-serif"
                            >
                              {placement.type}
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
              const y = AXIS_LABEL_H + (totalRows - 1 - rowIdx) * CELL_H;
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
      )}

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
          {(tooltip.placement.type || tooltip.placement.description) && (
            <>
              {tooltip.placement.type && (
                <div style={{ color: "#EAEAEA", marginBottom: 2 }}>
                  Type: {tooltip.placement.type}
                </div>
              )}
              {tooltip.placement.description && (
                <div
                  style={{
                    color: "#EAEAEA",
                    marginBottom: tooltip.placement.notes ? 2 : 0,
                  }}
                >
                  {tooltip.placement.description}
                </div>
              )}
              {tooltip.placement.notes && (
                <div style={{ color: "#aaa", fontStyle: "italic", fontSize: 11 }}>
                  {tooltip.placement.notes}
                </div>
              )}
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
              {ctxEditMode ? "Edit Context" : "Add Context"}
            </h3>

            {/* Context ID */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Context ID *</label>
              <input
                style={{ ...inputStyle, opacity: ctxEditMode ? 0.6 : 1 }}
                placeholder="e.g. SU-007, A3"
                value={ctxFormId}
                readOnly={ctxEditMode}
                onChange={(e) => {
                  if (!ctxEditMode) {
                    setCtxFormId(e.target.value);
                    setCtxFormError("");
                  }
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

            {/* Notes */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Notes</label>
              <textarea
                style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                placeholder="Longer field notes, observations, finds…"
                value={ctxFormNotes}
                onChange={(e) => setCtxFormNotes(e.target.value)}
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
              {ctxEditMode && (
                <button
                  type="button"
                  style={{
                    ...buttonStyle,
                    color: "#dc3545",
                    borderColor: "#dc3545",
                  }}
                  onClick={() => {
                    removePlacement(ctxFormId);
                    setShowContextModal(false);
                  }}
                >
                  Delete
                </button>
              )}
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
                {ctxEditMode ? "Save Changes" : "Add Context"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Lacuna Modal ─── */}
      {showLacunaModal && (
        <div
          style={modalOverlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLacunaModal(false);
          }}
        >
          <div style={modalContentStyle}>
            <h3
              style={{
                margin: "0 0 4px",
                fontSize: 18,
                fontWeight: 700,
                color: "#ffc107",
              }}
            >
              Add Lacuna
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#888" }}>
              A lacuna marks a missing interval <em>within</em> a sequence — where
              the record is absent (not excavated / eroded). It appears as a hatched
              amber zone in the diagram.
            </p>

            {/* Trench selection */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Trenches *</label>
              {data.trenches.length === 0 ? (
                <div style={{ color: "#888", fontSize: 13 }}>No trenches yet.</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {data.trenches.map((t) => {
                    const selected = lacunaFormTrenches.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        style={{
                          padding: "4px 12px",
                          borderRadius: 16,
                          border: selected
                            ? "1px solid #ffc107"
                            : "1px solid #3A3A3A",
                          backgroundColor: selected ? "rgba(255,193,7,0.2)" : "#222",
                          color: selected ? "#ffc107" : "#999",
                          fontSize: 13,
                          cursor: "pointer",
                          fontWeight: selected ? 600 : 400,
                        }}
                        onClick={() =>
                          setLacunaFormTrenches((prev) =>
                            prev.includes(t.id)
                              ? prev.filter((id) => id !== t.id)
                              : [...prev, t.id],
                          )
                        }
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Row range */}
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Row Start (0 = oldest)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  value={lacunaFormRowStart}
                  onChange={(e) => setLacunaFormRowStart(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Row End (inclusive)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  value={lacunaFormRowEnd}
                  onChange={(e) => setLacunaFormRowEnd(e.target.value)}
                />
              </div>
            </div>

            {/* Optional label */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Label (optional)</label>
              <input
                style={inputStyle}
                placeholder='Defaults to "LACUNA"'
                value={lacunaFormLabel}
                onChange={(e) => setLacunaFormLabel(e.target.value)}
              />
            </div>

            {lacunaFormError && (
              <div style={{ color: "#dc3545", fontSize: 13, marginBottom: 12 }}>
                {lacunaFormError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => setShowLacunaModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  ...accentButtonStyle,
                  backgroundColor: "#b8860b",
                  borderColor: "#ffc107",
                }}
                onClick={submitLacuna}
              >
                Add Lacuna
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Conflict Resolution Modal ─── */}
      {showConflictModal && (
        <div
          style={modalOverlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConflictModal(false);
          }}
        >
          <div style={modalContentStyle}>
            <h3 style={{ margin: "0 0 8px", color: "#FF2A2A" }}>⚠ Sync Conflict</h3>
            <p style={{ margin: "0 0 12px", color: "#ccc", fontSize: 13 }}>
              You have unsaved local changes, but the server also has a newer
              version. You can choose what to do below. If you're unsure, it's
              usually best to pull the server version. Either way, both versions will
              be saved in the Time Machine so you can review them later.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {/* Option 1: Keep local changes and push */}
              <button
                type="button"
                style={{
                  ...accentButtonStyle,
                  textAlign: "left",
                  padding: "10px 14px",
                }}
                onClick={async () => {
                  setShowConflictModal(false);
                  await save();
                }}
              >
                <strong>Keep Local &amp; Push</strong>
                <br />
                <span style={{ fontSize: 11, opacity: 0.8 }}>
                  Overwrite the server with your local changes
                </span>
              </button>

              {/* Option 2: Pull server changes */}
              <button
                type="button"
                style={{
                  ...buttonStyle,
                  textAlign: "left",
                  padding: "10px 14px",
                  backgroundColor: "#1a6b3c",
                  border: "1px solid #2ecc71",
                }}
                onClick={async () => {
                  setShowConflictModal(false);
                  await pull();
                }}
              >
                <strong>Discard Local &amp; Pull</strong>
                <br />
                <span style={{ fontSize: 11, opacity: 0.8 }}>
                  Replace your local data with the server version
                </span>
              </button>
            </div>

            <button
              type="button"
              style={{ ...buttonStyle, width: "100%" }}
              onClick={() => setShowConflictModal(false)}
            >
              Cancel
            </button>
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

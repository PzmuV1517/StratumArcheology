/**
 * @file
 * Harris Matrix editor, web.
 *
 * Laid out as a working tool rather than a picture: the lists on the left are
 * the record, the diagram on the right is derived from it. Every problem the
 * graph finds is shown in full instead of being reduced to a red outline,
 * because an unreadable sequence has to be fixed in the trench, not guessed
 * at.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "react-native";

import { toCsv, toPrintPages, toSvg, toText } from "./core/exportMatrix";
import { DEFAULT_LAYOUT, layoutGraph, polylinePoints } from "./core/layout";
import { listPhases, phaseColor, RELATION_VERBS, UNIT_TYPES } from "./core/model";
import type { RelationVerb, UnitType } from "./core/model";
import { useMatrix } from "./core/useMatrix";
import type { UseMatrixResult } from "./core/useMatrix";

interface HarrisMatrixProps {
  projectId: string;
  canEdit?: boolean;
}

type Tab = "units" | "relations" | "groups" | "problems" | "data";

interface Palette {
  bg: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  line: string;
  error: string;
  warn: string;
  accent: string;
}

export const HarrisMatrix: React.FC<HarrisMatrixProps> = ({
  projectId,
  canEdit = true,
}) => {
  const dark = (useColorScheme() ?? "light") === "dark";
  const matrix = useMatrix(projectId, canEdit);
  const [tab, setTab] = useState<Tab>("units");
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const [drag, setDrag] = useState<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const layout = useMemo(
    () => layoutGraph(matrix.graph, DEFAULT_LAYOUT, matrix.doc),
    [matrix.graph, matrix.doc],
  );

  const c: Palette = useMemo(
    () => ({
      bg: dark ? "#111111" : "#F6F6F6",
      panel: dark ? "#0A0A0A" : "#FFFFFF",
      border: dark ? "#2A2A2A" : "#D9D9D9",
      text: dark ? "#EDEDED" : "#111111",
      muted: dark ? "#9A9A9A" : "#666666",
      line: dark ? "#EDEDED" : "#111111",
      error: dark ? "#FF6B6B" : "#C0392B",
      warn: dark ? "#E0A458" : "#9A6700",
      accent: dark ? "#3A3A3A" : "#E8E8E8",
    }),
    [dark],
  );

  const errors = matrix.graph.problems.filter((p) => p.severity === "error");
  const warnings = matrix.graph.problems.filter((p) => p.severity === "warning");
  const matches = useMemo(() => matrix.search(query), [matrix, query]);
  const phases = useMemo(() => listPhases(matrix.doc), [matrix.doc]);

  const { undo, redo, canUndo, canRedo } = matrix;

  // Ctrl/Cmd+Z is what anyone editing a record expects, and the field crew
  // reaches for it before they find a button.
  useEffect(() => {
    if (!canEdit) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") {
        return;
      }
      const target = event.target as HTMLElement | null;
      // Let the browser undo typing inside a field.
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit, undo, redo]);

  const download = useCallback(
    (contents: string, filename: string, mime: string) => {
      const blob = new Blob([contents], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
    [],
  );

  const fitToPane = useCallback(() => {
    const pane = scrollRef.current;
    if (!pane || layout.width <= 0 || layout.height <= 0) return;
    const scale = Math.min(
      Math.max(1, pane.clientWidth - 32) / layout.width,
      Math.max(1, pane.clientHeight - 32) / layout.height,
    );
    setZoom(Math.min(3, Math.max(0.25, scale)));
  }, [layout.width, layout.height]);

  const title = matrix.doc.title?.trim() || "Harris Matrix";

  const print = useCallback(() => {
    const pages = toPrintPages(layout, title);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      `<!doctype html><html><head><title>${title}</title><style>` +
        `@page { size: A4 portrait; margin: 10mm; }` +
        `body { margin: 0; }` +
        `.sheet { page-break-after: always; }` +
        `.sheet:last-child { page-break-after: auto; }` +
        `svg { width: 100%; height: auto; }` +
        `</style></head><body>` +
        pages.map((page) => `<div class="sheet">${page}</div>`).join("") +
        `</body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  }, [layout, title]);

  // Drag uses SVG user units so a node lands where the pointer is at any zoom.
  const pointerToSvg = useCallback(
    (event: React.PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const scaleX = rect.width === 0 ? 1 : layout.width / rect.width;
      const scaleY = rect.height === 0 ? 1 : layout.height / rect.height;
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    },
    [layout.width, layout.height],
  );

  if (matrix.loading) {
    return (
      <div style={{ padding: 24, color: c.text, background: c.bg, height: "100%" }}>
        Loading matrix...
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    background: c.panel,
    color: c.text,
    border: `1px solid ${c.border}`,
    borderRadius: 4,
    padding: "6px 8px",
    font: "inherit",
    width: "100%",
    boxSizing: "border-box",
  };

  const buttonStyle: React.CSSProperties = {
    background: c.accent,
    color: c.text,
    border: `1px solid ${c.border}`,
    borderRadius: 4,
    padding: "6px 10px",
    font: "inherit",
    cursor: "pointer",
  };

  const disabledButton: React.CSSProperties = {
    ...buttonStyle,
    opacity: 0.45,
    cursor: "default",
  };

  const panelProps = { matrix, canEdit, colors: c, inputStyle, buttonStyle };

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        boxSizing: "border-box",
        background: c.bg,
        color: c.text,
        font: "14px/1.4 system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          flex: "0 0 340px",
          borderRight: `1px solid ${c.border}`,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: c.panel,
        }}
      >
        <div style={{ padding: 8, borderBottom: `1px solid ${c.border}` }}>
          <input
            style={inputStyle}
            placeholder="Search context, phase or description"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search units"
          />
          {query.trim().length > 0 && (
            <div style={{ marginTop: 6, maxHeight: 160, overflowY: "auto" }}>
              {matches.length === 0 && (
                <div style={{ color: c.muted }}>No unit matches.</div>
              )}
              {matches.slice(0, 25).map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => {
                    setSelected(unit.id);
                    setTab("units");
                  }}
                  style={{
                    ...buttonStyle,
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    marginBottom: 4,
                    background: selected === unit.id ? c.accent : "transparent",
                  }}
                >
                  <strong>{unit.label}</strong>{" "}
                  <span style={{ color: c.muted }}>{unit.type}</span>
                  {unit.phase ? (
                    <span style={{ color: c.muted }}> - {unit.phase}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", borderBottom: `1px solid ${c.border}` }}>
          {(["units", "relations", "groups", "problems", "data"] as Tab[]).map(
            (name) => (
              <button
                key={name}
                onClick={() => setTab(name)}
                style={{
                  flex: 1,
                  padding: "10px 2px",
                  background: tab === name ? c.accent : "transparent",
                  color: c.text,
                  border: "none",
                  borderBottom:
                    tab === name ? `2px solid ${c.text}` : "2px solid transparent",
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 13,
                  textTransform: "capitalize",
                }}
              >
                {name}
                {name === "problems" && errors.length > 0
                  ? ` (${errors.length})`
                  : ""}
              </button>
            ),
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 12, minHeight: 0 }}>
          {tab === "units" && (
            <UnitsPanel
              {...panelProps}
              selected={selected}
              onSelect={setSelected}
              phases={phases}
            />
          )}
          {tab === "relations" && <RelationsPanel {...panelProps} />}
          {tab === "groups" && <GroupsPanel {...panelProps} phases={phases} />}
          {tab === "problems" && (
            <div>
              {errors.length === 0 && warnings.length === 0 && (
                <p style={{ color: c.muted }}>
                  No contradictions. Every recorded relationship fits one sequence.
                </p>
              )}
              {[...errors, ...warnings].map((problem, index) => (
                <div
                  key={index}
                  style={{
                    borderLeft: `3px solid ${
                      problem.severity === "error" ? c.error : c.warn
                    }`,
                    padding: "6px 8px",
                    marginBottom: 8,
                  }}
                >
                  <strong
                    style={{
                      color: problem.severity === "error" ? c.error : c.warn,
                    }}
                  >
                    {problem.severity === "error" ? "Must fix" : "Note"}
                  </strong>
                  <div>{problem.message}</div>
                </div>
              ))}
            </div>
          )}
          {tab === "data" && (
            <DataPanel
              {...panelProps}
              layout={layout}
              title={title}
              download={download}
              onPrint={print}
            />
          )}
        </div>

        <div
          style={{
            borderTop: `1px solid ${c.border}`,
            padding: "8px 12px",
            color: c.muted,
            fontSize: 12,
          }}
        >
          {statusLine(matrix.saveState, matrix.offline, canEdit)}
        </div>
      </div>

      {/*
        minWidth/minHeight 0 are load bearing. A flex item defaults to
        min-width:auto, so a diagram wider than the window refuses to shrink
        and pushes the whole editor past the right edge instead of scrolling
        inside its own pane.
      */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexWrap: "wrap",
            padding: 8,
            borderBottom: `1px solid ${c.border}`,
            background: c.panel,
          }}
        >
          <button
            style={canUndo ? buttonStyle : disabledButton}
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button
            style={canRedo ? buttonStyle : disabledButton}
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            Redo
          </button>
          <span style={{ width: 8 }} />
          <button
            style={buttonStyle}
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
          >
            -
          </button>
          <span style={{ minWidth: 48, textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            style={buttonStyle}
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
          >
            +
          </button>
          <button style={buttonStyle} onClick={() => setZoom(1)}>
            100%
          </button>
          <button style={buttonStyle} onClick={fitToPane}>
            Fit
          </button>
          <button style={buttonStyle} onClick={print}>
            Print
          </button>
          {Object.keys(matrix.doc.positions).length > 0 && canEdit && (
            <button style={buttonStyle} onClick={matrix.clearPositions}>
              Reset layout
            </button>
          )}
          <span style={{ color: c.muted, marginLeft: "auto", whiteSpace: "nowrap" }}>
            Earliest units at the bottom
          </span>
        </div>

        {phases.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              padding: "6px 8px",
              borderBottom: `1px solid ${c.border}`,
              background: c.panel,
              fontSize: 12,
            }}
          >
            {phases.map((phase) => (
              <span
                key={phase}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    border: `1px solid ${c.border}`,
                    background: phaseColor(phase, matrix.doc.phaseOrder),
                  }}
                />
                {phase}
              </span>
            ))}
          </div>
        )}

        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflow: "auto",
            padding: 16,
            minWidth: 0,
            minHeight: 0,
            boxSizing: "border-box",
          }}
        >
          {layout.nodes.length === 0 ? (
            <p style={{ color: c.muted }}>
              No units yet. Add contexts on the left, or paste an existing matrix
              under Data, and the diagram builds itself.
            </p>
          ) : (
            <svg
              ref={svgRef}
              width={layout.width * zoom}
              height={layout.height * zoom}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              onPointerMove={(event) => {
                if (!drag) return;
                const point = pointerToSvg(event);
                if (!point) return;
                matrix.setPosition(drag.nodeId, {
                  x: point.x - drag.offsetX,
                  y: point.y - drag.offsetY,
                });
              }}
              onPointerUp={() => setDrag(null)}
              onPointerLeave={() => setDrag(null)}
            >
              {layout.groups.map((group) => (
                <g key={group.id}>
                  <rect
                    x={group.x}
                    y={group.y}
                    width={group.width}
                    height={group.height}
                    fill="none"
                    stroke={group.color}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    rx={6}
                  />
                  <text
                    x={group.x + 6}
                    y={group.y + 12}
                    fontSize={11}
                    fill={group.color}
                  >
                    {group.name}
                  </text>
                </g>
              ))}

              <g
                fill="none"
                stroke={c.line}
                strokeWidth={1.5}
                strokeLinejoin="miter"
              >
                {layout.edges.map((edge) => (
                  <polyline
                    key={`${edge.from}-${edge.to}`}
                    points={polylinePoints(edge.points)}
                  />
                ))}
              </g>

              <g stroke={c.line} strokeWidth={1.5} strokeDasharray="6 4">
                {layout.correlations.map((link, index) => (
                  <line
                    key={index}
                    x1={link.from.x}
                    y1={link.from.y}
                    x2={link.to.x}
                    y2={link.to.y}
                  />
                ))}
              </g>
              <g stroke={c.line} strokeWidth={1.5} strokeDasharray="2 3">
                {layout.contemporaries.map((link, index) => (
                  <line
                    key={index}
                    x1={link.from.x}
                    y1={link.from.y}
                    x2={link.to.x}
                    y2={link.to.y}
                  />
                ))}
              </g>

              {layout.nodes.map((node) => {
                const isSelected =
                  selected !== null && node.unitIds.includes(selected);
                return (
                  <g
                    key={node.id}
                    style={{ cursor: canEdit ? "grab" : "pointer" }}
                    onPointerDown={(event) => {
                      setSelected(node.unitIds[0] ?? null);
                      if (!canEdit) return;
                      const point = pointerToSvg(event);
                      if (!point) return;
                      (event.target as Element).releasePointerCapture?.(
                        event.pointerId,
                      );
                      setDrag({
                        nodeId: node.id,
                        offsetX: point.x - node.x,
                        offsetY: point.y - node.y,
                      });
                    }}
                  >
                    <rect
                      x={node.x}
                      y={node.y}
                      width={node.width}
                      height={node.height}
                      fill={node.phaseColor ?? c.panel}
                      stroke={node.hasProblem ? c.error : c.line}
                      strokeWidth={isSelected ? 3 : node.hasProblem ? 2.5 : 1.5}
                    />
                    <text
                      x={node.x + node.width / 2}
                      y={node.y + node.height / 2 + 5}
                      textAnchor="middle"
                      fill={node.phaseColor ? "#111111" : c.text}
                      fontSize={14}
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};

function statusLine(saveState: string, offline: boolean, canEdit: boolean): string {
  if (!canEdit) return "Read only: you cannot edit this project's matrix.";
  if (saveState === "unsynced" || offline) {
    return "Saved on this device. Will upload when the server is reachable.";
  }
  if (saveState === "saving") return "Saving...";
  if (saveState === "saved") return "Saved to the project.";
  return "Up to date.";
}

interface PanelProps {
  matrix: UseMatrixResult;
  canEdit: boolean;
  colors: Palette;
  inputStyle: React.CSSProperties;
  buttonStyle: React.CSSProperties;
}

const UnitsPanel: React.FC<
  PanelProps & {
    selected: string | null;
    onSelect: (id: string | null) => void;
    phases: string[];
  }
> = ({
  matrix,
  canEdit,
  colors,
  inputStyle,
  buttonStyle,
  selected,
  onSelect,
  phases,
}) => {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<UnitType>("deposit");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const result = matrix.addUnit({ label, type, description, phase });
    if (!result.ok) {
      setError(result.error ?? "Could not add the unit.");
      return;
    }
    setError(null);
    setLabel("");
    setDescription("");
  };

  const units = [...matrix.doc.units].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );

  return (
    <div>
      {canEdit && (
        <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
          <input
            style={inputStyle}
            placeholder="Context number, e.g. 1001"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
          <select
            style={inputStyle}
            value={type}
            onChange={(event) => setType(event.target.value as UnitType)}
          >
            {UNIT_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            style={inputStyle}
            placeholder="Phase (optional)"
            value={phase}
            list="matrix-phases"
            onChange={(event) => setPhase(event.target.value)}
          />
          <datalist id="matrix-phases">
            {phases.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <input
            style={inputStyle}
            placeholder="Description (optional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <button style={buttonStyle} onClick={submit}>
            Add unit
          </button>
          {error && <div style={{ color: colors.error }}>{error}</div>}
        </div>
      )}

      {units.length === 0 && (
        <p style={{ color: colors.muted }}>No units recorded.</p>
      )}

      {units.map((unit) => (
        <div
          key={unit.id}
          onClick={() => onSelect(unit.id === selected ? null : unit.id)}
          style={{
            border: `1px solid ${
              unit.id === selected ? colors.text : colors.border
            }`,
            borderRadius: 4,
            padding: 8,
            marginBottom: 6,
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>{unit.label}</strong>
            <span style={{ color: colors.muted }}>{unit.type}</span>
          </div>
          {unit.phase && (
            <div style={{ color: colors.muted }}>Phase: {unit.phase}</div>
          )}
          {unit.description && <div>{unit.description}</div>}
          {canEdit && unit.id === selected && (
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              <input
                style={inputStyle}
                placeholder="Phase"
                defaultValue={unit.phase ?? ""}
                onClick={(event) => event.stopPropagation()}
                onBlur={(event) =>
                  matrix.updateUnit(unit.id, {
                    phase: event.target.value.trim() || undefined,
                  })
                }
              />
              <button
                style={buttonStyle}
                onClick={(event) => {
                  event.stopPropagation();
                  matrix.removeUnit(unit.id);
                  onSelect(null);
                }}
              >
                Delete unit and its relationships
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const RelationsPanel: React.FC<PanelProps> = ({
  matrix,
  canEdit,
  colors,
  inputStyle,
  buttonStyle,
}) => {
  const [from, setFrom] = useState("");
  const [verb, setVerb] = useState<RelationVerb>("above");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const label = (id: string) =>
    matrix.doc.units.find((unit) => unit.id === id)?.label ?? id;

  const submit = () => {
    const result = matrix.addRelation({ from, to, verb });
    if (!result.ok) {
      setError(result.error ?? "Could not record that.");
      return;
    }
    setError(null);
    setTo("");
  };

  const options = [...matrix.doc.units].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );

  return (
    <div>
      {canEdit && (
        <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
          <select
            style={inputStyle}
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          >
            <option value="">Select unit...</option>
            {options.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.label}
              </option>
            ))}
          </select>
          <select
            style={inputStyle}
            value={verb}
            onChange={(event) => setVerb(event.target.value as RelationVerb)}
          >
            {RELATION_VERBS.map((option) => (
              <option key={option} value={option}>
                {option.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            style={inputStyle}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          >
            <option value="">Select unit...</option>
            {options.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.label}
              </option>
            ))}
          </select>
          <button style={buttonStyle} onClick={submit}>
            Record relationship
          </button>
          {error && <div style={{ color: colors.error }}>{error}</div>}
        </div>
      )}

      {matrix.doc.relations.length === 0 && (
        <p style={{ color: colors.muted }}>Nothing recorded yet.</p>
      )}

      {matrix.doc.relations.map((relation) => (
        <div
          key={relation.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: `1px solid ${colors.border}`,
            borderRadius: 4,
            padding: 8,
            marginBottom: 6,
          }}
        >
          <span>
            {label(relation.from)}{" "}
            <span style={{ color: colors.muted }}>
              {(relation.verb ?? relation.type).replace("_", " ")}
            </span>{" "}
            {label(relation.to)}
          </span>
          {canEdit && (
            <button
              style={buttonStyle}
              onClick={() => matrix.removeRelation(relation.id)}
            >
              Remove
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

const GroupsPanel: React.FC<PanelProps & { phases: string[] }> = ({
  matrix,
  canEdit,
  colors,
  inputStyle,
  buttonStyle,
  phases,
}) => {
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);

  const units = [...matrix.doc.units].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );

  return (
    <div>
      {canEdit && (
        <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
          <input
            style={inputStyle}
            placeholder="Group name, e.g. Building 3"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div
            style={{
              maxHeight: 160,
              overflowY: "auto",
              border: `1px solid ${colors.border}`,
              borderRadius: 4,
              padding: 6,
            }}
          >
            {units.map((unit) => (
              <label key={unit.id} style={{ display: "block", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={members.includes(unit.id)}
                  onChange={(event) =>
                    setMembers((current) =>
                      event.target.checked
                        ? [...current, unit.id]
                        : current.filter((id) => id !== unit.id),
                    )
                  }
                />{" "}
                {unit.label}
              </label>
            ))}
          </div>
          <button
            style={buttonStyle}
            onClick={() => {
              matrix.addGroup(name, members);
              setName("");
              setMembers([]);
            }}
          >
            Create group
          </button>
        </div>
      )}

      {matrix.doc.groups.length === 0 && (
        <p style={{ color: colors.muted }}>
          No groups. Group contexts that belong to one feature or building to make a
          large matrix readable.
        </p>
      )}

      {matrix.doc.groups.map((group) => (
        <div
          key={group.id}
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 4,
            padding: 8,
            marginBottom: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>{group.name}</strong>
            <span style={{ color: colors.muted }}>{group.unitIds.length} units</span>
          </div>
          {canEdit && (
            <button
              style={{ ...buttonStyle, marginTop: 6 }}
              onClick={() => matrix.removeGroup(group.id)}
            >
              Delete group
            </button>
          )}
        </div>
      ))}

      {phases.length > 1 && canEdit && (
        <div style={{ marginTop: 16 }}>
          <strong>Phase order</strong>
          <p style={{ color: colors.muted, marginTop: 4 }}>
            Controls the legend order and the colours assigned.
          </p>
          {phases.map((phase, index) => (
            <div
              key={phase}
              style={{ display: "flex", gap: 6, alignItems: "center" }}
            >
              <span style={{ flex: 1 }}>{phase}</span>
              <button
                style={buttonStyle}
                disabled={index === 0}
                onClick={() => {
                  const next = [...phases];
                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  matrix.setPhaseOrder(next);
                }}
              >
                Up
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DataPanel: React.FC<
  PanelProps & {
    layout: ReturnType<typeof layoutGraph>;
    title: string;
    download: (contents: string, filename: string, mime: string) => void;
    onPrint: () => void;
  }
> = ({
  matrix,
  canEdit,
  colors,
  inputStyle,
  buttonStyle,
  layout,
  title,
  download,
  onPrint,
}) => {
  const [paste, setPaste] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const runImport = (text: string) => {
    const result = matrix.importText(text);
    const lines = [
      `Added ${result.unitsAdded} units and ${result.relationsAdded} relationships.`,
    ];
    if (result.skipped.length > 0) {
      lines.push(`Could not read ${result.skipped.length} lines:`);
      for (const skip of result.skipped.slice(0, 8)) {
        lines.push(`  line ${skip.line}: ${skip.reason}`);
      }
    }
    setReport(lines.join("\n"));
    setPaste("");
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {canEdit && (
        <>
          <strong>Import</strong>
          <p style={{ color: colors.muted, margin: 0 }}>
            One relationship per line: <code>1001,above,1002</code> or{" "}
            <code>1001 above 1002</code>. Accepts above, below, seals, cuts, fills,
            same, contemporary. Units are created as they are mentioned.
          </p>
          <textarea
            style={{ ...inputStyle, minHeight: 90, fontFamily: "monospace" }}
            placeholder={"1001,above,1002\n1002,above,1003"}
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              style={buttonStyle}
              onClick={() => paste.trim() && runImport(paste)}
            >
              Import pasted text
            </button>
            <button style={buttonStyle} onClick={() => fileRef.current?.click()}>
              Import file
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            style={{ display: "none" }}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              runImport(await file.text());
              event.target.value = "";
            }}
          />
          {report && (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                color: colors.muted,
                margin: 0,
                font: "inherit",
              }}
            >
              {report}
            </pre>
          )}

          <div style={{ height: 8 }} />
          <strong>Title</strong>
          <input
            style={inputStyle}
            placeholder="Harris Matrix"
            defaultValue={matrix.doc.title ?? ""}
            onBlur={(event) => matrix.setTitle(event.target.value)}
          />
        </>
      )}

      <div style={{ height: 8 }} />
      <strong>Export</strong>
      <button
        style={buttonStyle}
        onClick={() =>
          download(toSvg(layout, title), `${title}.svg`, "image/svg+xml")
        }
      >
        Diagram (SVG)
      </button>
      <button
        style={buttonStyle}
        onClick={() =>
          download(
            toText(matrix.doc, matrix.graph),
            "stratigraphic-index.txt",
            "text/plain",
          )
        }
      >
        Stratigraphic index (text)
      </button>
      <button
        style={buttonStyle}
        onClick={() => download(toCsv(matrix.doc), "relationships.csv", "text/csv")}
      >
        Relationships (CSV)
      </button>
      <button style={buttonStyle} onClick={onPrint}>
        Print / PDF
      </button>
      <p style={{ color: colors.muted, marginTop: 8 }}>
        {matrix.doc.units.length} units, {matrix.doc.relations.length} recorded
        relationships, {layout.nodes.length} drawn nodes.
      </p>
    </div>
  );
};

export default HarrisMatrix;

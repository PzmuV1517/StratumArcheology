/**
 * @file
 * Harris Matrix editor, web.
 *
 * Laid out as a working tool rather than a picture: the lists on the left are
 * the record, the diagram on the right is derived from it and is never edited
 * directly. Every problem the graph finds is shown in full instead of being
 * reduced to a red outline, because an unreadable sequence has to be fixed in
 * the trench, not guessed at.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useColorScheme } from "react-native";

import { toCsv, toSvg, toText } from "./core/exportMatrix";
import { DEFAULT_LAYOUT, layoutGraph, polylinePoints } from "./core/layout";
import { RELATION_VERBS, UNIT_TYPES } from "./core/model";
import type { RelationVerb, UnitType } from "./core/model";
import { useMatrix } from "./core/useMatrix";

interface HarrisMatrixProps {
  projectId: string;
  canEdit?: boolean;
}

type Tab = "units" | "relations" | "problems" | "export";

export const HarrisMatrix: React.FC<HarrisMatrixProps> = ({
  projectId,
  canEdit = true,
}) => {
  const dark = (useColorScheme() ?? "light") === "dark";
  const matrix = useMatrix(projectId, canEdit);
  const [tab, setTab] = useState<Tab>("units");
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const layout = useMemo(
    () => layoutGraph(matrix.graph, DEFAULT_LAYOUT),
    [matrix.graph],
  );

  const c = useMemo(
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

  // Scale the diagram to the pane rather than the window: the pane is what
  // the drawing actually has to fit inside.
  const fitToPane = useCallback(() => {
    const pane = scrollRef.current;
    if (!pane || layout.width <= 0 || layout.height <= 0) return;
    const available = {
      width: Math.max(1, pane.clientWidth - 32),
      height: Math.max(1, pane.clientHeight - 32),
    };
    const scale = Math.min(
      available.width / layout.width,
      available.height / layout.height,
    );
    setZoom(Math.min(3, Math.max(0.25, scale)));
  }, [layout.width, layout.height]);

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

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        // Without this the panels can paint over the rounded container edge.
        overflow: "hidden",
        boxSizing: "border-box",
        background: c.bg,
        color: c.text,
        font: "14px/1.4 system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          width: 340,
          // A fixed width alone still collapses once the diagram column
          // demands room, which loses the entry form on a narrow window.
          flex: "0 0 340px",
          borderRight: `1px solid ${c.border}`,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: c.panel,
        }}
      >
        <div style={{ display: "flex", borderBottom: `1px solid ${c.border}` }}>
          {(["units", "relations", "problems", "export"] as Tab[]).map((name) => (
            <button
              key={name}
              onClick={() => setTab(name)}
              style={{
                flex: 1,
                padding: "10px 4px",
                background: tab === name ? c.accent : "transparent",
                color: c.text,
                border: "none",
                borderBottom:
                  tab === name ? `2px solid ${c.text}` : "2px solid transparent",
                cursor: "pointer",
                font: "inherit",
                textTransform: "capitalize",
              }}
            >
              {name}
              {name === "problems" && errors.length > 0 ? ` (${errors.length})` : ""}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {tab === "units" && (
            <UnitsPanel
              matrix={matrix}
              canEdit={canEdit}
              colors={c}
              inputStyle={inputStyle}
              buttonStyle={buttonStyle}
              selected={selected}
              onSelect={setSelected}
            />
          )}
          {tab === "relations" && (
            <RelationsPanel
              matrix={matrix}
              canEdit={canEdit}
              colors={c}
              inputStyle={inputStyle}
              buttonStyle={buttonStyle}
            />
          )}
          {tab === "problems" && (
            <div>
              {errors.length === 0 && warnings.length === 0 && (
                <p style={{ color: c.muted }}>
                  No contradictions. Every recorded relationship fits one sequence.
                </p>
              )}
              {errors.map((problem, index) => (
                <div
                  key={`e${index}`}
                  style={{
                    borderLeft: `3px solid ${c.error}`,
                    padding: "6px 8px",
                    marginBottom: 8,
                  }}
                >
                  <strong style={{ color: c.error }}>Must fix</strong>
                  <div>{problem.message}</div>
                </div>
              ))}
              {warnings.map((problem, index) => (
                <div
                  key={`w${index}`}
                  style={{
                    borderLeft: `3px solid ${c.warn}`,
                    padding: "6px 8px",
                    marginBottom: 8,
                  }}
                >
                  <strong style={{ color: c.warn }}>Note</strong>
                  <div>{problem.message}</div>
                </div>
              ))}
            </div>
          )}
          {tab === "export" && (
            <div style={{ display: "grid", gap: 8 }}>
              <button
                style={buttonStyle}
                onClick={() =>
                  download(
                    toSvg(layout, `Harris Matrix ${projectId}`),
                    "harris-matrix.svg",
                    "image/svg+xml",
                  )
                }
              >
                Download diagram (SVG)
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
                Download stratigraphic index (text)
              </button>
              <button
                style={buttonStyle}
                onClick={() =>
                  download(toCsv(matrix.doc), "relationships.csv", "text/csv")
                }
              >
                Download relationships (CSV)
              </button>
              <p style={{ color: c.muted, marginTop: 8 }}>
                {matrix.doc.units.length} units, {matrix.doc.relations.length}{" "}
                recorded relationships, {layout.nodes.length} drawn nodes.
              </p>
            </div>
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
            gap: 8,
            alignItems: "center",
            padding: 8,
            borderBottom: `1px solid ${c.border}`,
            background: c.panel,
          }}
        >
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
          <span style={{ color: c.muted, marginLeft: "auto", whiteSpace: "nowrap" }}>
            Earliest units at the bottom
          </span>
        </div>

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
              No units yet. Add contexts on the left and the matrix builds itself.
            </p>
          ) : (
            <svg
              width={layout.width * zoom}
              height={layout.height * zoom}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
            >
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
              {layout.nodes.map((node) => {
                const isSelected =
                  selected !== null && node.unitIds.includes(selected);
                return (
                  <g
                    key={node.id}
                    onClick={() => {
                      setSelected(node.unitIds[0] ?? null);
                      setTab("units");
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x={node.x}
                      y={node.y}
                      width={node.width}
                      height={node.height}
                      fill={c.panel}
                      stroke={node.hasProblem ? c.error : c.line}
                      strokeWidth={isSelected ? 3 : node.hasProblem ? 2.5 : 1.5}
                    />
                    <text
                      x={node.x + node.width / 2}
                      y={node.y + node.height / 2 + 5}
                      textAnchor="middle"
                      fill={c.text}
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
  matrix: ReturnType<typeof useMatrix>;
  canEdit: boolean;
  colors: Record<string, string>;
  inputStyle: React.CSSProperties;
  buttonStyle: React.CSSProperties;
}

const UnitsPanel: React.FC<
  PanelProps & { selected: string | null; onSelect: (id: string | null) => void }
> = ({ matrix, canEdit, colors, inputStyle, buttonStyle, selected, onSelect }) => {
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
            onChange={(event) => setPhase(event.target.value)}
          />
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
            border: `1px solid ${unit.id === selected ? colors.text : colors.border}`,
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
            <button
              style={{ ...buttonStyle, marginTop: 8 }}
              onClick={(event) => {
                event.stopPropagation();
                matrix.removeUnit(unit.id);
                onSelect(null);
              }}
            >
              Delete unit and its relationships
            </button>
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

export default HarrisMatrix;

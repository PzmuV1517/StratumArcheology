/**
 * @file
 * Geometry for the matrix diagram.
 *
 * Kept separate from both renderers so the web SVG and the phone SVG place
 * every node identically. A diagram that shifts between the office and the
 * trench is not a record anyone can cite.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */

import type { MatrixGraph } from "./graph";
import { phaseColor } from "./model";
import type { MatrixDocument } from "./model";

export interface LayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  columnGap: number;
  rowGap: number;
  padding: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  nodeWidth: 96,
  nodeHeight: 40,
  columnGap: 28,
  rowGap: 56,
  padding: 24,
};

/** Touch targets need more room than a mouse pointer does. */
export const PHONE_LAYOUT: LayoutOptions = {
  nodeWidth: 104,
  nodeHeight: 46,
  columnGap: 24,
  rowGap: 60,
  padding: 16,
};

export interface PlacedNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
  unitIds: string[];
  hasProblem: boolean;
  /** Phase tint, when the units carry a phase. */
  phase?: string;
  phaseColor?: string;
  /** True when the operator has dragged this node off the automatic grid. */
  pinned: boolean;
}

export interface PlacedEdge {
  from: string;
  to: string;
  /** Orthogonal polyline, the convention every Harris Matrix is drawn with. */
  points: { x: number; y: number }[];
}

export interface PlacedCorrelation {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** A labelled box drawn behind the units that belong to a group. */
export interface PlacedGroup {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MatrixLayout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  correlations: PlacedCorrelation[];
  contemporaries: PlacedCorrelation[];
  groups: PlacedGroup[];
  width: number;
  height: number;
}

/**
 * Assign coordinates to an already reasoned-about graph.
 *
 * Rows come from the graph's levels; within a row the nodes are centred so
 * the diagram reads as a symmetrical column rather than drifting right.
 */
export function layoutGraph(
  graph: MatrixGraph,
  options: LayoutOptions = DEFAULT_LAYOUT,
  doc?: MatrixDocument,
): MatrixLayout {
  const { nodeWidth, nodeHeight, columnGap, rowGap, padding } = options;
  const positions = doc?.positions ?? {};
  const phaseOrder = doc?.phaseOrder ?? [];

  const rows = new Map<number, typeof graph.nodes>();
  for (const node of graph.nodes) {
    const bucket = rows.get(node.level);
    if (bucket) bucket.push(node);
    else rows.set(node.level, [node]);
  }
  for (const bucket of rows.values()) {
    bucket.sort((a, b) => a.order - b.order);
  }

  const widestRow = Math.max(
    1,
    ...Array.from(rows.values(), (bucket) => bucket.length),
  );
  const contentWidth = widestRow * nodeWidth + (widestRow - 1) * columnGap;

  const problemUnits = new Set<string>();
  for (const problem of graph.problems) {
    if (problem.severity !== "error") continue;
    for (const unitId of problem.unitIds) problemUnits.add(unitId);
  }

  const placed = new Map<string, PlacedNode>();
  const nodes: PlacedNode[] = [];

  for (const [level, bucket] of Array.from(rows.entries()).sort(
    (a, b) => a[0] - b[0],
  )) {
    const rowWidth = bucket.length * nodeWidth + (bucket.length - 1) * columnGap;
    const rowStart = padding + (contentWidth - rowWidth) / 2;

    bucket.forEach((node, index) => {
      const unitIds = node.members.map((member) => member.id);
      // The phase of the first member that has one: correlated records of a
      // single deposit belong to a single phase.
      const phase = node.members.find((member) => member.phase)?.phase;
      const manual = positions[node.id];
      const entry: PlacedNode = {
        id: node.id,
        label: node.label,
        x: manual ? manual.x : rowStart + index * (nodeWidth + columnGap),
        y: manual ? manual.y : padding + level * (nodeHeight + rowGap),
        width: nodeWidth,
        height: nodeHeight,
        level,
        unitIds,
        hasProblem: unitIds.some((id) => problemUnits.has(id)),
        phase,
        phaseColor: phase ? phaseColor(phase, phaseOrder) : undefined,
        pinned: Boolean(manual),
      };
      placed.set(node.id, entry);
      nodes.push(entry);
    });
  }

  const edges: PlacedEdge[] = [];
  for (const edge of graph.edges) {
    if (edge.redundant) continue;
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    if (!from || !to) continue;

    const startX = from.x + from.width / 2;
    const startY = from.y + from.height;
    const endX = to.x + to.width / 2;
    const endY = to.y;

    if (Math.abs(startX - endX) < 0.5) {
      edges.push({
        from: edge.from,
        to: edge.to,
        points: [
          { x: startX, y: startY },
          { x: endX, y: endY },
        ],
      });
      continue;
    }

    // Step across halfway down the gap so the horizontal run cannot land on
    // top of a node in an intervening row.
    const midY = startY + (endY - startY) / 2;
    edges.push({
      from: edge.from,
      to: edge.to,
      points: [
        { x: startX, y: startY },
        { x: startX, y: midY },
        { x: endX, y: midY },
        { x: endX, y: endY },
      ],
    });
  }

  const tie = (links: { from: string; to: string }[]): PlacedCorrelation[] => {
    const result: PlacedCorrelation[] = [];
    const seen = new Set<string>();
    for (const link of links) {
      const fromNode = graph.nodeOfUnit.get(link.from);
      const toNode = graph.nodeOfUnit.get(link.to);
      if (!fromNode || !toNode || fromNode === toNode) continue;
      const key =
        fromNode < toNode ? `${fromNode}|${toNode}` : `${toNode}|${fromNode}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const a = placed.get(fromNode);
      const b = placed.get(toNode);
      if (!a || !b) continue;
      // Join the facing edges so the tie does not cut through either box.
      const [left, right] = a.x <= b.x ? [a, b] : [b, a];
      result.push({
        from: { x: left.x + left.width, y: left.y + left.height / 2 },
        to: { x: right.x, y: right.y + right.height / 2 },
      });
    }
    return result;
  };

  const contemporaries = tie(graph.contemporaries);

  // Group boxes are drawn behind their members, so they need the members'
  // final coordinates rather than the level grid.
  const groups: PlacedGroup[] = [];
  const groupPadding = 10;
  for (const group of doc?.groups ?? []) {
    const members = nodes.filter((node) =>
      node.unitIds.some((unitId) => group.unitIds.includes(unitId)),
    );
    if (members.length === 0) continue;
    const minX = Math.min(...members.map((node) => node.x));
    const minY = Math.min(...members.map((node) => node.y));
    const maxX = Math.max(...members.map((node) => node.x + node.width));
    const maxY = Math.max(...members.map((node) => node.y + node.height));
    groups.push({
      id: group.id,
      name: group.name,
      color: group.color ?? phaseColor(group.name),
      x: minX - groupPadding,
      // Extra room above for the group's name.
      y: minY - groupPadding - 14,
      width: maxX - minX + groupPadding * 2,
      height: maxY - minY + groupPadding * 2 + 14,
    });
  }

  // Dragged nodes can sit outside the automatic grid, so measure the drawing
  // rather than assuming it.
  const contentRight = nodes.reduce(
    (max, node) => Math.max(max, node.x + node.width),
    contentWidth + padding,
  );
  const contentBottom = nodes.reduce(
    (max, node) => Math.max(max, node.y + node.height),
    padding,
  );

  return {
    nodes,
    edges,
    correlations: tie(graph.correlations),
    contemporaries,
    groups,
    width: contentRight + padding,
    height: contentBottom + padding,
  };
}

export function polylinePoints(points: { x: number; y: number }[]): string {
  return points.map((point) => `${round(point.x)},${round(point.y)}`).join(" ");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

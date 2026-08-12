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

export interface MatrixLayout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  correlations: PlacedCorrelation[];
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
): MatrixLayout {
  const { nodeWidth, nodeHeight, columnGap, rowGap, padding } = options;

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
      const entry: PlacedNode = {
        id: node.id,
        label: node.label,
        x: rowStart + index * (nodeWidth + columnGap),
        y: padding + level * (nodeHeight + rowGap),
        width: nodeWidth,
        height: nodeHeight,
        level,
        unitIds,
        hasProblem: unitIds.some((id) => problemUnits.has(id)),
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

  const correlations: PlacedCorrelation[] = [];
  const seenCorrelation = new Set<string>();
  for (const link of graph.correlations) {
    const fromNode = graph.nodeOfUnit.get(link.from);
    const toNode = graph.nodeOfUnit.get(link.to);
    if (!fromNode || !toNode || fromNode === toNode) continue;
    const key =
      fromNode < toNode ? `${fromNode}|${toNode}` : `${toNode}|${fromNode}`;
    if (seenCorrelation.has(key)) continue;
    seenCorrelation.add(key);

    const a = placed.get(fromNode);
    const b = placed.get(toNode);
    if (!a || !b) continue;
    correlations.push({
      from: { x: a.x + a.width, y: a.y + a.height / 2 },
      to: { x: b.x, y: b.y + b.height / 2 },
    });
  }

  const maxLevel = nodes.reduce((max, node) => Math.max(max, node.level), 0);

  return {
    nodes,
    edges,
    correlations,
    width: contentWidth + padding * 2,
    height: padding * 2 + (maxLevel + 1) * nodeHeight + maxLevel * rowGap,
  };
}

export function polylinePoints(points: { x: number; y: number }[]): string {
  return points.map((point) => `${round(point.x)},${round(point.y)}`).join(" ");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

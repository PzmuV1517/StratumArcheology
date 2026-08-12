/**
 * @file
 * Exports.
 *
 * A matrix that cannot leave the app is not usable in a site report, so both
 * formats here are plain text a publisher or another program can take:
 * standalone SVG, and the relationship list every excavation archive expects.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */

import type { MatrixGraph } from "./graph";
import type { MatrixLayout } from "./layout";
import { polylinePoints } from "./layout";
import type { MatrixDocument } from "./model";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Self-contained SVG: no external fonts or stylesheets to go missing. */
export function toSvg(layout: MatrixLayout, title: string): string {
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">`,
  );
  parts.push(`<title>${escapeXml(title)}</title>`);
  parts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
  parts.push(
    `<g fill="none" stroke="#111111" stroke-width="1.5" stroke-linejoin="miter">`,
  );
  for (const edge of layout.edges) {
    parts.push(`<polyline points="${polylinePoints(edge.points)}"/>`);
  }
  parts.push(`</g>`);

  parts.push(`<g stroke="#111111" stroke-width="1.5" stroke-dasharray="6 4">`);
  for (const link of layout.correlations) {
    parts.push(
      `<line x1="${link.from.x}" y1="${link.from.y}" x2="${link.to.x}" y2="${link.to.y}"/>`,
    );
  }
  parts.push(`</g>`);

  for (const node of layout.nodes) {
    parts.push(
      `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="#ffffff" stroke="#111111" stroke-width="1.5"/>`,
    );
    parts.push(
      `<text x="${node.x + node.width / 2}" y="${node.y + node.height / 2 + 5}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#111111">${escapeXml(node.label)}</text>`,
    );
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}

/** The stratigraphic index: every unit with what it is above and below. */
export function toText(doc: MatrixDocument, graph: MatrixGraph): string {
  const label = new Map(doc.units.map((unit) => [unit.id, unit.label]));
  const lines: string[] = ["Stratigraphic index", ""];

  const sorted = [...doc.units].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );

  for (const unit of sorted) {
    const above = doc.relations
      .filter((r) => r.type === "above" && r.from === unit.id)
      .map((r) => label.get(r.to) ?? r.to);
    const below = doc.relations
      .filter((r) => r.type === "above" && r.to === unit.id)
      .map((r) => label.get(r.from) ?? r.from);
    const same = doc.relations
      .filter(
        (r) => r.type === "same_as" && (r.from === unit.id || r.to === unit.id),
      )
      .map((r) => label.get(r.from === unit.id ? r.to : r.from) ?? "");

    lines.push(`${unit.label} (${unit.type})`);
    if (unit.phase) lines.push(`  phase: ${unit.phase}`);
    if (unit.description) lines.push(`  ${unit.description}`);
    lines.push(`  above: ${above.length ? above.join(", ") : "-"}`);
    lines.push(`  below: ${below.length ? below.join(", ") : "-"}`);
    if (same.length) lines.push(`  same as: ${same.join(", ")}`);
    lines.push("");
  }

  const errors = graph.problems.filter((p) => p.severity === "error");
  if (errors.length) {
    lines.push("Unresolved problems");
    for (const problem of errors) lines.push(`  - ${problem.message}`);
    lines.push("");
  }

  return lines.join("\n");
}

/** Comma-separated pairs, for importing into other matrix software. */
export function toCsv(doc: MatrixDocument): string {
  const label = new Map(doc.units.map((unit) => [unit.id, unit.label]));
  const rows = ["upper,relation,lower"];
  for (const relation of doc.relations) {
    const from = label.get(relation.from) ?? relation.from;
    const to = label.get(relation.to) ?? relation.to;
    rows.push(`${from},${relation.type === "same_as" ? "same_as" : "above"},${to}`);
  }
  return rows.join("\n");
}

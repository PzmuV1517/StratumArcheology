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

/** The drawing itself, without the <svg> wrapper, so pages can reuse it. */
function drawingBody(layout: MatrixLayout): string {
  const parts: string[] = [];

  for (const group of layout.groups) {
    parts.push(
      `<rect x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" fill="none" stroke="${group.color}" stroke-width="1.5" stroke-dasharray="4 3" rx="6"/>`,
    );
    parts.push(
      `<text x="${group.x + 6}" y="${group.y + 12}" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="${group.color}">${escapeXml(group.name)}</text>`,
    );
  }

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

  // Contemporary ties use a different dash so they cannot be mistaken for a
  // correlation, which means something else entirely.
  parts.push(`<g stroke="#111111" stroke-width="1.5" stroke-dasharray="2 3">`);
  for (const link of layout.contemporaries) {
    parts.push(
      `<line x1="${link.from.x}" y1="${link.from.y}" x2="${link.to.x}" y2="${link.to.y}"/>`,
    );
  }
  parts.push(`</g>`);

  for (const node of layout.nodes) {
    parts.push(
      `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="${node.phaseColor ?? "#ffffff"}" stroke="#111111" stroke-width="1.5"/>`,
    );
    parts.push(
      `<text x="${node.x + node.width / 2}" y="${node.y + node.height / 2 + 5}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#111111">${escapeXml(node.label)}</text>`,
    );
  }

  return parts.join("\n");
}

/** Self-contained SVG: no external fonts or stylesheets to go missing. */
export function toSvg(layout: MatrixLayout, title: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">`,
    `<title>${escapeXml(title)}</title>`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    drawingBody(layout),
    `</svg>`,
  ].join("\n");
}

export interface PageSize {
  width: number;
  height: number;
}

/** A4 at 96dpi, less a 10mm margin. */
export const A4_PORTRAIT: PageSize = { width: 756, height: 1046 };

/**
 * Split the diagram into printable tiles.
 *
 * Scaling a large matrix onto one sheet makes the context numbers unreadable,
 * which defeats the point of printing it for the trench. Tiling keeps the
 * drawing at full size and lets the sheets be laid out side by side, which is
 * how excavation matrices have always been published.
 */
export function toPrintPages(
  layout: MatrixLayout,
  title: string,
  page: PageSize = A4_PORTRAIT,
): string[] {
  const columns = Math.max(1, Math.ceil(layout.width / page.width));
  const rows = Math.max(1, Math.ceil(layout.height / page.height));
  const pages: string[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const originX = column * page.width;
      const originY = row * page.height;
      pages.push(
        [
          `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="${originX} ${originY} ${page.width} ${page.height}">`,
          `<title>${escapeXml(title)} (${column + 1},${row + 1})</title>`,
          `<rect x="${originX}" y="${originY}" width="${page.width}" height="${page.height}" fill="#ffffff"/>`,
          drawingBody(layout),
          // Sheet reference, so a wall of pages can be reassembled.
          `<text x="${originX + page.width - 6}" y="${originY + page.height - 6}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#666666">${escapeXml(title)} - sheet ${column + 1} of ${columns} across, ${row + 1} of ${rows} down</text>`,
          `</svg>`,
        ].join("\n"),
      );
    }
  }

  return pages;
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

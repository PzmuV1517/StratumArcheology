/**
 * @file
 * Bringing an existing matrix in.
 *
 * Sites arrive with their stratigraphy already recorded, in a spreadsheet or
 * a context register, and retyping several hundred contexts by hand is both
 * slow and a source of error the diagram will faithfully reproduce. The
 * parser accepts the shapes that recording actually turns up in and reports
 * what it could not read rather than failing the whole file.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */

import { emptyDocument, newId } from "./model";
import type { MatrixDocument, Relation, RelationType, Unit } from "./model";

export interface ImportReport {
  doc: MatrixDocument;
  unitsAdded: number;
  relationsAdded: number;
  /** Lines that could not be read, with the reason and the line number. */
  skipped: { line: number; text: string; reason: string }[];
}

const ABOVE_WORDS = new Set([
  "above",
  "over",
  "later",
  "later_than",
  "seals",
  "cuts",
  "fills",
  "fill_of",
]);
const BELOW_WORDS = new Set([
  "below",
  "under",
  "earlier",
  "earlier_than",
  "sealed_by",
  "cut_by",
  "filled_by",
]);
const SAME_WORDS = new Set(["same", "same_as", "equals", "equal", "="]);
const CONTEMPORARY_WORDS = new Set(["contemporary", "contemporary_with", "with"]);

/** Split a CSV line, honouring quoted fields that contain commas. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === "," || char === ";" || char === "\t") {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse a pasted or uploaded matrix.
 *
 * Two shapes are accepted, decided per line rather than per file so a
 * register with a header and a few prose lines still imports:
 *
 *   1001,above,1002          three columns, any of , ; or tab
 *   1001 above 1002          the same thing written out
 *
 * Units are created on first mention, which is how context registers read.
 */
export function parseImport(
  text: string,
  existing: MatrixDocument = emptyDocument(),
): ImportReport {
  const units: Unit[] = existing.units.map((unit) => ({ ...unit }));
  const relations: Relation[] = existing.relations.map((rel) => ({ ...rel }));
  const skipped: ImportReport["skipped"] = [];

  const byLabel = new Map<string, Unit>();
  for (const unit of units) byLabel.set(unit.label.toLowerCase(), unit);

  const recorded = new Set(
    relations.map((rel) => `${rel.from}|${rel.to}|${rel.type}`),
  );

  let unitsAdded = 0;
  let relationsAdded = 0;

  const ensureUnit = (label: string): Unit => {
    const key = label.toLowerCase();
    const found = byLabel.get(key);
    if (found) return found;
    const unit: Unit = { id: newId("u"), label, type: "deposit" };
    byLabel.set(key, unit);
    units.push(unit);
    unitsAdded += 1;
    return unit;
  };

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    let fields = splitCsvLine(line);
    if (fields.length < 3) {
      fields = line.split(/\s+/);
    }
    if (fields.length < 3) {
      skipped.push({
        line: index + 1,
        text: line,
        reason: "expected three parts: upper, relationship, lower",
      });
      return;
    }

    const [left, verbRaw, ...rest] = fields;
    const right = rest.join(" ").trim();
    const verb = verbRaw.toLowerCase().replace(/\s+/g, "_");

    // Skip a header row rather than turning it into two contexts.
    if (
      index === 0 &&
      !ABOVE_WORDS.has(verb) &&
      !BELOW_WORDS.has(verb) &&
      !SAME_WORDS.has(verb) &&
      !CONTEMPORARY_WORDS.has(verb)
    ) {
      return;
    }

    if (!left || !right) {
      skipped.push({ line: index + 1, text: line, reason: "missing a unit" });
      return;
    }

    let type: RelationType;
    let upper = left;
    let lower = right;

    if (ABOVE_WORDS.has(verb)) {
      type = "above";
    } else if (BELOW_WORDS.has(verb)) {
      type = "above";
      upper = right;
      lower = left;
    } else if (SAME_WORDS.has(verb)) {
      type = "same_as";
    } else if (CONTEMPORARY_WORDS.has(verb)) {
      type = "contemporary";
    } else {
      skipped.push({
        line: index + 1,
        text: line,
        reason: `unknown relationship "${verbRaw}"`,
      });
      return;
    }

    if (upper.toLowerCase() === lower.toLowerCase()) {
      skipped.push({
        line: index + 1,
        text: line,
        reason: "a unit cannot relate to itself",
      });
      return;
    }

    const from = ensureUnit(upper);
    const to = ensureUnit(lower);
    const key = `${from.id}|${to.id}|${type}`;
    if (recorded.has(key)) return;
    recorded.add(key);
    relations.push({ id: newId("rel"), from: from.id, to: to.id, type });
    relationsAdded += 1;
  });

  return {
    doc: { ...existing, units, relations },
    unitsAdded,
    relationsAdded,
    skipped,
  };
}

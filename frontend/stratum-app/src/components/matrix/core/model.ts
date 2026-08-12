/**
 * @file
 * Harris Matrix data model and persistence format.
 *
 * A Harris Matrix records two primitive facts about an excavation:
 * superposition (unit A lies above unit B) and correlation (unit A and unit B
 * are the same deposit recorded twice). Every relationship an archaeologist
 * writes down reduces to one of those two, so the stored model keeps only
 * those and derives everything else.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */

export const MATRIX_FORMAT_VERSION = 3;

export type UnitType =
  | "deposit"
  | "cut"
  | "fill"
  | "structure"
  | "skeleton"
  | "other";

export const UNIT_TYPES: UnitType[] = [
  "deposit",
  "cut",
  "fill",
  "structure",
  "skeleton",
  "other",
];

/**
 * How one unit relates to another.
 *
 * "above" is the stratigraphic sequence: `from` was deposited later than `to`.
 * The excavator's vocabulary (seals, cuts, fills) all carry that same
 * ordering, so they are recorded as a label on the relation rather than as
 * separate edge kinds. "same_as" correlates two records of one deposit.
 */
export type RelationType = "above" | "same_as";

/** Excavation vocabulary, kept for the record sheet but not for the graph. */
export type RelationVerb = "above" | "seals" | "cuts" | "fills" | "same_as";

export const RELATION_VERBS: RelationVerb[] = [
  "above",
  "seals",
  "cuts",
  "fills",
  "same_as",
];

export interface Unit {
  id: string;
  /** Context number as written on the record sheet, e.g. "1001". */
  label: string;
  type: UnitType;
  description?: string;
  /** Free text: "Phase 2", "Roman", whatever the site uses. */
  phase?: string;
}

export interface Relation {
  id: string;
  from: string;
  to: string;
  type: RelationType;
  /** The word the excavator used; display only. */
  verb?: RelationVerb;
}

export interface MatrixDocument {
  version: number;
  units: Unit[];
  relations: Relation[];
  updatedAt?: string;
}

export function emptyDocument(): MatrixDocument {
  return { version: MATRIX_FORMAT_VERSION, units: [], relations: [] };
}

/** Verbs that mean "the subject is the later, upper unit". */
const UPPER_FIRST_VERBS = new Set([
  "above",
  "seals",
  "cuts",
  "fill_of",
  "fills",
  "later_than",
]);

/** Verbs that mean the opposite, so the pair is stored the other way round. */
const LOWER_FIRST_VERBS = new Set([
  "below",
  "sealed_by",
  "cut_by",
  "filled_by",
  "earlier_than",
]);

const CORRELATION_VERBS = new Set([
  "same_as",
  "equal_to",
  "equals",
  "contemporary_with",
]);

let idCounter = 0;

/**
 * Identifier for a unit or relation.
 *
 * Documents are merged across devices by id, so ids must not collide between
 * two field tablets editing offline. Math.random alone repeats often enough
 * across a crew to matter, so the timestamp anchors it and the counter keeps
 * ids distinct inside a single millisecond.
 */
export function newId(prefix: string): string {
  idCounter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${random}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function coerceUnitType(value: unknown): UnitType {
  const raw = asString(value).toLowerCase();
  if ((UNIT_TYPES as string[]).includes(raw)) return raw as UnitType;
  // The old model called every deposit a "layer".
  if (raw === "layer" || raw === "context") return "deposit";
  if (raw === "feature") return "structure";
  return raw ? "other" : "deposit";
}

/**
 * Read whatever is stored for a project into the current model.
 *
 * Field data predates this format and lives in two older shapes, so parsing
 * has to be forgiving: a document that fails to load is a season of
 * stratigraphic recording that silently disappears. Anything unreadable is
 * dropped rather than thrown, and the caller is told what survived.
 */
export function parseDocument(raw: unknown): MatrixDocument {
  if (!raw || typeof raw !== "object") return emptyDocument();
  const data = raw as Record<string, unknown>;

  if (Array.isArray(data.units) && Array.isArray(data.relations)) {
    return parseCurrent(data);
  }
  if (Array.isArray(data.contexts) || Array.isArray(data.relationships)) {
    return parseLegacy(data);
  }
  return emptyDocument();
}

function parseCurrent(data: Record<string, unknown>): MatrixDocument {
  const units: Unit[] = [];
  const seenUnits = new Set<string>();

  for (const entry of data.units as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = asString(record.id);
    if (!id || seenUnits.has(id)) continue;
    seenUnits.add(id);
    units.push({
      id,
      label: asString(record.label) || id,
      type: coerceUnitType(record.type),
      description: asString(record.description) || undefined,
      phase: asString(record.phase) || undefined,
    });
  }

  const relations: Relation[] = [];
  for (const entry of data.relations as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const from = asString(record.from);
    const to = asString(record.to);
    if (!seenUnits.has(from) || !seenUnits.has(to)) continue;
    relations.push({
      id: asString(record.id) || newId("rel"),
      from,
      to,
      type: record.type === "same_as" ? "same_as" : "above",
      verb: (asString(record.verb) as RelationVerb) || undefined,
    });
  }

  return {
    version: MATRIX_FORMAT_VERSION,
    units,
    relations,
    updatedAt: asString(data.updatedAt) || undefined,
  };
}

/**
 * Convert the pre-v3 document.
 *
 * That model stored contexts as [id, object] pairs and spelled relationships
 * with eight verbs, half of which pointed the other way. Both directions
 * collapse to a single "above" edge here.
 */
function parseLegacy(data: Record<string, unknown>): MatrixDocument {
  const units: Unit[] = [];
  const byId = new Set<string>();

  const contexts = Array.isArray(data.contexts) ? data.contexts : [];
  for (const entry of contexts) {
    let id = "";
    let payload: Record<string, unknown> = {};
    if (Array.isArray(entry)) {
      id = asString(entry[0]);
      payload = (entry[1] as Record<string, unknown>) || {};
    } else if (entry && typeof entry === "object") {
      payload = entry as Record<string, unknown>;
      id = asString(payload.id);
    }
    if (!id || byId.has(id)) continue;
    byId.add(id);
    units.push({
      id,
      label: asString(payload.label) || asString(payload.name) || id,
      type: coerceUnitType(payload.type),
      description: asString(payload.description) || undefined,
      phase: asString(payload.phase) || undefined,
    });
  }

  const relations: Relation[] = [];
  const relationships = Array.isArray(data.relationships) ? data.relationships : [];
  for (const entry of relationships) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const from = asString(record.from);
    const to = asString(record.to);
    const verb = asString(record.type).toLowerCase();
    if (!byId.has(from) || !byId.has(to)) continue;

    if (CORRELATION_VERBS.has(verb)) {
      relations.push({ id: newId("rel"), from, to, type: "same_as" });
    } else if (UPPER_FIRST_VERBS.has(verb)) {
      relations.push({ id: newId("rel"), from, to, type: "above" });
    } else if (LOWER_FIRST_VERBS.has(verb)) {
      relations.push({ id: newId("rel"), from: to, to: from, type: "above" });
    }
  }

  return { version: MATRIX_FORMAT_VERSION, units, relations };
}

/**
 * @file
 * Reading the matrix from outside the editor.
 *
 * Artefact recording links a find to the context it came from, so it needs
 * the unit list without pulling in the graph or the renderer. Going through
 * parseDocument here means those screens keep working across format changes
 * instead of each one hand-parsing whatever shape is stored.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */

import { parseDocument } from "./model";

export interface MatrixContextSummary {
  id: string;
  /** Context number as written on the record sheet. */
  label: string;
  type: string;
  description: string;
}

/** Units in a stored document, ordered by context number. */
export function listContexts(raw: unknown): MatrixContextSummary[] {
  return parseDocument(raw)
    .units.map((unit) => ({
      id: unit.id,
      label: unit.label,
      type: unit.type,
      description: unit.description ?? "",
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

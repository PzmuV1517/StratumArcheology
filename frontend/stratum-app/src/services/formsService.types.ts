/**
 * @file
 * TypeScript type definitions for the forms service.
 *
 * Defines interfaces for context features, stratigraphic units,
 * artefact records, and form submission payloads.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
// Types for archaeological forms

/** Data record for a context or feature entry in an archaeological project. */
export interface ContextFeatureRecord {
  context_id?: string;
  feature_type?: string;
  description?: string;
  location?: string;
  dimensions?: {
    length?: number;
    width?: number;
    depth?: number;
  };
  soil_description?: string;
  interpretation?: string;
  notes?: string;
  [key: string]: any; // Allow additional fields
}

/** Data record for a stratigraphic unit in an archaeological project. */
export interface StratigraphicUnitRecord {
  unit_id?: string;
  context_id?: string;
  type?: "deposit" | "cut" | "fill" | "structure" | "interface" | string;
  description?: string;
  relationships?: {
    above?: string[];
    below?: string[];
    equal_to?: string[];
    cuts?: string[];
    cut_by?: string[];
  };
  matrix_position?: {
    x?: number;
    y?: number;
  };
  notes?: string;
  [key: string]: any;
}

/** Data record for an artefact found during excavation. */
export interface ArtefactRecord {
  artefact_id?: string;
  context_id?: string;
  material?: string;
  type?: string;
  description?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    weight?: number;
  };
  condition?: string;
  date_found?: string;
  finder?: string;
  storage_location?: string;
  notes?: string;
  [key: string]: any;
}

/** Response returned after saving a form record. */
export interface FormSaveResponse {
  id: number;
  project_id: number;
  created_at: string;
  [key: string]: any;
}

/**
 * @file
 * TypeScript type definitions for the forms service.
 *
 * Defines interfaces for context features, stratigraphic units,
 * artefact records, and form submission payloads.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
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

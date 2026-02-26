/**
 * @file
 * Harris Matrix registry data models.
 *
 * Defines TypeScript interfaces for stratigraphic units,
 * relationships, and matrix node data.
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
// Auto-generated digitized models from Harris Matrix supplementary forms in /harris-matrix
// These interfaces capture the structure of archaeological recording sheets.

// Basic enumerations
export type Era = "BCE" | "CE";
export type DateType =
  | ""
  | "Absolute"
  | "Relative"
  | "Terminus Ante Quem"
  | "Terminus Post Quem";

export type FeatureType =
  | "pit"
  | "trench"
  | "house"
  | "grave"
  | "oven_hearth"
  | "other";
export type ContextShape = "circular" | "oval" | "rectangular" | "other";

export type StratigraphicUnitType =
  | "cut"
  | "deposit_fill"
  | "anthropic"
  | "natural"
  | "demolition"
  | "negative"
  | "construction"
  | "abandonment"
  | "other";

export interface ContextFeatureRecord {
  id: string; // Context identifier (e.g., 1001)
  featureNumber?: string; // Complex / Feature no.
  sector?: string;
  stratigraphicUnits?: string[]; // Associated SU IDs
  earlierThan?: string[]; // IDs earlier than this context
  laterThan?: string[]; // IDs later than this context
  featureType?: FeatureType;
  location?: string;
  dimensions?: {
    length?: number;
    width?: number;
    depth?: number;
    areaSurfaceSection?: number;
  };
  gridSquare?: string;
  coordinates?: { x?: number; y?: number; zMasl?: number };
  shape?: ContextShape;
  orientation?: string;
  findsPresent?: {
    pottery?: boolean;
    metal?: boolean;
    flint?: boolean;
    stone?: boolean;
    wood?: boolean;
    charcoal?: boolean;
    shell?: boolean;
    snail?: boolean;
    ash?: boolean;
    adobe?: boolean;
    beads?: boolean;
    pendant?: boolean;
    ring?: boolean;
    seed?: boolean;
    animalBones?: boolean;
    humanBones?: boolean;
    other?: boolean;
  };
  description?: string;
  documentation?: {
    drawing?: boolean;
    plan?: boolean;
    photogrammetry?: boolean;
    photos?: boolean;
    video?: boolean;
    planNumber?: string;
  };
  samples?: {
    environmental?: boolean;
    bagNo?: string;
    quantity?: number;
    aDNA?: boolean;
    c14?: boolean;
    isotopic?: boolean;
    other?: boolean;
    otherType?: string;
    sampleEntries?: SampleEntry[];
  };
  author?: string;
  dateCreated?: string;
  checkedBy?: string;
  dateChecked?: string;
}

export interface StratigraphicUnitRecord {
  id: string; // SU identifier
  sector?: string;
  complexFeatureNo?: string; // Link back to feature
  earlierThan?: string[];
  laterThan?: string[];
  unitType?: StratigraphicUnitType;
  location?: string;
  dimensions?: {
    length?: number;
    thickness?: number;
    depth?: number;
    areaSurface?: number;
  };
  orientation?: string;
  structure?: {
    compaction?: "dry" | "wet" | "soft" | "very_soft" | "compact" | "medium";
    colour?: string;
    munsellCode?: string;
    homogeneous?: boolean;
    heterogeneous?: boolean;
  };
  composition?: {
    pottery?: boolean;
    flint?: boolean;
    stone?: boolean;
    wood?: boolean;
    charcoal?: boolean;
    shell?: boolean;
    snail?: boolean;
    ash?: boolean;
    adobe?: boolean;
    metal?: boolean;
    organic?: boolean;
    mineral?: boolean;
    gravels?: boolean;
    silt?: boolean;
    sand?: boolean;
    argil?: boolean;
    loess?: boolean;
    mud?: boolean;
    other?: boolean;
    otherDescription?: string;
  };
  granulation?: "high" | "medium" | "low";
  contaminationRisk?: "high" | "medium" | "low";
  bones?: boolean;
  seed?: boolean;
  perturbation?: {
    natural?: boolean;
    anthropic?: boolean;
    burrow?: boolean;
    roots?: boolean;
    other?: boolean;
    otherType?: string;
  };
  description?: string;
  documentation?: {
    drawing?: boolean;
    plan?: boolean;
    photogrammetry?: boolean;
    samples?: boolean;
    photos?: boolean;
    video?: boolean;
    planNumber?: string;
  };
  samples?: SampleEntry[];
  author?: string;
  dateCreated?: string;
  checkedBy?: string;
  dateChecked?: string;
}

export interface SampleEntry {
  id?: string;
  type?: string;
  bagNumber?: string;
  quantity?: number;
  notes?: string;
}

// Generic artefact registry row
export interface ArtefactRecord {
  id: string; // internal id
  number?: string; // NO.
  category: ArtefactCategory;
  type?: string;
  complexFeature?: string; // Complex / Feature
  areaSurface?: string;
  gridSquare?: string;
  depth?: string;
  stratigraphicUnit?: string; // SU
  quantity?: number;
  otherObservations?: string;
}

export type ArtefactCategory =
  | "pottery"
  | "hard_animal_material"
  | "clay_artefact"
  | "metal_artefact"
  | "pot"
  | "figurine"
  | "sample"
  | "animal_bone"
  | "ceramic_fragment"
  | "lithic"
  | "small_find";

export interface ArtefactRegistries {
  pottery: ArtefactRecord[];
  lithic: ArtefactRecord[];
  hard_animal_material: ArtefactRecord[];
  clay_artefact: ArtefactRecord[];
  metal_artefact: ArtefactRecord[];
  pot: ArtefactRecord[];
  figurine: ArtefactRecord[];
  sample: ArtefactRecord[];
  animal_bone: ArtefactRecord[];
  ceramic_fragment: ArtefactRecord[];
  small_find: ArtefactRecord[];
}

export function createEmptyRegistries(): ArtefactRegistries {
  return {
    pottery: [],
    lithic: [],
    hard_animal_material: [],
    clay_artefact: [],
    metal_artefact: [],
    pot: [],
    figurine: [],
    sample: [],
    animal_bone: [],
    ceramic_fragment: [],
    small_find: [],
  };
}

export interface ExtendedMatrixDataPayload {
  contexts: any[];
  relationships: any[];
  groups: any[];
  subGroups: any[];
  phases: any[];
  contextForms: [string, ContextFeatureRecord][];
  stratigraphicUnits: [string, StratigraphicUnitRecord][];
  artefacts: ArtefactRegistries;
}

// Helper to migrate old storage blobs gracefully
export function normalizeLoadedData(raw: any): {
  contextForms: Map<string, ContextFeatureRecord>;
  stratigraphicUnits: Map<string, StratigraphicUnitRecord>;
  artefacts: ArtefactRegistries;
} {
  const contextForms = new Map<string, ContextFeatureRecord>(
    (raw.contextForms || []).map(
      (pair: any) => pair as [string, ContextFeatureRecord],
    ),
  );
  const stratigraphicUnits = new Map<string, StratigraphicUnitRecord>(
    (raw.stratigraphicUnits || []).map(
      (pair: any) => pair as [string, StratigraphicUnitRecord],
    ),
  );
  const artefacts: ArtefactRegistries = raw.artefacts || createEmptyRegistries();
  // Ensure all categories exist
  const empty = createEmptyRegistries();
  (Object.keys(empty) as (keyof ArtefactRegistries)[]).forEach((k) => {
    if (!artefacts[k]) artefacts[k] = [];
  });
  return { contextForms, stratigraphicUnits, artefacts };
}

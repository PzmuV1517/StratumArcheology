// Types for archaeological forms

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

export interface StratigraphicUnitRecord {
  unit_id?: string;
  context_id?: string;
  type?: 'deposit' | 'cut' | 'fill' | 'structure' | 'interface' | string;
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

export interface FormSaveResponse {
  id: number;
  project_id: number;
  created_at: string;
  [key: string]: any;
}

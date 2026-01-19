import api from './api';
import {
  ContextFeatureRecord,
  StratigraphicUnitRecord,
  ArtefactRecord,
  FormSaveResponse,
} from './formsService.types';

/**
 * Forms service for archaeological data entry
 * Works on both web and native platforms
 */
export const formsService = {
  /**
   * Save a context/feature record
   */
  saveContextFeature: async (
    projectId: string,
    record: ContextFeatureRecord
  ): Promise<FormSaveResponse> => {
    const res = await api.post(`/forms/project/${projectId}/context-feature`, record);
    return res.data;
  },

  /**
   * Save a stratigraphic unit record
   */
  saveStratigraphicUnit: async (
    projectId: string,
    record: StratigraphicUnitRecord
  ): Promise<FormSaveResponse> => {
    const res = await api.post(`/forms/project/${projectId}/stratigraphic-unit`, record);
    return res.data;
  },

  /**
   * Save an artefact record
   */
  saveArtefact: async (projectId: string, record: ArtefactRecord): Promise<FormSaveResponse> => {
    const res = await api.post(`/forms/project/${projectId}/artefact`, record);
    return res.data;
  },

  /**
   * Get all context/features for a project
   */
  getContextFeatures: async (projectId: string): Promise<ContextFeatureRecord[]> => {
    const res = await api.get(`/forms/project/${projectId}/context-features`);
    return res.data;
  },

  /**
   * Get all stratigraphic units for a project
   */
  getStratigraphicUnits: async (projectId: string): Promise<StratigraphicUnitRecord[]> => {
    const res = await api.get(`/forms/project/${projectId}/stratigraphic-units`);
    return res.data;
  },

  /**
   * Get all artefacts for a project
   */
  getArtefacts: async (projectId: string): Promise<ArtefactRecord[]> => {
    const res = await api.get(`/forms/project/${projectId}/artefacts`);
    return res.data;
  },
};

export type {
  ContextFeatureRecord,
  StratigraphicUnitRecord,
  ArtefactRecord,
  FormSaveResponse,
} from './formsService.types';

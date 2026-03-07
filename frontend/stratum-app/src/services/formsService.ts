/**
 * @file
 * Archaeological forms service.
 *
 * Provides functions for submitting context features, stratigraphic units,
 * and artefact records to the backend API.
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
import api from "./api";
import {
  ContextFeatureRecord,
  StratigraphicUnitRecord,
  ArtefactRecord,
  FormSaveResponse,
} from "./formsService.types";

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
    record: ContextFeatureRecord,
  ): Promise<FormSaveResponse> => {
    const res = await api.post(
      `/forms/project/${projectId}/context-feature`,
      record,
    );
    return res.data;
  },

  /**
   * Save a stratigraphic unit record
   */
  saveStratigraphicUnit: async (
    projectId: string,
    record: StratigraphicUnitRecord,
  ): Promise<FormSaveResponse> => {
    const res = await api.post(
      `/forms/project/${projectId}/stratigraphic-unit`,
      record,
    );
    return res.data;
  },

  /**
   * Save an artefact record
   */
  saveArtefact: async (
    projectId: string,
    record: ArtefactRecord,
  ): Promise<FormSaveResponse> => {
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
  getStratigraphicUnits: async (
    projectId: string,
  ): Promise<StratigraphicUnitRecord[]> => {
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
} from "./formsService.types";

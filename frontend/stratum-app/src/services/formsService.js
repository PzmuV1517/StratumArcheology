import api from "./api";

export const formsService = {
  saveContextFeature: async (projectId, record) => {
    const res = await api.post(
      `/forms/project/${projectId}/context-feature`,
      record,
    );
    return res.data;
  },
  saveStratigraphicUnit: async (projectId, record) => {
    const res = await api.post(
      `/forms/project/${projectId}/stratigraphic-unit`,
      record,
    );
    return res.data;
  },
  saveArtefact: async (projectId, record) => {
    const res = await api.post(`/forms/project/${projectId}/artefact`, record);
    return res.data;
  },
};

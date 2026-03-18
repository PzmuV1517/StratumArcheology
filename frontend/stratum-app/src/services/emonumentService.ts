import api from "./api";

export interface EMonumentFormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  multiple: boolean;
  options?: string[];
}

export interface EMonumentFormSection {
  key: string;
  label: string;
  required: boolean;
  fields: EMonumentFormField[];
  subsections: EMonumentFormSection[];
}

export interface EMonumentSchemaResponse {
  sections: EMonumentFormSection[];
}

export interface EMonumentValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface EMonumentValidationResponse {
  valid: boolean;
  errors: EMonumentValidationIssue[];
}

export interface EMonumentMonument {
  id: string;
  lmi_code: string;
  name: string;
  county?: string | null;
  locality?: string | null;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  status?: string | null;
}

export interface EMonumentInstance {
  id: string;
  monument_id: string;
  user_id?: string | null;
  device_id?: string | null;
  status:
    | "draft"
    | "completat"
    | "finalizat"
    | "in_verificare"
    | "in_aprobare"
    | "validat"
    | "reintors";
  data: Record<string, unknown>;
  version: number;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export type EMonumentInstanceStatus = EMonumentInstance["status"];

export const emonumentService = {
  getFormSchema: async (): Promise<EMonumentSchemaResponse> => {
    const res = await api.get("/emonument/form-schema");
    return res.data;
  },

  validatePayload: async (
    data: Record<string, unknown>,
    strict = false,
  ): Promise<EMonumentValidationResponse> => {
    const res = await api.post("/emonument/validate", { data, strict });
    return res.data;
  },

  listMonuments: async (q?: string): Promise<EMonumentMonument[]> => {
    const res = await api.get("/emonument/monuments", {
      params: q ? { q } : undefined,
    });
    return res.data;
  },

  listInstances: async (): Promise<EMonumentInstance[]> => {
    const res = await api.get("/emonument/instances");
    return res.data;
  },

  createInstance: async (
    monumentCode: string,
    data: Record<string, unknown>,
  ): Promise<EMonumentInstance> => {
    const res = await api.post("/emonument/instances", {
      monument_code: monumentCode,
      data,
    });
    return res.data;
  },

  updateInstance: async (
    instanceId: string,
    data: Record<string, unknown>,
    status?: EMonumentInstanceStatus,
  ): Promise<EMonumentInstance> => {
    const res = await api.patch(`/emonument/instances/${instanceId}`, {
      data,
      status,
    });
    return res.data;
  },

  submitForVerification: async (instanceId: string): Promise<EMonumentInstance> => {
    const res = await api.post(`/emonument/instances/${instanceId}/submit`);
    return res.data;
  },
};

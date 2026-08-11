import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

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
  is_offline_draft?: boolean;
}

export type EMonumentInstanceStatus = EMonumentInstance["status"];

interface OfflineDraftRecord {
  id: string;
  data: Record<string, unknown>;
  hasPendingData: boolean;
  status: EMonumentInstanceStatus;
  queuedForReview: boolean;
  created_at: string;
  updated_at: string;
}

const OFFLINE_DRAFTS_KEY = "emonument_mobile_offline_drafts_v1";
const SCHEMA_CACHE_KEY = "emonument_mobile_schema_cache_v1";
const INSTANCES_CACHE_KEY = "emonument_mobile_instances_cache_v1";

const createLocalDraftId = (): string => {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isMobilePlatform = Platform.OS === "ios" || Platform.OS === "android";

const isOfflineError = (error: any): boolean => {
  return Boolean(error?.isNetworkError || error?.isTimeout || !error?.response);
};

const readOfflineDrafts = async (): Promise<OfflineDraftRecord[]> => {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_DRAFTS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeOfflineDrafts = async (drafts: OfflineDraftRecord[]): Promise<void> => {
  await AsyncStorage.setItem(OFFLINE_DRAFTS_KEY, JSON.stringify(drafts));
};

const readCachedInstances = async (): Promise<EMonumentInstance[]> => {
  try {
    const raw = await AsyncStorage.getItem(INSTANCES_CACHE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCachedInstances = async (
  instances: EMonumentInstance[],
): Promise<void> => {
  await AsyncStorage.setItem(INSTANCES_CACHE_KEY, JSON.stringify(instances));
};

const upsertOfflineDraft = async (
  id: string,
  data: Record<string, unknown>,
  status: EMonumentInstanceStatus,
  queuedForReview: boolean,
  hasPendingData = true,
): Promise<OfflineDraftRecord> => {
  const drafts = await readOfflineDrafts();
  const index = drafts.findIndex((draft) => draft.id === id);
  const nowIso = new Date().toISOString();

  const nextRecord: OfflineDraftRecord = {
    id,
    data,
    hasPendingData,
    status,
    queuedForReview,
    created_at: index >= 0 ? drafts[index].created_at : nowIso,
    updated_at: nowIso,
  };

  if (index >= 0) {
    drafts[index] = nextRecord;
  } else {
    drafts.push(nextRecord);
  }

  await writeOfflineDrafts(drafts);
  return nextRecord;
};

const removeOfflineDraft = async (id: string): Promise<void> => {
  const drafts = await readOfflineDrafts();
  const filtered = drafts.filter((draft) => draft.id !== id);
  await writeOfflineDrafts(filtered);
};

const toOfflineInstance = (draft: OfflineDraftRecord): EMonumentInstance => {
  return {
    id: draft.id,
    monument_id: "",
    status: draft.status,
    data: draft.data,
    version: 1,
    rejection_reason: null,
    created_at: draft.created_at,
    updated_at: draft.updated_at,
    is_offline_draft: true,
  };
};

const mergeOnlineAndOffline = (
  online: EMonumentInstance[],
  offlineDrafts: OfflineDraftRecord[],
): EMonumentInstance[] => {
  const offlineById = new Map(offlineDrafts.map((draft) => [draft.id, draft]));

  const mergedOnline = online.map((instance) => {
    const offline = offlineById.get(instance.id);
    if (!offline) {
      return instance;
    }
    return {
      ...instance,
      data: offline.data,
      status: offline.status,
      updated_at: offline.updated_at,
      is_offline_draft: true,
    };
  });

  const localOnly = offlineDrafts
    .filter((draft) => draft.id.startsWith("local-"))
    .map(toOfflineInstance);

  return [...localOnly, ...mergedOnline];
};

export const emonumentService = {
  getFormSchema: async (): Promise<EMonumentSchemaResponse> => {
    try {
      const res = await api.get("/emonument/form-schema");
      if (isMobilePlatform) {
        await AsyncStorage.setItem(SCHEMA_CACHE_KEY, JSON.stringify(res.data));
      }
      return res.data;
    } catch (error: any) {
      if (isMobilePlatform && isOfflineError(error)) {
        const cached = await AsyncStorage.getItem(SCHEMA_CACHE_KEY);
        if (cached) {
          return JSON.parse(cached);
        }
      }
      throw error;
    }
  },

  validatePayload: async (
    data: Record<string, unknown>,
    strict = false,
  ): Promise<EMonumentValidationResponse> => {
    try {
      const res = await api.post("/emonument/validate", { data, strict });
      return res.data;
    } catch (error: any) {
      if (isMobilePlatform && isOfflineError(error)) {
        return {
          valid: true,
          errors: [],
        };
      }
      throw error;
    }
  },

  listInstances: async (): Promise<EMonumentInstance[]> => {
    if (!isMobilePlatform) {
      const res = await api.get("/emonument/instances");
      return res.data;
    }

    try {
      const res = await api.get("/emonument/instances");
      const offlineDrafts = await readOfflineDrafts();
      const merged = mergeOnlineAndOffline(res.data || [], offlineDrafts);
      await writeCachedInstances(merged);
      return merged;
    } catch (error: any) {
      if (isOfflineError(error)) {
        const cached = await readCachedInstances();
        const offlineDrafts = await readOfflineDrafts();
        return mergeOnlineAndOffline(cached, offlineDrafts);
      }
      throw error;
    }
  },

  createInstance: async (
    data: Record<string, unknown>,
  ): Promise<EMonumentInstance> => {
    try {
      const res = await api.post("/emonument/instances", {
        data,
      });
      return res.data;
    } catch (error: any) {
      if (isMobilePlatform && isOfflineError(error)) {
        const localId = createLocalDraftId();
        const draft = await upsertOfflineDraft(localId, data, "draft", false, true);
        return toOfflineInstance(draft);
      }
      throw error;
    }
  },

  updateInstance: async (
    instanceId: string,
    data: Record<string, unknown>,
    status?: EMonumentInstanceStatus,
  ): Promise<EMonumentInstance> => {
    const nextStatus = status || "draft";

    if (isMobilePlatform && instanceId.startsWith("local-")) {
      const draft = await upsertOfflineDraft(
        instanceId,
        data,
        nextStatus,
        false,
        true,
      );
      return toOfflineInstance(draft);
    }

    try {
      const res = await api.patch(`/emonument/instances/${instanceId}`, {
        data,
        status,
      });
      return res.data;
    } catch (error: any) {
      if (isMobilePlatform && isOfflineError(error)) {
        const draft = await upsertOfflineDraft(
          instanceId,
          data,
          nextStatus,
          false,
          true,
        );
        return toOfflineInstance(draft);
      }
      throw error;
    }
  },

  submitForVerification: async (instanceId: string): Promise<EMonumentInstance> => {
    if (isMobilePlatform && instanceId.startsWith("local-")) {
      const drafts = await readOfflineDrafts();
      const existing = drafts.find((draft) => draft.id === instanceId);
      const fallbackData = existing?.data || {};
      const fallbackStatus = existing?.status || "completat";
      const draft = await upsertOfflineDraft(
        instanceId,
        fallbackData,
        fallbackStatus,
        true,
        Boolean(existing?.hasPendingData),
      );
      return toOfflineInstance(draft);
    }

    try {
      const res = await api.post(`/emonument/instances/${instanceId}/submit`);
      return res.data;
    } catch (error: any) {
      if (isMobilePlatform && isOfflineError(error)) {
        const drafts = await readOfflineDrafts();
        const existing = drafts.find((draft) => draft.id === instanceId);
        const fallbackData = existing?.data || {};
        const fallbackStatus = existing?.status || "completat";
        const draft = await upsertOfflineDraft(
          instanceId,
          fallbackData,
          fallbackStatus,
          true,
          Boolean(existing?.hasPendingData),
        );
        return toOfflineInstance(draft);
      }
      throw error;
    }
  },

  deleteInstance: async (instanceId: string): Promise<void> => {
    if (isMobilePlatform && instanceId.startsWith("local-")) {
      await removeOfflineDraft(instanceId);
      return;
    }

    try {
      await api.delete(`/emonument/instances/${instanceId}`);
      if (isMobilePlatform) {
        await removeOfflineDraft(instanceId);
      }
    } catch (error: any) {
      if (isMobilePlatform && isOfflineError(error)) {
        await removeOfflineDraft(instanceId);
        return;
      }
      throw error;
    }
  },

  syncOfflineDrafts: async (): Promise<void> => {
    if (!isMobilePlatform) {
      return;
    }

    const drafts = await readOfflineDrafts();
    if (drafts.length === 0) {
      return;
    }

    const remaining: OfflineDraftRecord[] = [];

    for (const draft of drafts) {
      let current = { ...draft };

      try {
        if (current.id.startsWith("local-")) {
          const createdRes = await api.post("/emonument/instances", {
            data: current.data,
          });
          current.id = createdRes.data.id;
        }

        if (current.hasPendingData || current.id.startsWith("local-")) {
          await api.patch(`/emonument/instances/${current.id}`, {
            data: current.data,
            status: current.status,
          });
        }

        if (current.queuedForReview) {
          await api.post(`/emonument/instances/${current.id}/submit`);
        }
      } catch (error: any) {
        if (isOfflineError(error)) {
          remaining.push(current);
          continue;
        }
        throw error;
      }
    }

    await writeOfflineDrafts(remaining);
  },
};

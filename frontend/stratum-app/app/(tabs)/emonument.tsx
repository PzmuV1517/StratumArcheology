import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import { useAuth } from "@/contexts/AuthContext";
import MonumentPinPicker from "@/components/map/MonumentPinPicker";
import {
  emonumentService,
  EMonumentFormField,
  EMonumentFormSection,
  EMonumentInstance,
  EMonumentInstanceStatus,
  EMonumentValidationIssue,
} from "@/services/emonumentService";

function isFilledValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function findMonumentCodeInData(value: unknown): string {
  const scan = (node: unknown): string => {
    if (!node) return "";

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = scan(item);
        if (found) return found;
      }
      return "";
    }

    if (typeof node !== "object") {
      return "";
    }

    const entries = Object.entries(node as Record<string, unknown>);

    for (const [key, entryValue] of entries) {
      if (typeof entryValue !== "string") continue;
      const normalizedKey = key.toLowerCase();
      const isCodeLikeKey =
        normalizedKey.includes("lmi") ||
        normalizedKey.includes("rz") ||
        (normalizedKey.includes("cod") && (normalizedKey.includes("zp") || normalizedKey.includes("clasare")));
      if (isCodeLikeKey && entryValue.trim()) {
        return entryValue.trim();
      }
    }

    for (const [, entryValue] of entries) {
      const found = scan(entryValue);
      if (found) return found;
    }

    return "";
  };

  return scan(value);
}

export default function EMonumentHiddenTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [schema, setSchema] = useState<EMonumentFormSection[]>([]);
  const [instances, setInstances] = useState<EMonumentInstance[]>([]);

  const [showEditor, setShowEditor] = useState(false);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [initialEditorSnapshot, setInitialEditorSnapshot] = useState("{}");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationIssues, setValidationIssues] = useState<EMonumentValidationIssue[]>([]);
  const [instanceQuery, setInstanceQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EMonumentInstanceStatus>("all");
  const [expandedSectionKeys, setExpandedSectionKeys] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [syncingOfflineDrafts, setSyncingOfflineDrafts] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const syncInFlightRef = useRef(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 1200;

  const canAccess = useMemo(
    () => Boolean(user?.is_emonument_privileged || user?.is_dashboard_admin),
    [user?.is_emonument_privileged, user?.is_dashboard_admin],
  );

  const sectionProgress = useMemo(() => {
    return schema.map((section) => {
      let total = 0;
      let filled = 0;

      for (const field of section.fields) {
        total += 1;
        const sectionData = (formData[section.key] as Record<string, unknown> | undefined) || {};
        if (isFilledValue(sectionData[field.key])) {
          filled += 1;
        }
      }

      for (const sub of section.subsections) {
        const sectionData = (formData[section.key] as Record<string, unknown> | undefined) || {};
        const subData = (sectionData[sub.key] as Record<string, unknown> | undefined) || {};
        for (const field of sub.fields) {
          total += 1;
          if (isFilledValue(subData[field.key])) {
            filled += 1;
          }
        }
      }

      return {
        key: section.key,
        label: section.label,
        total,
        filled,
      };
    });
  }, [schema, formData]);

  const overallProgress = useMemo(() => {
    const total = sectionProgress.reduce((sum, section) => sum + section.total, 0);
    const filled = sectionProgress.reduce((sum, section) => sum + section.filled, 0);
    const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
    return { total, filled, percent };
  }, [sectionProgress]);

  const filteredInstances = useMemo(() => {
    const query = instanceQuery.trim().toLowerCase();
    return [...instances]
      .filter((instance) => (statusFilter === "all" ? true : instance.status === statusFilter))
      .filter((instance) => {
        if (!query) return true;
        const code = findMonumentCodeInData(instance.data).toLowerCase();
        return code.includes(query) || instance.id.toLowerCase().includes(query);
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [instances, statusFilter, instanceQuery]);

  const editingInstance = useMemo(
    () =>
      editingInstanceId
        ? instances.find((instance) => instance.id === editingInstanceId) || null
        : null,
    [instances, editingInstanceId],
  );

  const isEditingDraft = editingInstance?.status === "draft";
  const canEditCurrentForm = !editingInstance || editingInstance.status === "draft";

  const buildSchemaSkeleton = useCallback((sections: EMonumentFormSection[]) => {
    const root: Record<string, unknown> = {};
    for (const section of sections) {
      const sectionPayload: Record<string, unknown> = {};
      for (const subsection of section.subsections) {
        sectionPayload[subsection.key] = {};
      }
      root[section.key] = sectionPayload;
    }
    return root;
  }, []);

  const buildAutoFillValue = useCallback(
    (
      sectionPath: string,
      field: EMonumentFormField,
    ): unknown => {
      const fieldPath = `${sectionPath}.${field.key}`;

      if (fieldPath === "stare_conservare_riscuri.probabilitate") {
        return 2;
      }
      if (fieldPath === "stare_conservare_riscuri.grad") {
        return 3;
      }
      if (fieldPath === "stare_conservare_riscuri.nivel_risc") {
        return 6;
      }

      let candidateValue: unknown;

      if (field.type === "select") {
        if (field.key === "tip_istoric_clasare") {
          candidateValue = field.options?.includes("oficiala_actuala")
            ? "oficiala_actuala"
            : field.options?.[0] || "oficiala_actuala";
        } else {
          candidateValue = field.options?.[0] || "valoare_test";
        }
      } else if (field.type === "multi_select") {
        candidateValue = field.options?.length ? [field.options[0]] : ["valoare_test"];
      } else if (field.type === "number") {
        candidateValue = 1;
      } else if (field.type === "date") {
        candidateValue = "2026-03-18";
      } else if (field.type === "long_text") {
        candidateValue = `Test valid pentru ${field.label}`;
      } else {
        candidateValue = `Test ${field.label}`;
      }

      if (field.multiple && !Array.isArray(candidateValue)) {
        return [candidateValue];
      }

      return candidateValue;
    },
    [],
  );

  const buildAutoFillSectionPayload = useCallback(
    (section: EMonumentFormSection, sectionPath: string): Record<string, unknown> => {
      const payload: Record<string, unknown> = {};

      for (const field of section.fields) {
        payload[field.key] = buildAutoFillValue(sectionPath, field);
      }

      for (const subsection of section.subsections) {
        payload[subsection.key] = buildAutoFillSectionPayload(
          subsection,
          `${sectionPath}.${subsection.key}`,
        );
      }

      return payload;
    },
    [buildAutoFillValue],
  );

  const buildAutoFillPayload = useCallback(
    (sections: EMonumentFormSection[]): Record<string, unknown> => {
      const root: Record<string, unknown> = {};

      for (const section of sections) {
        root[section.key] = buildAutoFillSectionPayload(section, section.key);
      }

      return root;
    },
    [buildAutoFillSectionPayload],
  );

  const syncOfflineDraftsIfPossible = useCallback(async () => {
    if (Platform.OS === "web" || syncInFlightRef.current) {
      return;
    }

    syncInFlightRef.current = true;
    setSyncingOfflineDrafts(true);
    try {
      await emonumentService.syncOfflineDrafts();
    } finally {
      syncInFlightRef.current = false;
      setSyncingOfflineDrafts(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      await syncOfflineDraftsIfPossible();

      const [schemaRes, instancesRes] = await Promise.all([
        emonumentService.getFormSchema(),
        emonumentService.listInstances(),
      ]);
      setIsAuthorized(true);
      setSchema(schemaRes.sections || []);
      setInstances(instancesRes || []);
      setSelectedInstanceIds((prev) => {
        const ids = new Set((instancesRes || []).map((i) => i.id));
        return prev.filter((id) => ids.has(id));
      });
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        setIsAuthorized(false);
      }
    } finally {
      setLoading(false);
    }
  }, [syncOfflineDraftsIfPossible]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    void NetInfo.fetch().then((state) => {
      const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
      setIsOffline(!online);
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
      setIsOffline(!online);
      if (!online) {
        return;
      }

      void (async () => {
        await syncOfflineDraftsIfPossible();
        await load();
      })();
    });

    return () => {
      unsubscribe();
    };
  }, [load, syncOfflineDraftsIfPossible]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const runStrictValidation = useCallback(async () => {
    setValidationIssues([]);
    try {
      const res = await emonumentService.validatePayload(formData, true);
      setValidationIssues(res.errors || []);
      return res.valid;
    } catch {
      return false;
    }
  }, [formData]);

  const openNewForm = useCallback(() => {
    setEditingInstanceId(null);
    const nextData = buildSchemaSkeleton(schema);
    setFormData(nextData);
    setInitialEditorSnapshot(JSON.stringify(nextData));
    setValidationIssues([]);
    setExpandedSectionKeys(schema[0]?.key ? [schema[0].key] : []);
    setShowEditor(true);
  }, [buildSchemaSkeleton, schema]);

  const openExisting = useCallback((instance: EMonumentInstance) => {
    const nextData = (instance.data as Record<string, unknown>) || {};
    setEditingInstanceId(instance.id);
    setFormData(nextData);
    setInitialEditorSnapshot(JSON.stringify(nextData));
    setValidationIssues([]);
    setExpandedSectionKeys(schema[0]?.key ? [schema[0].key] : []);
    setShowEditor(true);
  }, [schema]);

  const closeEditor = useCallback(() => {
    setShowEditor(false);
    setEditingInstanceId(null);
    setFormData({});
    setInitialEditorSnapshot("{}");
    setValidationIssues([]);
    setExpandedSectionKeys([]);
  }, []);

  const hasUnsavedChanges = useMemo(() => {
    if (!showEditor || !canEditCurrentForm || saving || submitting) {
      return false;
    }

    return JSON.stringify(formData) !== initialEditorSnapshot;
  }, [showEditor, canEditCurrentForm, saving, submitting, formData, initialEditorSnapshot]);

  const requestCloseEditor = useCallback(() => {
    if (saving || submitting) {
      return;
    }

    if (!hasUnsavedChanges) {
      closeEditor();
      return;
    }

    const warningMessage = "Ai modificari nesalvate. Daca inchizi acum, progresul se va pierde.";

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const shouldDiscard = window.confirm(warningMessage);
      if (shouldDiscard) {
        closeEditor();
      }
      return;
    }

    Alert.alert(
      "Renunti la modificarile nesalvate?",
      warningMessage,
      [
        { text: "Continua editarea", style: "cancel" },
        {
          text: "Inchide fara salvare",
          style: "destructive",
          onPress: closeEditor,
        },
      ],
    );
  }, [hasUnsavedChanges, saving, submitting, closeEditor]);

  const toggleSection = useCallback((sectionKey: string) => {
    setExpandedSectionKeys((prev) =>
      prev.includes(sectionKey)
        ? prev.filter((key) => key !== sectionKey)
        : [...prev, sectionKey],
    );
  }, []);

  const autoFillValidData = useCallback(() => {
    const nextData = buildAutoFillPayload(schema);
    setFormData(nextData);
    setValidationIssues([]);
  }, [buildAutoFillPayload, schema]);

  const setFieldValue = useCallback(
    (
      sectionKey: string,
      fieldKey: string,
      value: unknown,
      subsectionKey?: string,
    ) => {
      setFormData((prev) => {
        const next = { ...(prev as Record<string, any>) };
        const section = { ...(next[sectionKey] as Record<string, any> | undefined) };

        if (subsectionKey) {
          const sub = { ...(section[subsectionKey] as Record<string, any> | undefined) };
          sub[fieldKey] = value;
          section[subsectionKey] = sub;
        } else {
          section[fieldKey] = value;
        }

        next[sectionKey] = section;
        return next;
      });
    },
    [],
  );

  const saveDraft = useCallback(async () => {
    if (!canEditCurrentForm) {
      setValidationIssues([
        {
          path: "instance",
          code: "read_only",
          message: "Doar formularele in status draft pot fi editate.",
        },
      ]);
      return;
    }

    setValidationIssues([]);

    setSaving(true);
    try {
      if (editingInstanceId) {
        await emonumentService.updateInstance(
          editingInstanceId,
          formData,
          isEditingDraft ? ("draft" as EMonumentInstanceStatus) : undefined,
        );
      } else {
        const created = await emonumentService.createInstance(formData);
        setEditingInstanceId(created.id);
      }
      setInitialEditorSnapshot(JSON.stringify(formData));
      setValidationIssues([]);
      await load();
    } catch (error: any) {
      const apiErrors = error?.response?.data?.detail?.errors;
      if (Array.isArray(apiErrors)) {
        setValidationIssues(apiErrors);
      } else {
        const detail = error?.response?.data?.detail;
        const message =
          (typeof detail === "string" && detail) ||
          (typeof detail?.message === "string" && detail.message) ||
          error?.message ||
          "Salvarea formularului a esuat.";
        setValidationIssues([
          {
            path: "instance",
            code: "save_failed",
            message,
          },
        ]);
      }
    } finally {
      setSaving(false);
    }
  }, [canEditCurrentForm, editingInstanceId, formData, load, isEditingDraft]);

  const submitForVerification = useCallback(async () => {
    if (!canEditCurrentForm) {
      setValidationIssues([
        {
          path: "instance",
          code: "read_only",
          message: "Doar formularele in status draft pot fi editate.",
        },
      ]);
      return;
    }

    setValidationIssues([]);

    setSubmitting(true);
    try {
      const valid = await runStrictValidation();
      if (!valid) {
        return;
      }

      let instanceId = editingInstanceId;
      if (!instanceId) {
        const created = await emonumentService.createInstance(formData);
        instanceId = created.id;
        setEditingInstanceId(created.id);
      }

      await emonumentService.updateInstance(
        instanceId,
        formData,
        "completat" as EMonumentInstanceStatus,
      );
      const submitResult = await emonumentService.submitForVerification(instanceId);

      await load();
      closeEditor();
      if (Platform.OS !== "web" && submitResult?.is_offline_draft) {
        Alert.alert(
          "Fara internet",
          "Formularul a fost salvat local ca draft si va fi trimis automat in verificare cand revine conexiunea.",
        );
      }
    } catch (error: any) {
      const apiErrors = error?.response?.data?.detail?.errors;
      if (Array.isArray(apiErrors)) {
        setValidationIssues(apiErrors);
      } else {
        const detail = error?.response?.data?.detail;
        const message =
          (typeof detail === "string" && detail) ||
          (typeof detail?.message === "string" && detail.message) ||
          error?.message ||
          "Trimiterea formularului a esuat.";
        setValidationIssues([
          {
            path: "instance",
            code: "submit_failed",
            message,
          },
        ]);
      }
    } finally {
      setSubmitting(false);
    }
  }, [canEditCurrentForm, runStrictValidation, editingInstanceId, formData, load, closeEditor]);

  const deleteInstance = useCallback(async (instanceId: string) => {
    try {
      await emonumentService.deleteInstance(instanceId);
      if (editingInstanceId === instanceId) {
        closeEditor();
      }
      await load();
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      setValidationIssues([
        {
          path: "instance",
          code: "delete_failed",
          message: typeof detail === "string" ? detail : "Stergerea formularului a esuat.",
        },
      ]);
    }
  }, [closeEditor, editingInstanceId, load]);

  const toggleSelectMode = useCallback(() => {
    setIsSelectMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedInstanceIds([]);
      }
      return next;
    });
  }, []);

  const toggleInstanceSelection = useCallback((instanceId: string) => {
    setSelectedInstanceIds((prev) =>
      prev.includes(instanceId)
        ? prev.filter((id) => id !== instanceId)
        : [...prev, instanceId],
    );
  }, []);

  const confirmDeleteSelectedInstances = useCallback(() => {
    if (selectedInstanceIds.length === 0) {
      return;
    }

    const message = `Stergi ${selectedInstanceIds.length} formular(e)? Actiunea este ireversibila.`;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const ok = window.confirm(message);
      if (ok) {
        void (async () => {
          for (const id of selectedInstanceIds) {
            // Run sequentially so backend errors are surfaced deterministically.
            await deleteInstance(id);
          }
          setSelectedInstanceIds([]);
          setIsSelectMode(false);
        })();
      }
      return;
    }

    Alert.alert(
      "Sterge formulare",
      message,
      [
        { text: "Anuleaza", style: "cancel" },
        {
          text: "Sterge",
          style: "destructive",
          onPress: async () => {
            for (const id of selectedInstanceIds) {
              await deleteInstance(id);
            }
            setSelectedInstanceIds([]);
            setIsSelectMode(false);
          },
        },
      ],
    );
  }, [deleteInstance, selectedInstanceIds]);

  const renderFieldInput = useCallback(
    (
      section: EMonumentFormSection,
      field: EMonumentFormField,
      subsectionKey?: string,
    ) => {
      const sectionData = (formData[section.key] as Record<string, any>) || {};
      const holder = subsectionKey
        ? (sectionData[subsectionKey] as Record<string, any>) || {}
        : sectionData;
      const currentValue = holder[field.key];

      if (section.key === "localizare" && !subsectionKey && field.key === "pin") {
        return (
          <MonumentPinPicker
            value={currentValue}
            editable={canEditCurrentForm}
            monumentCoordinate={null}
            onChange={(nextValue) => setFieldValue(section.key, field.key, nextValue, subsectionKey)}
          />
        );
      }

      if (field.type === "select" && field.options?.length) {
        return (
          <View style={styles.optionsWrap}>
            {field.options.map((opt) => {
              const active = currentValue === opt;
              return (
                <TouchableOpacity
                  key={`${field.key}-${opt}`}
                  style={[styles.optionChip, active && styles.optionChipActive]}
                  disabled={!canEditCurrentForm}
                  onPress={() => setFieldValue(section.key, field.key, opt, subsectionKey)}
                >
                  <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }

      if (field.type === "multi_select" && field.options?.length) {
        const selected = Array.isArray(currentValue) ? currentValue : [];
        return (
          <View style={styles.optionsWrap}>
            {field.options.map((opt) => {
              const active = selected.includes(opt);
              return (
                <TouchableOpacity
                  key={`${field.key}-${opt}`}
                  style={[styles.optionChip, active && styles.optionChipActive]}
                  disabled={!canEditCurrentForm}
                  onPress={() => {
                    const next = active
                      ? selected.filter((x: string) => x !== opt)
                      : [...selected, opt];
                    setFieldValue(section.key, field.key, next, subsectionKey);
                  }}
                >
                  <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }

      const multiline = field.type === "long_text";
      const keyboardType = field.type === "number" ? "numeric" : "default";

      return (
        <TextInput
          style={[styles.input, multiline && styles.textArea]}
          multiline={multiline}
          keyboardType={keyboardType}
          value={currentValue == null ? "" : String(currentValue)}
          placeholder={field.label}
          placeholderTextColor="#777"
          editable={canEditCurrentForm}
          onChangeText={(text) => {
            const value = field.type === "number" ? Number(text) || 0 : text;
            setFieldValue(section.key, field.key, value, subsectionKey);
          }}
        />
      );
    },
    [formData, setFieldValue, canEditCurrentForm],
  );

  const renderSection = useCallback(
    (section: EMonumentFormSection) => {
      const progress = sectionProgress.find((item) => item.key === section.key);
      const isExpanded = expandedSectionKeys.includes(section.key);

      return (
        <View key={section.key} style={styles.formSectionCard}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection(section.key)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.formSectionTitle}>{section.label}</Text>
              <Text style={styles.sectionProgressText}>
                {progress?.filled || 0}/{progress?.total || 0} campuri completate
              </Text>
            </View>
            <Text style={styles.sectionToggle}>{isExpanded ? "Ascunde" : "Deschide"}</Text>
          </TouchableOpacity>

          {isExpanded ? (
            <>
              {section.fields.map((field) => (
                <View key={`${section.key}-${field.key}`} style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>
                    {field.label}
                    {field.required ? " *" : ""}
                  </Text>
                  {renderFieldInput(section, field)}
                </View>
              ))}

              {section.subsections.map((sub) => (
                <View key={`${section.key}-${sub.key}`} style={styles.subsectionWrap}>
                  <Text style={styles.subsectionTitle}>{sub.label}</Text>
                  {sub.fields.map((subField) => (
                    <View key={`${section.key}-${sub.key}-${subField.key}`} style={styles.fieldWrap}>
                      <Text style={styles.fieldLabel}>
                        {subField.label}
                        {subField.required ? " *" : ""}
                      </Text>
                      {renderFieldInput(section, subField, sub.key)}
                    </View>
                  ))}
                </View>
              ))}
            </>
          ) : null}
        </View>
      );
    },
    [expandedSectionKeys, renderFieldInput, sectionProgress, toggleSection],
  );

  const statusLabel = (status: EMonumentInstanceStatus) =>
    ({
      draft: "Draft",
      completat: "Completat",
      finalizat: "Finalizat",
      in_verificare: "In verificare",
      in_aprobare: "In aprobare",
      validat: "Validat",
      reintors: "Reintors",
    }[status] || status);

  const statusColor = (status: EMonumentInstanceStatus) =>
    ({
      draft: "#8D8D8D",
      completat: "#4DA3FF",
      finalizat: "#2FB7B7",
      in_verificare: "#FFC857",
      in_aprobare: "#FF9F1C",
      validat: "#4CAF50",
      reintors: "#FF5D73",
    }[status] || "#8D8D8D");

  const statusFilterLabel = (status: "all" | EMonumentInstanceStatus) =>
    ({
      all: "Toate",
      draft: "Draft",
      completat: "Completat",
      finalizat: "Finalizat",
      in_verificare: "Verif.",
      in_aprobare: "Aprobare",
      validat: "Valid.",
      reintors: "Ret.",
    }[status] || status);

  const renderFormCard = ({ item }: { item: EMonumentInstance }) => {
    const isSelected = selectedInstanceIds.includes(item.id);

    return (
    <TouchableOpacity
      style={[styles.formCard, isSelectMode && isSelected && styles.formCardSelected]}
      onPress={() => {
        if (isSelectMode) {
          toggleInstanceSelection(item.id);
        } else {
          openExisting(item);
        }
      }}
    >
      <View style={styles.formCardContent}>
        {(() => {
          const code = findMonumentCodeInData(item.data);
          return code ? <Text style={styles.formCardCodeTag}>{code}</Text> : null;
        })()}
        <Text style={styles.formCardTitle}>
          {"Formular eMonument"}
        </Text>
        <Text style={styles.formCardDescription}>
          Formular eMonument v{item.version}
        </Text>
        {item.status === "reintors" && item.rejection_reason ? (
          <Text style={styles.returnReasonText}>Motiv: {item.rejection_reason}</Text>
        ) : null}
        <View style={styles.formCardMeta}>
          <Text style={[styles.formCardStatus, { color: statusColor(item.status) }]}> 
            {statusLabel(item.status)}
          </Text>
          <Text style={styles.formCardDate}>
            {new Date(item.updated_at).toLocaleDateString()}
          </Text>
        </View>
        {item.is_offline_draft ? (
          <Text style={styles.offlineDraftText}>Nesincronizat: va fi trimis catre cloud automat cand revine conexiunea.</Text>
        ) : null}
        {isSelectMode ? (
          <View style={styles.formCardActions}>
            <Text style={styles.selectionHintText}>{isSelected ? "Selectat" : "Tap pentru selectare"}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
  };

  const renderEditorOverlay = (floating: boolean) => (
    <View style={[styles.editorOverlay, floating && styles.editorOverlayFloating]}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={requestCloseEditor}>
          <Text style={styles.modalAction}>Inchide</Text>
        </TouchableOpacity>
        <Text style={styles.modalTitle}>{editingInstanceId ? "Editare formular" : "Formular nou"}</Text>
        {__DEV__ ? (
          <TouchableOpacity style={styles.devFillButton} onPress={autoFillValidData}>
            <Text style={styles.devFillButtonText}>DEV: Autofill</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>

      <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Progres Formular</Text>
          <Text style={styles.progressSubtitle}>
            {overallProgress.filled}/{overallProgress.total} campuri completate ({overallProgress.percent}%)
          </Text>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${overallProgress.percent}%` }]} />
          </View>
        </View>

        {schema.map((section) => renderSection(section))}

        {validationIssues.length > 0 && (
          <View style={styles.issueList}>
            {validationIssues.map((issue, idx) => (
              <View key={`${issue.path}-${idx}`} style={styles.issueRow}>
                <Text style={styles.issuePath}>{issue.path}</Text>
                <Text style={styles.issueMessage}>{issue.message}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.editorActions}>
          {canEditCurrentForm ? (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, (saving || submitting) && styles.disabledButton]}
                disabled={saving || submitting}
                onPress={saveDraft}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? "Se salveaza..." : isEditingDraft ? "Update Draft" : "Salveaza Draft"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, styles.secondaryButton, (saving || submitting) && styles.disabledButton]}
                disabled={saving || submitting}
                onPress={submitForVerification}
              >
                <Text style={styles.primaryButtonText}>{submitting ? "Se trimite..." : "Trimite in verificare"}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.readOnlyBanner}>
              <Text style={styles.readOnlyBannerText}>Acest formular nu mai este editabil. Doar draft-urile pot fi editate.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#FF2A2A" />
        <Text style={styles.infoText}>Loading eMonument hidden tab...</Text>
      </View>
    );
  }

  if (!canAccess || !isAuthorized) {
    return (
      <View style={styles.centered}>
        <Text style={styles.blockTitle}>Not authorized</Text>
        <Text style={styles.infoText}>
          This area is available only for eMonument privileged users.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.workspace, isWide && styles.workspaceWide]}>
        <View style={[styles.leftPane, isWide && styles.leftPaneWide]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Formulare</Text>
            <Text style={styles.headerSubtitle}>Gestioneaza toate formularele eMonument</Text>
            {isOffline ? (
              <Text style={styles.offlineInfoText}>Offline: datele sunt salvate local si se sincronizeaza automat.</Text>
            ) : null}
            {syncingOfflineDrafts ? (
              <Text style={styles.syncInfoText}>Se sincronizeaza draft-urile locale...</Text>
            ) : null}
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={instanceQuery}
              placeholder="Search formulare..."
              placeholderTextColor="#777"
              onChangeText={setInstanceQuery}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersRow}
            contentContainerStyle={styles.subTabContainer}
          >
            {(["all", "draft", "in_verificare", "validat", "reintors"] as const).map((status) => {
              const active = statusFilter === status;
              return (
                <TouchableOpacity
                  key={status}
                  style={[styles.subTab, active && styles.subTabActive]}
                  onPress={() => setStatusFilter(status)}
                >
                  <Text style={[styles.subTabText, active && styles.subTabTextActive]}>
                    {statusFilterLabel(status)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.selectionBar}>
            <TouchableOpacity
              style={[styles.selectionModeButton, isSelectMode && styles.selectionModeButtonActive]}
              onPress={toggleSelectMode}
            >
              <Text style={[styles.selectionModeButtonText, isSelectMode && styles.selectionModeButtonTextActive]}>
                {isSelectMode ? "Cancel" : "Select"}
              </Text>
            </TouchableOpacity>
            {isSelectMode ? (
              <TouchableOpacity
                style={[styles.bulkDeleteButton, selectedInstanceIds.length === 0 && styles.bulkDeleteButtonDisabled]}
                onPress={confirmDeleteSelectedInstances}
                disabled={selectedInstanceIds.length === 0}
              >
                <Text style={styles.bulkDeleteButtonText}>Delete ({selectedInstanceIds.length})</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {filteredInstances.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Niciun formular</Text>
              <Text style={styles.emptySubtext}>Apasa pe + pentru a crea primul formular.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredInstances}
              renderItem={renderFormCard}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#FF2A2A"
                />
              }
            />
          )}

          <TouchableOpacity style={styles.fab} onPress={openNewForm}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </View>

        {isWide ? (
          <View style={[styles.editorPane, styles.editorPaneWide]}>
            <View style={styles.editorHost}>
              <View style={styles.emptyEditorState}>
                <Text style={styles.emptyEditorTitle}>Editor Formular</Text>
                <Text style={styles.infoText}>Apasa pe un formular din lista din stanga sau pe butonul + Formular Nou.</Text>
              </View>
            </View>

            {showEditor ? renderEditorOverlay(true) : null}
          </View>
        ) : null}
      </View>

      {!isWide ? (
        <Modal
          visible={showEditor}
          animationType="fade"
          transparent
          onRequestClose={requestCloseEditor}
        >
          <View style={styles.mobileModalRoot}>
            <Pressable style={styles.mobileModalBackdrop} onPress={requestCloseEditor} />
            <View style={styles.mobileSheetContainer}>{renderEditorOverlay(false)}</View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  workspace: {
    flex: 1,
  },
  workspaceWide: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  leftPane: {
    flex: 1,
    backgroundColor: "#111111",
  },
  leftPaneWide: {
    width: "44%",
    maxWidth: 640,
    borderRightWidth: 1,
    borderRightColor: "#242424",
  },
  editorPane: {
    flex: 1,
    backgroundColor: "#101010",
    position: "relative",
  },
  editorPaneWide: {
    width: "56%",
  },
  editorHost: {
    flex: 1,
  },
  editorOverlay: {
    flex: 1,
    backgroundColor: "#101010",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 24,
    zIndex: 2,
  },
  editorOverlayFloating: {
    ...StyleSheet.absoluteFillObject,
    borderLeftWidth: 1,
    borderLeftColor: "#2A2A2A",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  mobileModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  mobileModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  mobileSheetContainer: {
    height: "92%",
    minHeight: 520,
    backgroundColor: "#101010",
  },
  centered: {
    flex: 1,
    backgroundColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "web" ? 8 : 60,
    paddingBottom: 12,
    backgroundColor: "#111111",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#F5F5F5",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: "#9A9A9A",
    marginTop: 6,
  },
  syncInfoText: {
    marginTop: 8,
    color: "#FFC857",
    fontSize: 12,
    fontWeight: "600",
  },
  offlineInfoText: {
    marginTop: 8,
    color: "#FFD166",
    fontSize: 12,
    fontWeight: "600",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#2A2A2A",
    backgroundColor: "#1A1A1A",
    color: "#F0F0F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  subTabContainer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: "center",
    minHeight: 40,
  },
  filtersRow: {
    maxHeight: 48,
  },
  subTab: {
    paddingHorizontal: 12,
    paddingVertical: 0,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    justifyContent: "center",
    alignSelf: "center",
  },
  subTabActive: {
    backgroundColor: "#FF2A2A",
    borderColor: "#FF2A2A",
  },
  subTabText: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 14,
    color: "#9A9A9A",
    letterSpacing: 0.3,
  },
  subTabTextActive: {
    color: "#F5F5F5",
  },
  listContainer: {
    padding: 16,
    paddingBottom: 120,
  },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  selectionModeButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3A3A3A",
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectionModeButtonActive: {
    borderColor: "#FF2A2A",
    backgroundColor: "#2A1212",
  },
  selectionModeButtonText: {
    color: "#D2D2D2",
    fontSize: 12,
    fontWeight: "700",
  },
  selectionModeButtonTextActive: {
    color: "#FFD9D9",
  },
  bulkDeleteButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#5A2222",
    backgroundColor: "#2A1212",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bulkDeleteButtonDisabled: {
    opacity: 0.5,
  },
  bulkDeleteButtonText: {
    color: "#FFC5C5",
    fontSize: 12,
    fontWeight: "700",
  },
  formCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
    overflow: "hidden",
  },
  formCardSelected: {
    borderColor: "#FF2A2A",
    shadowColor: "#FF2A2A",
    shadowOpacity: 0.2,
  },
  formCardContent: {
    padding: 16,
  },
  formCardCodeTag: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#5A2222",
    backgroundColor: "#2A1212",
    color: "#FFD9D9",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  formCardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  formCardDescription: {
    fontSize: 14,
    color: "#9A9A9A",
    marginBottom: 12,
    lineHeight: 20,
  },
  returnReasonText: {
    color: "#FFB3B3",
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 18,
  },
  formCardMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  formCardActions: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  selectionHintText: {
    color: "#FFC5C5",
    fontSize: 12,
    fontWeight: "700",
  },
  offlineDraftText: {
    marginTop: 8,
    fontSize: 11,
    color: "#FFC857",
  },
  formCardStatus: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  formCardDate: {
    fontSize: 12,
    color: "#9A9A9A",
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: "#F5F5F5",
    marginBottom: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9A9A9A",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: Platform.OS === "android" ? 110 : 100,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FF2A2A",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF2A2A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 999,
  },
  fabText: {
    fontSize: 32,
    lineHeight: 34,
    color: "#F5F5F5",
    fontWeight: "700",
  },
  card: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    backgroundColor: "#171717",
    padding: 14,
  },
  cardTitle: {
    color: "#F5F5F5",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  listSubtitle: {
    color: "#A0A0A0",
    fontSize: 12,
    marginTop: -4,
    marginBottom: 4,
  },
  newFormButtonCompact: {
    borderRadius: 8,
    backgroundColor: "#FF2A2A",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  newFormButtonCompactText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  metric: {
    color: "#D0D0D0",
    fontSize: 13,
    marginBottom: 4,
  },
  progressCard: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    backgroundColor: "#161616",
    padding: 10,
  },
  progressTitle: {
    color: "#F5F5F5",
    fontSize: 14,
    fontWeight: "700",
  },
  progressSubtitle: {
    color: "#B8B8B8",
    fontSize: 12,
    marginTop: 4,
  },
  progressBarTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#272727",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#FF2A2A",
  },
  primaryButton: {
    backgroundColor: "#FF2A2A",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  issueList: {
    marginTop: 12,
    gap: 8,
  },
  issueRow: {
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#221313",
    borderWidth: 1,
    borderColor: "#4A1E1E",
  },
  issuePath: {
    color: "#FF8D8D",
    fontSize: 12,
    fontWeight: "600",
  },
  issueMessage: {
    color: "#EAEAEA",
    fontSize: 12,
    marginTop: 2,
  },
  okText: {
    marginTop: 10,
    color: "#7ED957",
    fontSize: 12,
  },
  sectionRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
  },
  sectionLabel: {
    color: "#F0F0F0",
    fontSize: 13,
    fontWeight: "600",
  },
  sectionMeta: {
    marginTop: 2,
    color: "#A0A0A0",
    fontSize: 12,
  },
  blockTitle: {
    color: "#F5F5F5",
    fontSize: 20,
    fontWeight: "700",
  },
  infoText: {
    color: "#A0A0A0",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  backButton: {
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#303030",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: "#F5F5F5",
    fontWeight: "600",
  },
  modalHeader: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#292929",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalAction: {
    color: "#FF2A2A",
    fontSize: 14,
    fontWeight: "700",
    minWidth: 64,
  },
  modalTitle: {
    color: "#F5F5F5",
    fontSize: 15,
    fontWeight: "700",
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  formSectionCard: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    backgroundColor: "#171717",
    padding: 10,
  },
  formSectionTitle: {
    color: "#F5F5F5",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  sectionProgressText: {
    color: "#AFAFAF",
    fontSize: 11,
    marginTop: 2,
  },
  sectionToggle: {
    color: "#FF9A9A",
    fontSize: 12,
    fontWeight: "700",
  },
  fieldWrap: {
    marginBottom: 10,
  },
  fieldLabel: {
    color: "#D8D8D8",
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#393939",
    backgroundColor: "#111",
    color: "#F0F0F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  subsectionWrap: {
    borderTopWidth: 1,
    borderTopColor: "#2E2E2E",
    marginTop: 6,
    paddingTop: 8,
  },
  subsectionTitle: {
    color: "#BFBFBF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  optionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3A3A3A",
    backgroundColor: "#121212",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optionChipActive: {
    borderColor: "#FF2A2A",
    backgroundColor: "#2A1212",
  },
  optionChipText: {
    color: "#C7C7C7",
    fontSize: 11,
  },
  optionChipTextActive: {
    color: "#FFD9D9",
    fontWeight: "700",
  },
  editorActions: {
    marginTop: 14,
    marginBottom: 24,
    gap: 8,
  },
  readOnlyBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#5A2222",
    backgroundColor: "#2A1212",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readOnlyBannerText: {
    color: "#FFD4D4",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyEditorState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyEditorTitle: {
    color: "#F5F5F5",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  secondaryButton: {
    backgroundColor: "#E56A00",
  },
  devFillButton: {
    borderWidth: 1,
    borderColor: "#3A3A3A",
    backgroundColor: "#171717",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  devFillButtonText: {
    color: "#FFD4D4",
    fontSize: 11,
    fontWeight: "700",
  },
});

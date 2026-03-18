import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import {
  emonumentService,
  EMonumentFormSection,
  EMonumentValidationIssue,
} from "@/services/emonumentService";

export default function EMonumentHiddenTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [schema, setSchema] = useState<EMonumentFormSection[]>([]);
  const [instanceCount, setInstanceCount] = useState(0);
  const [validationIssues, setValidationIssues] = useState<EMonumentValidationIssue[]>([]);
  const [validating, setValidating] = useState(false);

  const canAccess = useMemo(
    () => Boolean(user?.is_emonument_privileged || user?.is_dashboard_admin),
    [user?.is_emonument_privileged, user?.is_dashboard_admin],
  );

  const totalFieldCount = useMemo(() => {
    const walk = (sections: EMonumentFormSection[]): number =>
      sections.reduce((sum, section) => {
        return sum + section.fields.length + walk(section.subsections || []);
      }, 0);
    return walk(schema);
  }, [schema]);

  const load = useCallback(async () => {
    try {
      const [schemaRes, instances] = await Promise.all([
        emonumentService.getFormSchema(),
        emonumentService.listInstances(),
      ]);
      setIsAuthorized(true);
      setSchema(schemaRes.sections || []);
      setInstanceCount(instances.length);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        setIsAuthorized(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const runStrictValidation = useCallback(async () => {
    setValidating(true);
    setValidationIssues([]);
    try {
      const samplePayload: Record<string, unknown> = {
        identificare: { denumire: "Monument demo" },
        localizare: { judet: "Bucuresti", ut: "Bucuresti" },
        protectie_valorificare: { criterii_evaluare_globala: "Evaluare initiala" },
      };
      const res = await emonumentService.validatePayload(samplePayload, true);
      setValidationIssues(res.errors || []);
    } finally {
      setValidating(false);
    }
  }, []);

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF2A2A" />
      }
    >
      <Text style={styles.title}>eMonument Hidden Tab</Text>
      <Text style={styles.subtitle}>Schema + validation + workflow diagnostics</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Backend Integration</Text>
        <Text style={styles.metric}>Sections: {schema.length}</Text>
        <Text style={styles.metric}>Fields: {totalFieldCount}</Text>
        <Text style={styles.metric}>Instances: {instanceCount}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Strict Validation Check</Text>
        <TouchableOpacity
          style={[styles.primaryButton, validating && styles.disabledButton]}
          disabled={validating}
          onPress={runStrictValidation}
        >
          <Text style={styles.primaryButtonText}>
            {validating ? "Validating..." : "Run strict validation"}
          </Text>
        </TouchableOpacity>

        {validationIssues.length > 0 ? (
          <View style={styles.issueList}>
            {validationIssues.slice(0, 8).map((issue, idx) => (
              <View key={`${issue.path}-${idx}`} style={styles.issueRow}>
                <Text style={styles.issuePath}>{issue.path}</Text>
                <Text style={styles.issueMessage}>{issue.message}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.okText}>No strict validation issues in sample payload.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Schema Sections</Text>
        {schema.map((section) => (
          <View key={section.key} style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            <Text style={styles.sectionMeta}>
              {section.fields.length} fields · {section.subsections.length} subsections
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#101010",
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  centered: {
    flex: 1,
    backgroundColor: "#101010",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    color: "#F5F5F5",
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 6,
    color: "#9A9A9A",
    fontSize: 13,
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
  metric: {
    color: "#D0D0D0",
    fontSize: 13,
    marginBottom: 4,
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
});

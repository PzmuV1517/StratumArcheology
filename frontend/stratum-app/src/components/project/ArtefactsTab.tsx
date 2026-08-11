/**
 * @file
 * Project artefacts tab component.
 *
 * Displays a list of archaeological artefacts with QR codes
 * and metadata.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
  TextInput,
} from "react-native";
import { useDelayedLoading } from "../../hooks/useDelayedLoading";
import { ArtefactGridSkeleton } from "../../components/common/Skeleton";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fileService } from "../../services/fileService";
import { showAlert } from "../../utils/alert";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder" | "note";
  mime_type?: string;
}

interface ArtefactMeta {
  id: string;
  name: string;
  number: number;
  previewFileId?: string;
  createdAt?: string;
}

export default function ArtefactsTab({
  projectId,
  canEdit = true,
}: {
  projectId: string;
  canEdit?: boolean;
}) {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const textPrimary = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const textSecondary = isDarkMode ? "#9A9A9A" : "#666666";
  const textTertiary = isDarkMode ? "#666666" : "#7A7A7A";

  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const showSkeleton = useDelayedLoading(loading);
  const [searchQuery, setSearchQuery] = useState("");
  const [_artefactFolder, setArtefactFolder] = useState<FileNode | null>(null);
  const [artefacts, setArtefacts] = useState<
    { folder: FileNode; meta: ArtefactMeta | null; previewUrl?: string }[]
  >([]);

  const filteredArtefacts = useMemo(() => {
    if (!searchQuery.trim()) return artefacts;
    const q = searchQuery.toLowerCase();
    return artefacts.filter(({ folder, meta }) => {
      const name = (meta?.name || folder.name).toLowerCase();
      const num = meta?.number?.toString() || "";
      return name.includes(q) || num.includes(q);
    });
  }, [artefacts, searchQuery]);

  useEffect(() => {
    if (projectId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Reload artefacts when screen comes into focus (e.g., after creating a new artefact)
  useFocusEffect(
    useCallback(() => {
      if (projectId) {
        void load();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]),
  );

  const load = async () => {
    try {
      setLoading(true);

      // Ensure top-level Artefacts folder exists
      const root = await fileService.listRoot(projectId);
      let af = root.find((n: any) => n.type === "folder" && n.name === "Artefacts");
      if (!af) {
        af = await fileService.createFolder(projectId, "Artefacts");
      }
      setArtefactFolder(af);

      // List child folders as artefacts
      const children = await fileService.listChildren(af.id);
      const folders = children.filter((c: any) => c.type === "folder");
      const out: {
        folder: FileNode;
        meta: ArtefactMeta | null;
        previewUrl?: string;
      }[] = [];

      for (const f of folders) {
        let meta: ArtefactMeta | null = null;
        let previewUrl: string | undefined;
        try {
          const grand = await fileService.listChildren(f.id);
          const metaFile = grand.find(
            (c: any) =>
              c.type === "file" &&
              (c.name === "artefact.json" || c.name.endsWith(".json")),
          );
          if (metaFile) {
            const text = await fileService.downloadFileAsText(metaFile.id);
            if (text) meta = JSON.parse(text);
          }

          const pv = grand.find(
            (c: any) =>
              c.type === "file" && /^preview\.(png|jpg|jpeg|webp)$/i.test(c.name),
          );
          if (pv && Platform.OS === "web") {
            const blobRes = await fileService.downloadFile(pv.id);
            if (blobRes.blob) previewUrl = URL.createObjectURL(blobRes.blob);
          }
        } catch {
          // Ignore per-folder metadata read errors and keep listing.
        }
        out.push({ folder: f, meta, previewUrl });
      }

      // Sort by number desc then name
      out.sort(
        (a, b) =>
          (b.meta?.number || 0) - (a.meta?.number || 0) ||
          a.folder.name.localeCompare(b.folder.name),
      );

      setArtefacts(out);
    } catch (e) {
      console.error("Failed to load artefacts", e);
    } finally {
      setLoading(false);
    }
  };

  const handleNewArtefact = () => {
    if (!canEdit) {
      showAlert(
        "Permission Denied",
        "Guests can only view artefacts. Creating artefacts is not permitted.",
      );
      return;
    }
    router.push({
      pathname: "/create-artefact" as any,
      params: { projectId } as any,
    });
  };

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Text style={{ color: textPrimary, fontWeight: "700", fontSize: 16 }}>
          Artefacts
        </Text>
        {canEdit && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleNewArtefact}>
            <Ionicons
              name="add"
              size={16}
              color="#FFFFFF"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.primaryBtnText}>New Artefact</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search bar */}
      {artefacts.length > 0 && (
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={16}
            color={textSecondary}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search artefacts..."
            placeholderTextColor={textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {showSkeleton ? (
        <ArtefactGridSkeleton count={4} />
      ) : artefacts.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <Text style={{ color: textSecondary }}>No artefacts yet</Text>
        </View>
      ) : filteredArtefacts.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <Text style={{ color: textSecondary }}>
            No artefacts match "{searchQuery}"
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {filteredArtefacts.map(({ folder, meta, previewUrl }) => (
            <TouchableOpacity
              key={folder.id}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/artefact/[id]" as any,
                  params: { id: folder.id } as any,
                })
              }
            >
              <View style={styles.previewBox}>
                {previewUrl ? (
                  <Image
                    source={{ uri: previewUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ color: textSecondary }}>No preview</Text>
                )}
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {meta?.name || folder.name}
              </Text>
              <Text style={styles.cardMeta}>#{meta?.number ?? "-"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    searchInput: {
      flex: 1,
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 15,
      padding: 0,
    },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    card: {
      width: 180,
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
      padding: 8,
    },
    previewBox: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 8,
      backgroundColor: isDarkMode ? "#0A0A0A" : "#F1F1F1",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
      overflow: "hidden",
    },
    cardTitle: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontWeight: "700",
    },
    cardMeta: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontSize: 12,
    },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#FF2A2A",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    primaryBtnText: { color: "#FFFFFF", fontWeight: "700" },
  });

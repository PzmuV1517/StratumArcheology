import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fileService } from "../../services/fileService";
import { showAlert } from "../../utils/alert";

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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [artefactFolder, setArtefactFolder] = useState<FileNode | null>(null);
  const [artefacts, setArtefacts] = useState<
    { folder: FileNode; meta: ArtefactMeta | null; previewUrl?: string }[]
  >([]);

  useEffect(() => {
    if (projectId) load();
  }, [projectId]);

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
        let previewUrl: string | undefined = undefined;
        try {
          const grand = await fileService.listChildren(f.id);
          const metaFile = grand.find(
            (c: any) =>
              c.type === "file" &&
              (c.name === "artefact.json" || c.name.endsWith(".json")),
          );
          if (metaFile) {
            const res = await fileService.downloadFile(metaFile.id);
            const text = await (res.data?.text?.() ||
              res.data
                ?.arrayBuffer?.()
                .then((b: any) => new TextDecoder().decode(b)));
            if (text) meta = JSON.parse(text);
          }
          const pv = grand.find(
            (c: any) =>
              c.type === "file" && /^preview\.(png|jpg|jpeg|webp)$/i.test(c.name),
          );
          if (pv && Platform.OS === "web") {
            const blobRes = await fileService.downloadFile(pv.id);
            const blob = blobRes.data;
            const url = URL.createObjectURL(blob);
            previewUrl = url;
          }
        } catch {}
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
        <Text style={{ color: "#F5F5F5", fontWeight: "700", fontSize: 16 }}>
          Artefacts
        </Text>
        {canEdit && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleNewArtefact}
          >
            <Ionicons name="add" size={16} color="#F5F5F5" style={{ marginRight: 4 }} />
            <Text style={styles.primaryBtnText}>New Artefact</Text>
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <ActivityIndicator color="#FF2A2A" />
          <Text style={{ color: "#9A9A9A", marginTop: 8 }}>Loading artefacts…</Text>
        </View>
      ) : artefacts.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <Text style={{ color: "#9A9A9A" }}>No artefacts yet</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {artefacts.map(({ folder, meta, previewUrl }) => (
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
                  <Text style={{ color: "#9A9A9A" }}>No preview</Text>
                )}
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {meta?.name || folder.name}
              </Text>
              <Text style={styles.cardMeta}>#{meta?.number ?? "—"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: 180,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 8,
  },
  previewBox: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: "#0A0A0A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    overflow: "hidden",
  },
  cardTitle: { color: "#F5F5F5", fontWeight: "700" },
  cardMeta: { color: "#9A9A9A", fontSize: 12 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF2A2A",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  primaryBtnText: { color: "#F5F5F5", fontWeight: "700" },
});

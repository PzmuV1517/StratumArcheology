/**
 * @file
 * Artefact detail screen.
 *
 * Displays detailed artefact information with QR code
 * and associated media.
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
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Modal,
  TextInput,
  FlatList,
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import QRCodeView from "../../src/components/common/QRCodeView";
import { ArtefactDetailSkeleton } from "../../src/components/common/Skeleton";
import { useDelayedLoading } from "../../src/hooks/useDelayedLoading";
import { fileService } from "../../src/services/fileService";
import { useAuth } from "../../src/contexts/AuthContext";
import { showAlert } from "../../src/utils/alert";
import {
  buildManifestFromChildren,
  ArtefactManifest,
} from "../../src/utils/artefactManifest";
import api from "../../src/services/api";

const isIOS = Platform.OS === "ios";

// ---------------------------------------------------------------------------
// Shared UI components (matching new-project / join-project)
// ---------------------------------------------------------------------------
function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[s.solidCard, style]}>{children}</View>;
}

function GlassButton({
  onPress,
  title,
  variant = "primary",
  icon,
  disabled,
  loading: isLoading,
}: {
  onPress: () => void;
  title: string;
  variant?: "primary" | "secondary" | "destructive";
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isPrimary = variant === "primary";
  const isDestructive = variant === "destructive";
  const content = (
    <>
      {icon && (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={isDestructive ? "#FF4444" : isPrimary ? "#FFFFFF" : "#9A9A9A"}
          style={{ marginRight: 8 }}
        />
      )}
      {isLoading ? (
        <ActivityIndicator color={isDestructive ? "#FF4444" : "#FFFFFF"} />
      ) : (
        <Text
          style={[
            s.buttonText,
            !isPrimary && !isDestructive && s.secondaryButtonText,
            isDestructive && s.destructiveButtonText,
          ]}
        >
          {title}
        </Text>
      )}
    </>
  );

  if (isDestructive) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || isLoading}
        activeOpacity={0.7}
        style={[s.destructiveButton, disabled && s.disabledButton]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
      style={[
        isPrimary ? s.primaryButton : s.secondaryBtn,
        disabled && s.disabledButton,
      ]}
    >
      {content}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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
  harrisMatrixContextId?: string;
  latitude?: number;
  longitude?: number;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function ArtefactDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [meta, setMeta] = useState<ArtefactMeta | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [noteContents, setNoteContents] = useState<Map<string, string>>(new Map());
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [qrExpanded, setQrExpanded] = useState(false);

  // Harris Matrix context info
  type HMContext = { id: string; type: string; description: string };
  const [hmContextInfo, setHmContextInfo] = useState<HMContext | null>(null);
  const [hmContexts, setHmContexts] = useState<HMContext[]>([]);
  const [showHmPicker, setShowHmPicker] = useState(false);

  // Image viewer
  const [viewingImage, setViewingImage] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = async () => {
    try {
      setLoading(true);
      // Get the folder info to extract the project_id
      let loadedProjectId: string | null = null;
      try {
        const nodeInfo = await fileService.getNodeInfo(id as string);
        if (nodeInfo?.project_id) {
          setProjectId(nodeInfo.project_id);
          loadedProjectId = nodeInfo.project_id;
        }
      } catch (e) {
        console.warn("Could not fetch node info", e);
      }
      const ch = await fileService.listChildren(id as string);
      setChildren(ch);
      const metaFile = ch.find(
        (c: any) =>
          c.type === "file" &&
          (c.name === "artefact.json" || c.name.endsWith(".json")),
      );
      let parsedMeta: ArtefactMeta | null = null;
      if (metaFile) {
        try {
          const res = await fileService.downloadFile(metaFile.id);
          const text = await res.blob.text();
          if (text) {
            parsedMeta = JSON.parse(text);
            setMeta(parsedMeta);
          }
        } catch {}
      }

      // Resolve Harris Matrix context
      if (loadedProjectId && parsedMeta?.harrisMatrixContextId) {
        try {
          const hmRes = await api.get(`/projects/${loadedProjectId}/harris-matrix`);
          const hmData = hmRes.data?.data;
          if (hmData?.contexts) {
            const ctxs: HMContext[] = (hmData.contexts as [string, any][]).map(
              ([cid, ctx]) => ({
                id: cid,
                type: ctx.type || "layer",
                description: ctx.description || "",
              }),
            );
            setHmContexts(ctxs);
            const found = ctxs.find(
              (c) => c.id === parsedMeta!.harrisMatrixContextId,
            );
            if (found) setHmContextInfo(found);
          }
        } catch {}
      }
      // Load preview image — prefer preview.* file, fall back to first image
      const pv = ch.find(
        (c: any) =>
          c.type === "file" && /^preview\.(png|jpg|jpeg|webp)$/i.test(c.name),
      );
      const firstImg =
        pv ||
        ch.find(
          (c: any) =>
            c.type === "file" &&
            (c.mime_type?.startsWith("image/") ||
              /\.(png|jpg|jpeg|gif|webp|heic)$/i.test(c.name)) &&
            c.name !== "artefact.json",
        );
      if (firstImg) {
        try {
          const url = await fileService.getDownloadUrl(firstImg.id);
          setPreviewUrl(url);
        } catch (e) {
          console.warn("Failed to load preview image", e);
        }
      }
      if (Platform.OS === "web" && typeof window !== "undefined") {
        setQrUrl(`${window.location.origin}/artefact/${id}`);
      }
    } catch (e) {
      console.error("Failed to load artefact", e);
    } finally {
      setLoading(false);
    }
  };

  const onDeleteArtefact = useCallback(() => {
    setConfirmName("");
    setShowDeleteModal(true);
  }, []);

  const toggleNote = async (noteId: string) => {
    if (expandedNotes.has(noteId)) {
      setExpandedNotes((prev) => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
    } else {
      if (!noteContents.has(noteId)) {
        try {
          const res = await fileService.downloadFile(noteId);
          const text = await res.blob.text();
          setNoteContents((prev) => new Map(prev).set(noteId, text));
        } catch (e) {
          console.error("Failed to load note", e);
        }
      }
      setExpandedNotes((prev) => new Set(prev).add(noteId));
    }
  };

  const uploadNewPreview = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: "image/*",
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    const fd = new FormData();
    fd.append("parent_id", String(id));
    if (Platform.OS === "web") {
      const blob = await fetch(asset.uri).then((r) => r.blob());
      const file = new File([blob], "preview.png", {
        type: asset.mimeType || blob.type || "image/png",
      });
      fd.append("file", file, "preview.png");
    } else {
      fd.append("file", {
        uri: asset.uri,
        name: "preview.png",
        type: asset.mimeType || "image/png",
      } as any);
    }
    await fileService.uploadFormData(projectId || ("" as any), fd);
    setShowPreviewModal(false);
    await load();
  };

  const deletePreview = async () => {
    const pv = children.find(
      (c: any) =>
        c.type === "file" && /^preview\.(png|jpg|jpeg|webp)$/i.test(c.name),
    );
    if (pv) {
      await fileService.deleteNode(pv.id);
      setShowPreviewModal(false);
      await load();
    }
  };

  const uploadMoreFiles = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
      type: "*/*",
    });
    if (res.canceled) return;
    for (const asset of res.assets) {
      const fd = new FormData();
      fd.append("parent_id", String(id));
      if (Platform.OS === "web") {
        const blob = await fetch(asset.uri).then((r) => r.blob());
        const file = new File([blob], asset.name || "file", {
          type: asset.mimeType || blob.type || "application/octet-stream",
        });
        fd.append("file", file, file.name);
      } else {
        fd.append("file", {
          uri: asset.uri,
          name: asset.name || "file",
          type: asset.mimeType || "application/octet-stream",
        } as any);
      }
      await fileService.uploadFormData(projectId || ("" as any), fd);
    }
    try {
      const ch = await fileService.listChildren(id as string);
      setChildren(ch);
      const existingMetaFile = ch.find(
        (c: any) =>
          c.type === "file" &&
          (c.name === "artefact.json" || c.name.endsWith(".json")),
      );
      let existing: Partial<ArtefactManifest> | undefined = undefined;
      if (existingMetaFile) {
        try {
          const res = await fileService.downloadFile(existingMetaFile.id);
          const text = await res.blob.text();
          if (text) existing = JSON.parse(text);
        } catch {}
      }
      const pv = ch.find(
        (c: any) =>
          c.type === "file" && /^preview\.(png|jpg|jpeg|webp)$/i.test(c.name),
      );
      const manifest = buildManifestFromChildren(
        id as string,
        (existing as any)?.name || meta?.name || "Artefact",
        (existing as any)?.number || meta?.number || 0,
        ch as any,
        { ...existing, previewFileId: pv?.id },
        { user: user || undefined, qrUrl: qrUrl || undefined },
      );
      if (existingMetaFile && Platform.OS === "web") {
        const blob = new Blob([JSON.stringify(manifest, null, 2)], {
          type: "application/json",
        });
        const file = new File([blob], "artefact.json", {
          type: "application/json",
        });
        await fileService.replaceFile(existingMetaFile.id, file);
      }
    } catch (e) {
      console.error("Failed updating artefact.json after upload", e);
    }
    await load();
  };

  /** Patch a field in artefact.json manifest */
  const updateManifest = async (patch: Partial<ArtefactManifest>) => {
    try {
      const ch = await fileService.listChildren(id as string);
      const existingMetaFile = ch.find(
        (c: any) =>
          c.type === "file" &&
          (c.name === "artefact.json" || c.name.endsWith(".json")),
      );
      if (!existingMetaFile) return;
      let existing: any = {};
      try {
        const res = await fileService.downloadFile(existingMetaFile.id);
        const text = await res.blob.text();
        if (text) existing = JSON.parse(text);
      } catch {}
      const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
      if (Platform.OS === "web") {
        const blob = new Blob([JSON.stringify(updated, null, 2)], {
          type: "application/json",
        });
        const file = new File([blob], "artefact.json", {
          type: "application/json",
        });
        await fileService.replaceFile(existingMetaFile.id, file);
      }
    } catch (e) {
      console.error("Failed to update manifest", e);
    }
  };

  /** Delete a specific file from this artefact */
  const deleteFile = async (fileId: string) => {
    try {
      await fileService.deleteNode(fileId);
      await load();
    } catch (e) {
      console.error("Failed to delete file", e);
      showAlert("Error", "Failed to delete file");
    }
  };

  /** Open image viewer */
  const openImageViewer = async (img: FileNode) => {
    setViewingImage(img);
    try {
      const url = await fileService.getDownloadUrl(img.id);
      setViewingImageUrl(url);
    } catch {
      setViewingImageUrl(null);
    }
  };

  const noteFiles = children.filter(
    (c) => c.type === "file" && /\.txt$/i.test(c.name),
  );
  const images = children.filter(
    (c) =>
      c.type === "file" &&
      (c.mime_type?.startsWith("image/") ||
        /\.(png|jpg|jpeg|gif|webp|heic)$/i.test(c.name)),
  );

  // ---- Loading / Error ----
  if (showSkeleton) {
    return (
      <View style={s.container}>
        <Stack.Screen
          options={{
            title: "Artefact",
            headerTransparent: isIOS,
            headerBlurEffect: isIOS ? "systemChromeMaterial" : undefined,
            headerStyle: isIOS ? {} : { backgroundColor: "#111111" },
            headerTintColor: "#FF2A2A",
            headerTitleStyle: { color: "#F5F5F5", fontWeight: "600" },
            headerShown: true,
          }}
        />
        <ArtefactDetailSkeleton />
      </View>
    );
  }

  // ---- Main render ----
  return (
    <View style={s.container}>
      <Stack.Screen
        options={{
          title: meta?.name ? `${meta.name} #${meta.number ?? "—"}` : "Artefact",
          headerTransparent: isIOS,
          headerBlurEffect: isIOS ? "systemChromeMaterial" : undefined,
          headerStyle: isIOS ? {} : { backgroundColor: "#111111" },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: { color: "#F5F5F5", fontWeight: "600" },
          headerBackTitle: "Artefacts",
          headerShown: true,
          presentation: "card",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                if (projectId) {
                  router.replace(`/project/${projectId}/artefacts` as any);
                } else {
                  router.back();
                }
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingLeft: Platform.OS === "ios" ? 0 : 8,
                paddingRight: 16,
              }}
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={22} color="#FF2A2A" />
              {Platform.OS === "ios" && (
                <Text
                  style={{ color: "#FF2A2A", fontSize: 17, marginLeft: 4 }}
                >
                  Artefacts
                </Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header icon */}
        <View style={[s.headerIcon, previewUrl && { alignSelf: "stretch" }]}>
          {previewUrl ? (
            <TouchableOpacity
              onPress={() => setShowPreviewModal(true)}
              style={{ width: "100%" } as any}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: previewUrl }}
                style={s.heroPreview}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setShowPreviewModal(true)}>
              <Ionicons name="cube" size={48} color="#FF2A2A" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={s.title}>{meta?.name || "Artefact"}</Text>
        <Text style={s.subtitle}>
          {meta?.number ? `Artefact #${meta.number}` : "Artefact detail"}
          {meta?.createdAt &&
            `  ·  Created ${new Date(meta.createdAt).toLocaleDateString()}`}
        </Text>

        {/* ── Stratigraphic Context card ── */}
        <GlassCard style={s.card}>
          <View style={s.sectionHeader}>
            <Text style={s.label}>
              <Ionicons name="git-network" size={14} color="#9A9A9A" /> Stratigraphic
              Context
            </Text>
            <TouchableOpacity
              style={s.inlineBtn}
              onPress={async () => {
                if (hmContexts.length === 0 && projectId) {
                  try {
                    const hmRes = await api.get(
                      `/projects/${projectId}/harris-matrix`,
                    );
                    const hmData = hmRes.data?.data;
                    if (hmData?.contexts) {
                      const ctxs: HMContext[] = (
                        hmData.contexts as [string, any][]
                      ).map(([cid, ctx]) => ({
                        id: cid,
                        type: ctx.type || "layer",
                        description: ctx.description || "",
                      }));
                      setHmContexts(ctxs);
                    }
                  } catch {}
                }
                setShowHmPicker(true);
              }}
            >
              <Ionicons name="link" size={16} color="#FF2A2A" />
              <Text style={s.inlineBtnText}>
                {hmContextInfo ? "Change" : "Link"}
              </Text>
            </TouchableOpacity>
          </View>
          {hmContextInfo ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                borderRadius: 12,
                padding: 14,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.08)",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor:
                    {
                      layer: "#FFA726",
                      deposit: "#66BB6A",
                      cut: "#EF5350",
                      fill: "#42A5F5",
                      structure: "#AB47BC",
                    }[hmContextInfo.type] || "#9A9A9A",
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#F5F5F5", fontSize: 15, fontWeight: "600" }}>
                  {hmContextInfo.id}
                  <Text
                    style={{
                      color:
                        {
                          layer: "#FFA726",
                          deposit: "#66BB6A",
                          cut: "#EF5350",
                          fill: "#42A5F5",
                          structure: "#AB47BC",
                        }[hmContextInfo.type] || "#9A9A9A",
                      fontWeight: "400",
                      fontSize: 12,
                    }}
                  >
                    {" "}
                    {hmContextInfo.type.toUpperCase()}
                  </Text>
                </Text>
                {hmContextInfo.description ? (
                  <Text
                    style={{ color: "#888", fontSize: 13, marginTop: 2 }}
                    numberOfLines={2}
                  >
                    {hmContextInfo.description}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={async () => {
                  // Unlink
                  const updatedMeta = { ...meta, harrisMatrixContextId: undefined };
                  setMeta(updatedMeta as any);
                  setHmContextInfo(null);
                  await updateManifest({ harrisMatrixContextId: undefined });
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={20} color="#9A9A9A" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.emptyInCard}>
              <Ionicons name="git-network-outline" size={32} color="#555" />
              <Text style={s.emptyText}>No context linked</Text>
            </View>
          )}
        </GlassCard>

        {/* ── GPS Coordinates card ── */}
        <GlassCard style={s.card}>
          <View style={s.sectionHeader}>
            <Text style={s.label}>
              <Ionicons name="location" size={14} color="#9A9A9A" /> GPS Coordinates
            </Text>
          </View>
          {meta?.latitude != null && meta?.longitude != null ? (
            <View
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                borderRadius: 12,
                padding: 14,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View style={{ flexDirection: "row", gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#666", fontSize: 11, marginBottom: 2 }}>
                    LAT
                  </Text>
                  <Text
                    style={{
                      color: "#F5F5F5",
                      fontSize: 15,
                      fontWeight: "600",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {meta.latitude.toFixed(6)}°
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#666", fontSize: 11, marginBottom: 2 }}>
                    LNG
                  </Text>
                  <Text
                    style={{
                      color: "#F5F5F5",
                      fontSize: 15,
                      fontWeight: "600",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {meta.longitude.toFixed(6)}°
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={s.emptyInCard}>
              <Ionicons name="location-outline" size={32} color="#555" />
              <Text style={s.emptyText}>No coordinates set</Text>
            </View>
          )}
        </GlassCard>

        {/* ── Images card ── */}
        <GlassCard style={s.card}>
          <View style={s.sectionHeader}>
            <Text style={s.label}>
              <Ionicons name="images" size={14} color="#9A9A9A" /> Images
              <Text style={s.countBadge}> ({images.length})</Text>
            </Text>
            <TouchableOpacity style={s.inlineBtn} onPress={uploadMoreFiles}>
              <Ionicons name="cloud-upload" size={16} color="#FF2A2A" />
              <Text style={s.inlineBtnText}>Upload</Text>
            </TouchableOpacity>
          </View>
          {images.length === 0 ? (
            <View style={s.emptyInCard}>
              <Ionicons name="image-outline" size={32} color="#555" />
              <Text style={s.emptyText}>No images yet</Text>
            </View>
          ) : (
            <View style={{ gap: 8, marginTop: 4 }}>
              {images.map((img) => (
                <TouchableOpacity
                  key={img.id}
                  style={s.fileRow}
                  onPress={() => openImageViewer(img)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="image" size={18} color="#FF2A2A" />
                  <Text style={s.fileRowText} numberOfLines={1}>
                    {img.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      showAlert("Delete Image", `Delete "${img.name}"?`, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: () => deleteFile(img.id),
                        },
                      ]);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#9A9A9A" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </GlassCard>

        {/* ── Notes card ── */}
        <GlassCard style={s.card}>
          <View style={s.sectionHeader}>
            <Text style={s.label}>
              <Ionicons name="document-text" size={14} color="#9A9A9A" /> Notes
              <Text style={s.countBadge}> ({noteFiles.length})</Text>
            </Text>
          </View>
          {noteFiles.length === 0 ? (
            <View style={s.emptyInCard}>
              <Ionicons name="document-text-outline" size={32} color="#555" />
              <Text style={s.emptyText}>No notes yet</Text>
            </View>
          ) : (
            <View style={{ gap: 12, marginTop: 4 }}>
              {noteFiles.map((n) => {
                const isExpanded = expandedNotes.has(n.id);
                const content = noteContents.get(n.id) || "";
                const _preview = content.substring(0, 100);
                return (
                  <TouchableOpacity
                    key={n.id}
                    onPress={() => toggleNote(n.id)}
                    style={s.noteCard}
                  >
                    <View style={s.noteHeader}>
                      <Ionicons name="document-text" size={18} color="#9A9A9A" />
                      <Text style={s.noteTitle} numberOfLines={1}>
                        {n.name}
                      </Text>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color="#9A9A9A"
                      />
                    </View>
                    {isExpanded && content && (
                      <Text style={s.noteBodyText}>{content}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </GlassCard>

        {/* ── QR Code card ── */}
        <GlassCard style={s.card}>
          <TouchableOpacity
            style={s.sectionHeader}
            onPress={() => setQrExpanded(!qrExpanded)}
          >
            <Text style={s.label}>
              <Ionicons name="qr-code" size={14} color="#9A9A9A" /> QR Code
            </Text>
            <Ionicons
              name={qrExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color="#9A9A9A"
            />
          </TouchableOpacity>
          {qrExpanded && (
            <>
              {Platform.OS === "web" && qrDataUrl && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    style={s.inlineBtn}
                    onPress={() =>
                      printQr(
                        qrDataUrl,
                        `${meta?.name || "artefact"}-qr.png`,
                        `${meta?.name || "Artefact"} #${meta?.number ?? "—"}`,
                      )
                    }
                  >
                    <Ionicons name="print" size={16} color="#FF2A2A" />
                    <Text style={s.inlineBtnText}>Print</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.inlineBtn}
                    onPress={() =>
                      downloadDataUrl(
                        qrDataUrl,
                        `${meta?.name || "artefact"}-qr.png`,
                      )
                    }
                  >
                    <Ionicons name="download" size={16} color="#FF2A2A" />
                    <Text style={s.inlineBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={{ alignItems: "center", marginTop: 12 }}>
                <QRCodeView
                  value={qrUrl || ""}
                  label={`${meta?.name || "Artefact"} #${meta?.number ?? "—"}`}
                  onReadyDataUrl={setQrDataUrl}
                />
              </View>
            </>
          )}
        </GlassCard>

        {/* ── Actions ── */}
        <View style={s.buttonContainer}>
          <GlassButton
            onPress={uploadMoreFiles}
            title="Upload More Files"
            variant="primary"
            icon="cloud-upload"
          />
          <GlassButton
            onPress={onDeleteArtefact}
            title="Delete Artefact"
            variant="destructive"
            icon="trash"
          />
        </View>
      </ScrollView>

      {/* Delete confirmation modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={s.modalBackdrop}>
          <GlassCard style={s.modalContent}>
            <Text style={s.modalTitle}>Delete Artefact</Text>
            <Text style={s.modalText}>
              This will permanently delete this artefact and all its files and notes.
              Type the artefact name to confirm.
            </Text>
            <Text style={[s.modalText, { marginTop: 8 }]}>
              Artefact name:{" "}
              <Text style={{ color: "#F5F5F5", fontWeight: "700" }}>
                {meta?.name || "—"}
              </Text>
            </Text>
            <TextInput
              value={confirmName}
              onChangeText={setConfirmName}
              placeholder="Type the artefact name"
              placeholderTextColor="#555"
              style={s.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <GlassButton
                onPress={() => setShowDeleteModal(false)}
                title="Cancel"
                variant="secondary"
                disabled={deleting}
              />
              <TouchableOpacity
                style={[
                  s.destructiveButton,
                  {
                    flex: 1,
                    opacity:
                      deleting || confirmName !== (meta?.name || "") ? 0.5 : 1,
                  },
                ]}
                disabled={deleting || confirmName !== (meta?.name || "")}
                onPress={async () => {
                  try {
                    setDeleting(true);
                    await fileService.deleteNode(id as string);
                    setShowDeleteModal(false);
                    if (projectId) {
                      router.replace(`/project/${projectId}/artefacts` as any);
                    } else {
                      router.back();
                    }
                  } catch (e) {
                    console.error("Failed to delete artefact", e);
                    showAlert("Error", "Failed to delete artefact");
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? (
                  <ActivityIndicator color="#FF4444" />
                ) : (
                  <>
                    <Ionicons
                      name="trash"
                      size={20}
                      color="#FF4444"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={s.destructiveButtonText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Preview management modal */}
      <Modal
        visible={showPreviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={s.modalBackdrop}>
          <GlassCard style={s.modalContent}>
            <Text style={s.modalTitle}>Manage Preview Image</Text>
            <Text style={s.modalText}>
              Change or remove the preview image for this artefact.
            </Text>
            {previewUrl && (
              <Image
                source={{ uri: previewUrl }}
                style={{
                  width: "100%",
                  aspectRatio: 1,
                  borderRadius: 8,
                  marginTop: 12,
                }}
                resizeMode="cover"
              />
            )}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <GlassButton
                onPress={() => setShowPreviewModal(false)}
                title="Cancel"
                variant="secondary"
              />
              <GlassButton
                onPress={uploadNewPreview}
                title={previewUrl ? "Change" : "Upload"}
                variant="primary"
                icon="image"
              />
              {previewUrl && (
                <GlassButton
                  onPress={deletePreview}
                  title="Delete"
                  variant="destructive"
                  icon="trash"
                />
              )}
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* ── Harris Matrix Context picker modal ── */}
      <Modal
        visible={showHmPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHmPicker(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              maxHeight: "70%",
              backgroundColor: "#1A1A1A",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "#2A2A2A",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                padding: 20,
                borderBottomWidth: 1,
                borderBottomColor: "#2A2A2A",
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#F5F5F5" }}>
                Select Context
              </Text>
              <Text style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                Link to a Harris Matrix stratigraphic context
              </Text>
            </View>
            <FlatList
              data={hmContexts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 8 }}
              renderItem={({ item }) => {
                const isSelected = meta?.harrisMatrixContextId === item.id;
                const typeColors: Record<string, string> = {
                  layer: "#FFA726",
                  deposit: "#66BB6A",
                  cut: "#EF5350",
                  fill: "#42A5F5",
                  structure: "#AB47BC",
                };
                return (
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 14,
                      borderRadius: 12,
                      marginBottom: 4,
                      backgroundColor: isSelected
                        ? "rgba(255,42,42,0.15)"
                        : "transparent",
                    }}
                    onPress={async () => {
                      const updatedMeta = {
                        ...meta,
                        harrisMatrixContextId: item.id,
                      };
                      setMeta(updatedMeta as any);
                      setHmContextInfo(item);
                      setShowHmPicker(false);
                      await updateManifest({
                        harrisMatrixContextId: item.id,
                      });
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: typeColors[item.type] || "#9A9A9A",
                        marginRight: 12,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: "#F5F5F5",
                          fontSize: 15,
                          fontWeight: "600",
                        }}
                      >
                        {item.id}
                        <Text
                          style={{
                            color: typeColors[item.type] || "#9A9A9A",
                            fontWeight: "400",
                            fontSize: 12,
                          }}
                        >
                          {" "}
                          {item.type.toUpperCase()}
                        </Text>
                      </Text>
                      {item.description ? (
                        <Text
                          style={{
                            color: "#888",
                            fontSize: 13,
                            marginTop: 2,
                          }}
                          numberOfLines={2}
                        >
                          {item.description}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#FF2A2A" />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text
                  style={{
                    color: "#666",
                    textAlign: "center",
                    padding: 20,
                  }}
                >
                  No contexts in Harris Matrix
                </Text>
              }
            />
            <TouchableOpacity
              style={{
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: "#2A2A2A",
                alignItems: "center",
              }}
              onPress={() => setShowHmPicker(false)}
            >
              <Text style={{ color: "#9A9A9A", fontWeight: "600" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Image viewer modal ── */}
      <Modal
        visible={!!viewingImage}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setViewingImage(null);
          setViewingImageUrl(null);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.85)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 60,
              right: 20,
              zIndex: 10,
              padding: 8,
            }}
            onPress={() => {
              setViewingImage(null);
              setViewingImageUrl(null);
            }}
          >
            <Ionicons name="close" size={28} color="#F5F5F5" />
          </TouchableOpacity>

          {viewingImageUrl ? (
            <Image
              source={{ uri: viewingImageUrl }}
              style={{
                width: "90%",
                height: "70%",
              }}
              resizeMode="contain"
            />
          ) : (
            <View style={{ alignItems: "center", gap: 12 }}>
              <Ionicons name="image" size={64} color="#555" />
              <Text style={{ color: "#888", fontSize: 14 }}>
                {viewingImage?.name}
              </Text>
              <Text style={{ color: "#555", fontSize: 12 }}>
                Image preview available on web
              </Text>
            </View>
          )}

          {viewingImage && (
            <View
              style={{
                position: "absolute",
                bottom: 60,
                flexDirection: "row",
                gap: 16,
              }}
            >
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(255,68,68,0.15)",
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderWidth: 1,
                  borderColor: "rgba(255,68,68,0.3)",
                  gap: 8,
                }}
                onPress={() => {
                  const imgToDelete = viewingImage;
                  setViewingImage(null);
                  setViewingImageUrl(null);
                  showAlert("Delete Image", `Delete "${imgToDelete.name}"?`, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => deleteFile(imgToDelete.id),
                    },
                  ]);
                }}
              >
                <Ionicons name="trash" size={18} color="#FF4444" />
                <Text style={{ color: "#FF4444", fontWeight: "600" }}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — matching new-project / join-project design language
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111111" },
  scrollView: { flex: 1 },
  content: { padding: 24, paddingTop: 24, paddingBottom: 48 },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: { fontSize: 16, color: "#9A9A9A", marginTop: 16 },
  // Header
  headerIcon: { alignItems: "center", marginBottom: 16, marginTop: 16 },
  heroPreview: {
    width: "100%" as any,
    aspectRatio: 4 / 3,
    borderRadius: 20,
    backgroundColor: "#0A0A0A",
    maxHeight: 280,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#9A9A9A",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  // Cards
  card: { marginBottom: 16 },
  glassCard: { borderRadius: 20, padding: 20, overflow: "hidden" },
  blurCard: {
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  solidCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  // Section
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: { fontSize: 14, fontWeight: "600", color: "#9A9A9A" },
  countBadge: { fontWeight: "400", color: "#666" },
  inlineBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  inlineBtnText: { color: "#FF2A2A", fontWeight: "600", fontSize: 13 },
  // File rows
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  fileRowText: { flex: 1, color: "#F5F5F5", fontSize: 14 },
  emptyInCard: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  emptyText: { fontSize: 14, color: "#666" },
  // Input
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginTop: 8,
  },
  // Buttons
  buttonContainer: { gap: 12, marginTop: 8 },
  buttonTouchable: { borderRadius: 14, overflow: "hidden" },
  primaryButtonGlass: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: "rgba(255, 42, 42, 0.4)",
  },
  primaryButtonBlur: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: "rgba(255, 42, 42, 0.3)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF2A2A",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  destructiveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 68, 68, 0.1)",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 68, 68, 0.3)",
  },
  disabledButton: { opacity: 0.5 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  secondaryButtonText: { color: "#9A9A9A" },
  destructiveButtonText: { color: "#FF4444", fontSize: 16, fontWeight: "600" },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: { width: "100%", maxWidth: 420 },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 8,
  },
  modalText: { fontSize: 14, color: "#9A9A9A", lineHeight: 20 },
  // Note card styles
  noteCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  noteTitle: {
    flex: 1,
    color: "#F5F5F5",
    fontSize: 14,
    fontWeight: "600",
  },
  noteBodyText: {
    color: "#D0D0D0",
    fontSize: 13,
    lineHeight: 20,
    paddingLeft: 28,
  },
});

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function printQr(dataUrl: string, _filename: string, label?: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  const html = `<!doctype html><html><head><title>QR</title><style>body{font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0} img{width:320px;height:320px} h1{font-size:18px;margin-top:8px}</style></head><body><img src="${dataUrl}" alt="QR"/>${label ? `<h1>${label}</h1>` : ""}<script>setTimeout(()=>{window.print();},300);</script></body></html>`;
  win.document.write(html);
  win.document.close();
}

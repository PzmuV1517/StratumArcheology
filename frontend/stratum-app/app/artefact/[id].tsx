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
} from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { BlurView } from "expo-blur";
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

  useEffect(() => {
    if (id) load();
  }, [id]);

  const load = async () => {
    try {
      setLoading(true);
      // Get the folder info to extract the project_id
      try {
        const nodeInfo = await fileService.getNodeInfo(id as string);
        if (nodeInfo?.project_id) setProjectId(nodeInfo.project_id);
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
      if (metaFile) {
        try {
          const res = await fileService.downloadFile(metaFile.id);
          const text = await res.blob.text();
          if (text) setMeta(JSON.parse(text));
        } catch {}
      }
      const pv = ch.find(
        (c: any) =>
          c.type === "file" && /^preview\.(png|jpg|jpeg|webp)$/i.test(c.name),
      );
      if (pv && Platform.OS === "web") {
        const blobRes = await fileService.downloadFile(pv.id);
        setPreviewUrl(URL.createObjectURL(blobRes.blob));
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
          headerBackTitle: "Project",
          headerShown: true,
          presentation: "card",
        }}
      />

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header icon */}
        <View style={s.headerIcon}>
          {previewUrl ? (
            <TouchableOpacity onPress={() => setShowPreviewModal(true)}>
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
                <View key={img.id} style={s.fileRow}>
                  <Ionicons name="image" size={18} color="#FF2A2A" />
                  <Text style={s.fileRowText} numberOfLines={1}>
                    {img.name}
                  </Text>
                </View>
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
                const preview = content.substring(0, 100);
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
                    router.back();
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
    width: 96,
    height: 96,
    borderRadius: 20,
    backgroundColor: "#0A0A0A",
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

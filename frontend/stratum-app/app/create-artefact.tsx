/**
 * @file
 * Artefact creation screen.
 *
 * Provides a multi-step form for recording archaeological
 * artefact data with QR code generation.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Platform,
  Image,
  Modal,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { fileService } from "../src/services/fileService";
import { qrService } from "../src/services/qrService";
import { useAuth } from "../src/contexts/AuthContext";
import { buildManifestFromChildren } from "../src/utils/artefactManifest";
import { showAlert } from "../src/utils/alert";
import QRCodeView from "../src/components/common/QRCodeView";
import api from "../src/services/api";
import { useColorScheme } from "@/hooks/use-color-scheme";

const isIOS = Platform.OS === "ios";

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function CreateArtefactScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const s = styles;

  const [name, setName] = useState("");
  const [pickedImages, setPickedImages] = useState<
    { uri: string; name: string; mime: string }[]
  >([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [notes, setNotes] = useState<string[]>([""]);
  const [creating, setCreating] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  // Harris Matrix context linking
  type HMContext = { id: string; type: string; description: string };
  const [hmContexts, setHmContexts] = useState<HMContext[]>([]);
  const [selectedHmContext, setSelectedHmContext] = useState<string | null>(null);
  const [showHmPicker, setShowHmPicker] = useState(false);

  // GPS coordinates
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const GlassCard = ({
    children,
    style,
  }: {
    children: React.ReactNode;
    style?: object;
  }) => {
    return <View style={[s.solidCard, style]}>{children}</View>;
  };

  const GlassButton = ({
    onPress,
    title,
    variant = "primary",
    icon,
    disabled,
    loading: isLoading,
  }: {
    onPress: () => void;
    title: string;
    variant?: "primary" | "secondary";
    icon?: string;
    disabled?: boolean;
    loading?: boolean;
  }) => {
    const isPrimary = variant === "primary";
    const content = (
      <>
        {icon && (
          <Ionicons
            name={icon as keyof typeof Ionicons.glyphMap}
            size={20}
            color={isPrimary ? "#FFFFFF" : isDarkMode ? "#9A9A9A" : "#666666"}
            style={{ marginRight: 8 }}
          />
        )}
        {isLoading && isPrimary ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={[s.buttonText, !isPrimary && s.secondaryButtonText]}>
            {title}
          </Text>
        )}
      </>
    );

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || isLoading}
        activeOpacity={0.7}
        style={[
          isPrimary ? s.primaryButton : s.secondaryButton,
          disabled && s.disabledButton,
        ]}
      >
        {content}
      </TouchableOpacity>
    );
  };

  // Fetch Harris Matrix contexts on mount
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const res = await api.get(`/projects/${projectId}/harris-matrix`);
        const data = res.data?.data;
        if (data?.contexts) {
          const ctxs: HMContext[] = (data.contexts as [string, any][]).map(
            ([id, ctx]) => ({
              id,
              type: ctx.type || "layer",
              description: ctx.description || "",
            }),
          );
          setHmContexts(ctxs);
        }
      } catch {
        // No HM data or not available
      }
    })();
  }, [projectId]);

  // Preview QR shows a placeholder; the real unique code is generated on create
  const qrPreviewValue = "STR-PREVIEW";

  // ------ Pick images ------
  const pickImages = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
      type: "image/*",
    });
    if (res.canceled) return;
    const items = res.assets.map((a) => ({
      uri: a.uri,
      name: a.name || "image",
      mime: a.mimeType || "image/jpeg",
    }));
    setPickedImages((prev) => [...prev, ...items]);
  };

  const removeImage = (idx: number) => {
    setPickedImages((prev) => prev.filter((_, i) => i !== idx));
    if (previewIndex >= idx && previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
    }
  };

  // ------ Create ------
  const createArtefact = async () => {
    if (!projectId) return;
    if (!name.trim()) {
      showAlert("Error", "Please enter an artefact name");
      return;
    }

    try {
      setCreating(true);

      // Ensure Artefacts folder exists
      const root = await fileService.listRoot(projectId);
      let artefactFolder = root.find(
        (n: any) => n.type === "folder" && n.name === "Artefacts",
      );
      if (!artefactFolder) {
        artefactFolder = await fileService.createFolder(projectId, "Artefacts");
      }

      // Sequence number
      const children = await fileService.listChildren(artefactFolder.id);
      const existingFolders = children.filter((c: any) => c.type === "folder");
      const number = existingFolders.length + 1;

      // Create folder
      const folder = await fileService.createFolder(
        projectId,
        name.trim(),
        artefactFolder.id as any,
      );

      // Upload images
      for (const img of pickedImages) {
        const fd = new FormData();
        fd.append("parent_id", String(folder.id));
        if (Platform.OS === "web") {
          const blob = await fetch(img.uri).then((r) => r.blob());
          const file = new File([blob], img.name, { type: img.mime });
          fd.append("file", file, img.name);
        } else {
          fd.append("file", {
            uri: img.uri,
            name: img.name,
            type: img.mime,
          } as any);
        }
        await fileService.uploadFormData(projectId, fd);
      }

      // Generate preview (web only)
      let previewFileId: string | undefined;
      if (Platform.OS === "web" && pickedImages[previewIndex]) {
        try {
          const blob = await downscaleWebImage(
            pickedImages[previewIndex].uri,
            512,
            512,
            0.6,
          );
          const fd = new FormData();
          fd.append("parent_id", String(folder.id));
          const file = new File([blob], "preview.jpg", {
            type: "image/jpeg",
          });
          fd.append("file", file, "preview.jpg");
          const up = await fileService.uploadFormData(projectId, fd);
          previewFileId = up.id || up.file_id || up.node_id || up?.file?.id;
        } catch (e) {
          console.warn("Preview generation failed", e);
        }
      }

      // Upload notes as text files
      for (let idx = 0; idx < notes.length; idx++) {
        const content = notes[idx]?.trim();
        if (!content) continue;
        const fd = new FormData();
        fd.append("parent_id", String(folder.id));
        if (Platform.OS === "web") {
          const blob = new Blob([content], { type: "text/plain" });
          const file = new File([blob], `note-${idx + 1}.txt`, {
            type: "text/plain",
          });
          fd.append("file", file, `note-${idx + 1}.txt`);
        } else {
          // On native, write content to a temp file, then upload
          const tmpPath = `${FileSystem.cacheDirectory}note-${idx + 1}.txt`;
          await FileSystem.writeAsStringAsync(tmpPath, content, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          fd.append("file", {
            uri: tmpPath,
            name: `note-${idx + 1}.txt`,
            type: "text/plain",
          } as any);
        }
        await fileService.uploadFormData(projectId, fd);
      }

      // Build artefact.json manifest
      const freshChildren = await fileService.listChildren(folder.id);

      // Register a unique QR code via backend
      let artefactQrCode = "";
      try {
        const qrEntry = await qrService.create("artefact", folder.id, projectId, {
          name: name.trim(),
          number,
        });
        artefactQrCode = qrEntry.code;
        setQrCode(artefactQrCode);
      } catch (e) {
        console.warn("QR code registration failed", e);
      }

      // Build manifest with all metadata and children
      const manifest = buildManifestFromChildren(
        folder.id,
        name.trim(),
        number,
        freshChildren as any,
        {
          createdAt: new Date().toISOString(),
          createdBy: user || undefined,
          previewFileId,
          harrisMatrixContextId: selectedHmContext || undefined,
          latitude: latitude ? parseFloat(latitude) : undefined,
          longitude: longitude ? parseFloat(longitude) : undefined,
        },
        { user: user || undefined, qrUrl: artefactQrCode || undefined },
      );
      // Upload artefact.json manifest
      const manifestJson = JSON.stringify(manifest, null, 2);
      const manifestFd = new FormData();
      manifestFd.append("parent_id", String(folder.id));
      if (Platform.OS === "web") {
        const blob = new Blob([manifestJson], {
          type: "application/json",
        });
        const file = new File([blob], "artefact.json", {
          type: "application/json",
        });
        manifestFd.append("file", file, "artefact.json");
      } else {
        const tmpPath = `${FileSystem.cacheDirectory}artefact.json`;
        await FileSystem.writeAsStringAsync(tmpPath, manifestJson, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        manifestFd.append("file", {
          uri: tmpPath,
          name: "artefact.json",
          type: "application/json",
        } as any);
      }
      await fileService.uploadFormData(projectId, manifestFd);

      showAlert("Success", "Artefact created successfully!");
      router.back();
    } catch (e: any) {
      console.error("Failed to create artefact", e);
      showAlert(
        "Error",
        e?.detail || e?.message || "Failed to create artefact. Please try again.",
      );
    } finally {
      setCreating(false);
    }
  };

  // ------ Render ------
  return (
    <View style={s.container}>
      <Stack.Screen
        options={{
          title: "New Artefact",
          headerTransparent: isIOS,
          headerBlurEffect: isIOS ? "systemChromeMaterial" : undefined,
          headerStyle: isIOS
            ? {}
            : { backgroundColor: isDarkMode ? "#111111" : "#F7F7F7" },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: {
            color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
            fontWeight: "600",
          },
          headerBackTitle: "Project",
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
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
                <Text style={{ color: "#FF2A2A", fontSize: 17, marginLeft: 4 }}>
                  Project
                </Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={s.scrollView}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header icon */}
        <View style={s.headerIcon}>
          <Ionicons name="cube" size={48} color="#FF2A2A" />
        </View>

        <Text style={s.title}>New Artefact</Text>
        <Text style={s.subtitle}>
          Document an artefact with photos, notes, and a QR code for field
          identification
        </Text>

        {/* ── Name card ── */}
        <GlassCard style={s.formCard}>
          <View style={s.inputGroup}>
            <Text style={s.label}>
              <Ionicons name="text" size={14} color="#9A9A9A" /> Artefact Name
            </Text>
            <TextInput
              style={s.input}
              placeholder="e.g., Bronze Age Vessel Fragment"
              placeholderTextColor={isDarkMode ? "#555555" : "#888888"}
              value={name}
              onChangeText={setName}
              autoFocus={Platform.OS !== "ios"}
              editable={!creating}
              onSubmitEditing={(e) => e.preventDefault?.()}
              returnKeyType="done"
              blurOnSubmit={true}
            />
          </View>
        </GlassCard>

        {/* ── Images card ── */}
        <GlassCard style={s.formCard}>
          <View style={s.sectionHeader}>
            <Text style={s.label}>
              <Ionicons name="images" size={14} color="#9A9A9A" /> Pictures
            </Text>
            <TouchableOpacity onPress={pickImages} style={s.inlineBtn}>
              <Ionicons name="add-circle" size={18} color="#FF2A2A" />
              <Text style={s.inlineBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {pickedImages.length === 0 ? (
            <Text style={s.hint}>No images selected</Text>
          ) : (
            <View style={{ gap: 8, marginTop: 4 }}>
              {pickedImages.map((img, idx) => (
                <View
                  key={idx}
                  style={[s.imageRow, previewIndex === idx && s.imageRowActive]}
                >
                  {Platform.OS === "web" && (
                    <Image
                      source={{ uri: img.uri }}
                      style={s.imageThumb}
                      resizeMode="cover"
                    />
                  )}
                  <Text style={s.imageRowName} numberOfLines={1}>
                    {img.name}
                  </Text>
                  <View
                    style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
                  >
                    <TouchableOpacity onPress={() => setPreviewIndex(idx)}>
                      <Text
                        style={{
                          color: previewIndex === idx ? "#FF2A2A" : "#9A9A9A",
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {previewIndex === idx ? "Preview ✓" : "Set preview"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeImage(idx)}>
                      <Ionicons name="close-circle" size={20} color="#9A9A9A" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </GlassCard>

        {/* ── Notes card ── */}
        <GlassCard style={s.formCard}>
          <View style={s.sectionHeader}>
            <Text style={s.label}>
              <Ionicons name="document-text" size={14} color="#9A9A9A" /> Field Notes
              <Text style={s.optionalLabel}> (optional)</Text>
            </Text>
            <TouchableOpacity
              onPress={() => setNotes((n) => [...n, ""])}
              style={s.inlineBtn}
            >
              <Ionicons name="add-circle" size={18} color="#FF2A2A" />
              <Text style={s.inlineBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {notes.map((n, i) => (
            <View key={i} style={{ marginBottom: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <Text style={[s.hint, { marginBottom: 0 }]}>Note {i + 1}</Text>
                {notes.length > 1 && (
                  <TouchableOpacity
                    onPress={() =>
                      setNotes((arr) => arr.filter((_, idx) => idx !== i))
                    }
                  >
                    <Ionicons name="trash" size={16} color="#9A9A9A" />
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={[s.input, s.textArea]}
                placeholder="Describe the artefact, context, layer, observations..."
                placeholderTextColor={isDarkMode ? "#555555" : "#888888"}
                value={n}
                onChangeText={(t) =>
                  setNotes((arr) => arr.map((x, idx) => (idx === i ? t : x)))
                }
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!creating}
                blurOnSubmit={false}
              />
            </View>
          ))}
        </GlassCard>

        {/* ── Harris Matrix Context card ── */}
        {hmContexts.length > 0 && (
          <GlassCard style={s.formCard}>
            <Text style={s.label}>
              <Ionicons name="git-network" size={14} color="#9A9A9A" /> Stratigraphic
              Context
              <Text style={s.optionalLabel}> (optional)</Text>
            </Text>
            <Text style={s.hint}>Link this artefact to a Harris Matrix context</Text>
            <TouchableOpacity
              style={[
                s.input,
                {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                },
              ]}
              onPress={() => setShowHmPicker(true)}
            >
              <Text
                style={{
                  color: selectedHmContext
                    ? isDarkMode
                      ? "#F5F5F5"
                      : "#1A1A1A"
                    : isDarkMode
                      ? "#555555"
                      : "#888888",
                  fontSize: 16,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {selectedHmContext
                  ? (() => {
                      const ctx = hmContexts.find((c) => c.id === selectedHmContext);
                      return ctx
                        ? `[${ctx.type.toUpperCase()}] ${ctx.id}${ctx.description ? " — " + ctx.description : ""}`
                        : selectedHmContext;
                    })()
                  : "Select a context…"}
              </Text>
              {selectedHmContext ? (
                <TouchableOpacity
                  onPress={() => setSelectedHmContext(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={20} color="#9A9A9A" />
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-down" size={18} color="#9A9A9A" />
              )}
            </TouchableOpacity>
          </GlassCard>
        )}

        {/* ── GPS Coordinates card ── */}
        <GlassCard style={s.formCard}>
          <Text style={s.label}>
            <Ionicons name="location" size={14} color="#9A9A9A" /> GPS Coordinates
            <Text style={s.optionalLabel}> (optional)</Text>
          </Text>
          <Text style={s.hint}>Exact find-spot coordinates for GIS mapping</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: isDarkMode ? "#666666" : "#7A7A7A",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                Latitude
              </Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 44.4268"
                placeholderTextColor={isDarkMode ? "#555555" : "#888888"}
                value={latitude}
                onChangeText={setLatitude}
                keyboardType="numeric"
                editable={!creating}
                returnKeyType="done"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: isDarkMode ? "#666666" : "#7A7A7A",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                Longitude
              </Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 26.1025"
                placeholderTextColor={isDarkMode ? "#555555" : "#888888"}
                value={longitude}
                onChangeText={setLongitude}
                keyboardType="numeric"
                editable={!creating}
                returnKeyType="done"
              />
            </View>
          </View>
        </GlassCard>

        {/* ── QR preview card ── */}
        <GlassCard style={s.formCard}>
          <Text style={s.label}>
            <Ionicons name="qr-code" size={14} color="#9A9A9A" /> QR Code Preview
          </Text>
          <Text style={s.hint}>
            A unique QR code will be generated after creation
          </Text>
          <View style={{ alignItems: "center", marginTop: 8 }}>
            <QRCodeView
              value={qrCode || qrPreviewValue}
              label={`${name || "Artefact"} #—`}
              onReadyDataUrl={setQrDataUrl}
            />
          </View>
          {Platform.OS === "web" && qrDataUrl && (
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                marginTop: 12,
                justifyContent: "center",
              }}
            >
              <TouchableOpacity
                style={s.inlineBtn}
                onPress={() =>
                  printQr(
                    qrDataUrl,
                    `${name || "artefact"}-qr.png`,
                    `${name || "Artefact"} #—`,
                  )
                }
              >
                <Ionicons name="print" size={16} color="#FF2A2A" />
                <Text style={s.inlineBtnText}>Print</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.inlineBtn}
                onPress={() =>
                  downloadDataUrl(qrDataUrl, `${name || "artefact"}-qr.png`)
                }
              >
                <Ionicons name="download" size={16} color="#FF2A2A" />
                <Text style={s.inlineBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
        </GlassCard>

        {/* ── Buttons ── */}
        {/* ── Buttons ── */}
        <View style={s.buttonContainer}>
          <GlassButton
            onPress={createArtefact}
            title="Create Artefact"
            variant="primary"
            icon="add-circle"
            disabled={!name.trim()}
            loading={creating}
          />
          <GlassButton
            onPress={() => router.back()}
            title="Cancel"
            variant="secondary"
          />
        </View>
      </ScrollView>

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
            backgroundColor: isDarkMode ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.24)",
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
              backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                padding: 20,
                borderBottomWidth: 1,
                borderBottomColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
                }}
              >
                Select Context
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: isDarkMode ? "#666666" : "#7A7A7A",
                  marginTop: 4,
                }}
              >
                Link to a Harris Matrix stratigraphic context
              </Text>
            </View>
            <FlatList
              data={hmContexts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 8 }}
              renderItem={({ item }) => {
                const isSelected = selectedHmContext === item.id;
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
                        : isDarkMode
                          ? "transparent"
                          : "#F8F8F8",
                    }}
                    onPress={() => {
                      setSelectedHmContext(item.id);
                      setShowHmPicker(false);
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
                          color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
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
                            color: isDarkMode ? "#888888" : "#666666",
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
                    color: isDarkMode ? "#666666" : "#7A7A7A",
                    textAlign: "center",
                    padding: 20,
                  }}
                >
                  No contexts found in Harris Matrix
                </Text>
              }
            />
            <TouchableOpacity
              style={{
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
                alignItems: "center",
              }}
              onPress={() => setShowHmPicker(false)}
            >
              <Text
                style={{
                  color: isDarkMode ? "#9A9A9A" : "#666666",
                  fontWeight: "600",
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function downscaleWebImage(
  uri: string,
  maxW: number,
  maxH: number,
  quality = 0.7,
): Promise<Blob> {
  const img = document.createElement("img");
  img.crossOrigin = "anonymous";
  img.src = uri;
  await new Promise((res, rej) => {
    img.onload = () => res(null);
    img.onerror = rej;
  });
  let { width, height } = img;
  const scale = Math.min(maxW / width, maxH / height, 1);
  width = Math.floor(width * scale);
  height = Math.floor(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, width, height);
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b || new Blob()), "image/jpeg", quality),
  );
}

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

// ---------------------------------------------------------------------------
// Styles — matches modal.tsx / join-project.tsx pattern
// ---------------------------------------------------------------------------
const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    scrollView: { flex: 1 },
    content: { padding: 24, paddingTop: 24, paddingBottom: 48 },
    headerIcon: { alignItems: "center", marginBottom: 16, marginTop: 16 },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: isDarkMode ? "#FFFFFF" : "#1A1A1A",
      textAlign: "center",
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      textAlign: "center",
      marginBottom: 32,
      lineHeight: 22,
    },
    // Card variants
    formCard: { marginBottom: 16 },
    glassCard: { borderRadius: 20, padding: 20, overflow: "hidden" },
    blurCard: {
      borderRadius: 20,
      padding: 20,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDarkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.12)",
    },
    solidCard: {
      borderRadius: 20,
      padding: 20,
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    // Inputs
    inputGroup: { marginBottom: 4 },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginBottom: 8,
    },
    optionalLabel: { fontWeight: "400", color: isDarkMode ? "#666666" : "#7A7A7A" },
    hint: {
      fontSize: 13,
      color: isDarkMode ? "#666666" : "#7A7A7A",
      marginBottom: 12,
    },
    input: {
      backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "#FFFFFF",
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: isDarkMode ? "#FFFFFF" : "#1A1A1A",
      borderWidth: 1,
      borderColor: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "#D9D9D9",
    },
    textArea: { height: 100, textAlignVertical: "top" },
    // Section header
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    inlineBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    inlineBtnText: { color: "#FF2A2A", fontWeight: "600", fontSize: 13 },
    // Image row
    imageRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.05)" : "#F4F4F4",
      borderRadius: 12,
      padding: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "#E4E4E4",
      gap: 10,
    },
    imageRowActive: { borderColor: "#FF2A2A" },
    imageThumb: { width: 40, height: 40, borderRadius: 8 },
    imageRowName: {
      flex: 1,
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 14,
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
    secondaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    disabledButton: { opacity: 0.5 },
    buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
    secondaryButtonText: { color: isDarkMode ? "#9A9A9A" : "#666666" },
  });

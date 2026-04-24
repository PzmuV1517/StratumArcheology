/**
 * @file
 * Project file gallery component.
 *
 * Displays project files in a grid or list layout with
 * thumbnails and metadata.
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
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { fileService } from "../../services/fileService";
import { useColorScheme } from "../../hooks/use-color-scheme";
import { IconSymbol } from "@/components/ui/icon-symbol";

type Mode = "day" | "week" | "month";

interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder" | "note";
  mime_type?: string;
  note_id?: string;
  created_at?: string;
  updated_at?: string;
}

export default function FileGallery({
  projectId,
  onOpenItem,
}: {
  projectId: string;
  onOpenItem: (node: FileNode) => void;
}) {
  const { width: _width } = useWindowDimensions();
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const controlIconColor = isDarkMode ? "#9A9A9A" : "#666666";
  const controlIconActiveColor = "#F5F5F5";
  const tileIconColor = isDarkMode ? "#F5F5F5" : "#1A1A1A";

  const [mode, setMode] = useState<Mode>("day");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [FaListIcon, setFaListIcon] = useState<React.ComponentType<{
    color?: string;
    size?: number;
  }> | null>(null);
  const [IoGridIcon, setIoGridIcon] = useState<React.ComponentType<{
    color?: string;
    size?: number;
  }> | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const list = await fetchAllProjectFiles(projectId);
        if (mounted) setFiles(list);
      } catch (e) {
        console.error("Failed to load gallery files", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  // Web-only dynamic import for icons to avoid bundling issues on native
  useEffect(() => {
    if (Platform.OS !== "web") return;
    import("react-icons/fa")
      .then((mod) => {
        setFaListIcon(() => mod.FaList);
      })
      .catch(() => {});
    import("react-icons/io5")
      .then((mod) => setIoGridIcon(() => mod.IoGridOutline))
      .catch(() => {});
  }, []);

  const groups = useMemo(() => groupFiles(files, mode), [files, mode]);

  // Fixed card sizing and spacing; wrap to next row if it doesn't fit
  const gridGap = Platform.OS === "web" ? 8 : 10;
  const TILE_WIDTH = 145; // px, consistent across sizes
  const tilePadding = 8;
  const iconSize = 20;
  const nameFontSize = 12;

  return (
    <View>
      <View style={styles.controlsRow}>
        {/* Left: D / W / M */}
        <View style={styles.controls}>
          {(["day", "week", "month"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                {m === "day" ? "D" : m === "week" ? "W" : "M"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Right: Grid/List switcher */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.modeBtn, view === "grid" && styles.modeBtnActive]}
            onPress={() => setView("grid")}
          >
            {Platform.OS === "web" && IoGridIcon ? (
              <IoGridIcon
                color={view === "grid" ? controlIconActiveColor : controlIconColor}
                size={16}
              />
            ) : (
              <Text
                style={[styles.modeText, view === "grid" && styles.modeTextActive]}
              >
                ▦
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, view === "list" && styles.modeBtnActive]}
            onPress={() => setView("list")}
          >
            {Platform.OS === "web" && FaListIcon ? (
              <FaListIcon
                color={view === "list" ? controlIconActiveColor : controlIconColor}
                size={16}
              />
            ) : (
              <Text
                style={[styles.modeText, view === "list" && styles.modeTextActive]}
              >
                ≣
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#FF2A2A" />
          <Text style={styles.loadingText}>Loading gallery…</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No files</Text>
          <Text style={styles.emptyStateSubtitle}>
            Upload or create files to see them here
          </Text>
        </View>
      ) : (
        groups.map((group, idx) => (
          <View key={group.label + idx} style={styles.groupSection}>
            <Text style={styles.groupHeader}>{group.label}</Text>
            {view === "grid" ? (
              <View style={[styles.grid, { gap: gridGap }]}>
                {group.items.map((node) => (
                  <TouchableOpacity
                    key={node.id}
                    style={[
                      styles.tile,
                      { width: TILE_WIDTH, padding: tilePadding },
                    ]}
                    onPress={() => onOpenItem(node)}
                  >
                    <View style={styles.thumb}>
                      <IconSymbol
                        name={symbolFor(node) as any}
                        size={iconSize}
                        color={tileIconColor}
                      />
                    </View>
                    <Text
                      style={[styles.name, { fontSize: nameFontSize }]}
                      numberOfLines={2}
                    >
                      {node.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View>
                {group.items.map((node) => (
                  <TouchableOpacity
                    key={node.id}
                    style={styles.listRow}
                    onPress={() => onOpenItem(node)}
                  >
                    <View style={styles.listIcon}>
                      <IconSymbol
                        name={symbolFor(node) as any}
                        size={18}
                        color={tileIconColor}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listName} numberOfLines={1}>
                        {node.name}
                      </Text>
                      <Text style={styles.listMeta}>{formatWhen(node)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );
}

async function fetchAllProjectFiles(projectId: string): Promise<FileNode[]> {
  const root = await fileService.listRoot(projectId);
  const files: FileNode[] = [];
  const queue: any[] = [];
  for (const n of root) {
    if (n.type === "folder") queue.push(n);
    else files.push(n);
  }
  while (queue.length) {
    const folder = queue.shift();
    try {
      const children = await fileService.listChildren(folder.id);
      for (const c of children) {
        if (c.type === "folder") queue.push(c);
        else files.push(c);
      }
    } catch (_e) {
      console.warn("Failed to list children for folder", folder?.id);
    }
  }
  return files;
}

function groupFiles(files: FileNode[], mode: Mode) {
  const groups = new Map<
    string,
    { label: string; dateKey: number; items: FileNode[] }
  >();
  // Only derive a date from persisted timestamps; avoid Date.now() which is unstable across server/client
  const toDate = (n: FileNode) => {
    const ts = n?.created_at || n?.updated_at;
    return ts ? new Date(ts) : null;
  };

  const startOfWeek = (d: Date) => {
    const tmp = new Date(d);
    const day = tmp.getDay();
    const diff = (day + 6) % 7; // Monday start
    tmp.setHours(0, 0, 0, 0);
    tmp.setDate(tmp.getDate() - diff);
    return tmp;
  };
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

  for (const n of files) {
    const d = toDate(n);
    if (!d) {
      const key = "UNKNOWN";
      if (!groups.has(key))
        groups.set(key, { label: "Unknown date", dateKey: -Infinity, items: [] });
      groups.get(key)!.items.push(n);
      continue;
    }
    let key = "";
    let label = "";
    let sortDate = 0;
    if (mode === "day") {
      key = d.toISOString().slice(0, 10);
      label = d.toLocaleDateString(undefined, { timeZone: "UTC" });
      sortDate = new Date(key).getTime();
    } else if (mode === "week") {
      const s = startOfWeek(d);
      key = `W:${s.toISOString().slice(0, 10)}`;
      label = `Week of ${s.toLocaleDateString(undefined, { timeZone: "UTC" })}`;
      sortDate = s.getTime();
    } else {
      const s = startOfMonth(d);
      key = `M:${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}`;
      label = `${s.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${s.getFullYear()}`;
      sortDate = s.getTime();
    }
    if (!groups.has(key)) groups.set(key, { label, dateKey: sortDate, items: [] });
    groups.get(key)!.items.push(n);
  }
  const out = Array.from(groups.values());
  out.sort((a, b) => b.dateKey - a.dateKey);
  out.forEach((g) =>
    g.items.sort(
      (a, b) =>
        +new Date(b.created_at || b.updated_at || 0) -
        +new Date(a.created_at || a.updated_at || 0),
    ),
  );
  return out;
}

function symbolFor(node: FileNode) {
  const lower = (node.name || "").toLowerCase();
  if (
    (node.mime_type && node.mime_type.startsWith("image/")) ||
    /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.heic)$/i.test(lower)
  )
    return "photo.on.rectangle";
  if (node.type === "note") return "note.text";
  if (lower.endsWith(".csv")) return "chart.bar.fill";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls"))
    return "chart.bar.doc.horizontal";
  if (lower.endsWith(".md") || lower.endsWith(".txt") || lower.endsWith(".pdf"))
    return "note.text";
  if (lower.match(/\.(mp4|webm|ogg|mov)$/)) return "photo.on.rectangle";
  if (/\.(las|laz|ply|e57|pcd|rwi|rwp)$/i.test(lower)) return "cube.fill"; // point clouds
  if (/\.(glb|gltf)$/i.test(lower)) return "cube.fill"; // 3D meshes
  if (/\.(mp3|wav|webm|m4a|aac|ogg)$/i.test(lower)) return "chart.bar.xaxis"; // audio files
  return "folder.fill";
}

function formatWhen(node: FileNode) {
  const d = new Date(node.created_at || node.updated_at || Date.now());
  return d.toLocaleString();
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    controlsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
      paddingHorizontal: 2,
    },
    controls: {
      flexDirection: "row",
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    modeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    modeBtnActive: { backgroundColor: "#FF2A2A" },
    modeText: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    modeTextActive: { color: "#F5F5F5" },
    loadingState: { paddingVertical: 24, alignItems: "center" },
    loadingText: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginTop: 8,
    },
    emptyState: { alignItems: "center", paddingVertical: 48 },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 8,
      letterSpacing: 0.5,
    },
    emptyStateSubtitle: {
      fontSize: 14,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginBottom: 24,
      letterSpacing: 0.5,
    },
    groupSection: { marginBottom: 24 },
    groupHeader: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontWeight: "700",
      marginBottom: 8,
      letterSpacing: 0.5,
    },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    tile: {
      width: "31%",
      minWidth: 120,
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
      padding: 8,
    },
    thumb: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 8,
      backgroundColor: isDarkMode ? "#0A0A0A" : "#F1F1F1",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
    },
    name: { color: isDarkMode ? "#CFCFCF" : "#4D4D4D", fontSize: 12 },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
      padding: 10,
      marginBottom: 8,
    },
    listIcon: {
      width: 24,
      alignItems: "center",
      marginRight: 10,
    },
    listName: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 14,
      fontWeight: "600",
    },
    listMeta: { color: isDarkMode ? "#9A9A9A" : "#666666", fontSize: 12 },
  });

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { fileService } from "../src/services/fileService";
import TextFilePanel from "../src/components/data/TextFilePanel";
import CsvPanel from "../src/components/data/CsvPanel";
import ExcelPanel from "../src/components/data/ExcelPanel";
import { useAutoSave } from "../src/hooks/useAutoSave";

import PdfPanel from "../src/components/data/PdfPanel.web";
import VideoPanel from "../src/components/data/VideoPanel.web";
import PointCloudPanel from "../src/components/data/PointCloudPanel.web";
import MeshPanel from "../src/components/data/MeshPanel.web";
import AudioPanel from "../src/components/data/AudioPanel.web";
import * as FileSystemLegacy from "expo-file-system/legacy";

// Lazy import to avoid native bundling issues
let Papa: any = null;
let XLSX: any = null;
let AutoSizer: any = null;
let VariableSizeGrid: any = null;

export default function DataPreviewScreen() {
  const { nodeId, name, kind } = useLocalSearchParams<{
    nodeId: string;
    name: string;
    kind?: string;
  }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [table, setTable] = useState<string[][] | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [gridReady, setGridReady] = useState(false);
  const [originalTitle, setOriginalTitle] = useState<string>("");
  const [editableTitle, setEditableTitle] = useState<string>("");
  const [isNoteFile, setIsNoteFile] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [pointUrl, setPointUrl] = useState<string | null>(null);
  const [meshUrl, setMeshUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1); // web zoom for preview types
  const [showDraftRecoveryModal, setShowDraftRecoveryModal] = useState(false);
  const [pendingDraftData, setPendingDraftData] = useState<{
    textContent?: string;
    table?: string[][];
  } | null>(null);
  const wrapperRef = useRef<any>(null);
  // markdown handled by TextFilePanel
  const gridRef = useRef<any>(null);
  const defaultCols = 1000; // virtual infinite feel
  const defaultRows = 1000;
  const colWidthPx = 96; // ~12ch monospace approximation in px
  const rowHeaderWidth = 28; // slimmer index column
  const rowHeightPx = 30;
  const [gridScroll, setGridScroll] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  // Determine if file is editable (text or spreadsheet only)
  const isEditableFile = useMemo(() => {
    const ext = (name as string)?.toLowerCase() || "";
    return (
      ext.endsWith(".txt") ||
      ext.endsWith(".md") ||
      ext.endsWith(".json") ||
      ext.endsWith(".csv") ||
      ext.endsWith(".xlsx") ||
      ext.endsWith(".xls")
    );
  }, [name]);

  // AutoSave hook - only for editable files
  const {
    saveStatus,
    wasRestored,
    saveDraft,
    clearDraft,
    hasDraft,
    getDraft,
    scheduleAutoSave,
  } = useAutoSave<{
    textContent?: string | null;
    table?: string[][] | null;
    editableTitle?: string;
  }>({
    formId: `data-preview-${nodeId}`,
    initialData: { textContent: null, table: null, editableTitle: "" },
    skipRestore: true, // We'll handle restore manually to show confirmation
    onRestore: (data) => {
      if (data.textContent !== undefined && data.textContent !== null)
        setTextContent(data.textContent);
      if (data.table) setTable(data.table);
      if (data.editableTitle) setEditableTitle(data.editableTitle);
    },
  });

  // Check for draft on mount and show recovery modal
  useEffect(() => {
    if (!isEditableFile || !nodeId) return;
    (async () => {
      const exists = await hasDraft();
      if (exists) {
        const draft = await getDraft();
        if (draft && (draft.textContent || draft.table)) {
          setPendingDraftData(draft as any);
          setShowDraftRecoveryModal(true);
        }
      }
    })();
  }, [nodeId, isEditableFile]);

  // Auto-save when content changes (debounced)
  useEffect(() => {
    if (!editing || !dirty || !isEditableFile) return;
    scheduleAutoSave({ textContent, table, editableTitle });
  }, [
    textContent,
    table,
    editableTitle,
    editing,
    dirty,
    isEditableFile,
    scheduleAutoSave,
  ]);

  // Inject global CSS for markdown rendering on web once
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const STYLE_ID = "stratum-markdown-styles";
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* Global markdown styles for web */
      .markdown-body { color: #EAEAEA; line-height: 1.6; font-size: 14px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 { color: #F5F5F5; margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 600; }
      .markdown-body h1 { font-size: 2em; border-bottom: 1px solid #333; padding-bottom: 0.3em; }
      .markdown-body h2 { font-size: 1.5em; }
      .markdown-body h3 { font-size: 1.25em; }
      .markdown-body p { margin: 0 0 1em 0; color: #EAEAEA; }
      .markdown-body code { background: #1A1A1A; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.95em; font-family: SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; color: #FF6B6B; }
      .markdown-body pre { background: #0A0A0A; padding: 1em; border-radius: 6px; overflow: auto; margin: 0 0 1em 0; }
      .markdown-body pre code { background: transparent; padding: 0; color: #EAEAEA; }
      .markdown-body blockquote { border-left: 4px solid #FF2A2A; padding-left: 1em; margin-left: 0; color: #CCCCCC; font-style: italic; }
      .markdown-body ul, .markdown-body ol { padding-left: 2em; margin: 0 0 1em 0; }
      .markdown-body li { margin-bottom: 0.5em; }
      .markdown-body a { color: #FF2A2A; text-decoration: none; }
      .markdown-body a:hover { text-decoration: underline; }
      .markdown-body table { border-collapse: collapse; width: 100%; margin: 0 0 1em 0; }
      .markdown-body th, .markdown-body td { border: 1px solid #333; padding: 0.5em; text-align: left; }
      .markdown-body th { background: #1A1A1A; font-weight: 600; }
      .markdown-body img { max-width: 100%; height: auto; }
      .markdown-body hr { border: none; border-top: 1px solid #333; margin: 1.5em 0; }
      /* Extra elements */
      .markdown-body mark { background: #665500; color: #fff3cd; padding: 0.1em 0.2em; border-radius: 2px; }
      .markdown-body ins { text-decoration: none; border-bottom: 2px solid #1db954; background: rgba(29,185,84,0.1); }
      .markdown-body sup { vertical-align: super; font-size: 0.75em; }
      .markdown-body sub { vertical-align: sub; font-size: 0.75em; }
      /* KaTeX layout */
      .markdown-body .katex-display { margin: 1em 0; overflow-x: auto; }
      .markdown-body .katex { font-size: 1em; }
      /* Preview viewport refinements */
      #preview-viewport { outline: none !important; background-color: #111111 !important; }
      #preview-viewport *:focus { outline: none !important; }
      #preview-content { transform-origin: 0 0 !important; background-color: #111111 !important; }
      #preview-viewport iframe { border: 0 !important; background: #111111 !important; }
      #preview-viewport model-viewer { background: #111111 !important; }
    `;
    document.head.appendChild(style);

    // Inject KaTeX CSS for math rendering
    const KATEX_ID = "stratum-katex-css";
    if (!document.getElementById(KATEX_ID)) {
      const link = document.createElement("link");
      link.id = KATEX_ID;
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }
  }, []);

  const ensureSize = useCallback((r: number, c: number) => {
    setTable((prev) => {
      if (!prev) return prev;
      const rows = prev.slice();
      while (rows.length <= r) rows.push([] as any);
      const row = rows[r] ? rows[r].slice() : [];
      while (row.length <= c) row.push("");
      rows[r] = row;
      return rows;
    });
  }, []);

  // Wrap a string at fixed N-character chunks with explicit newlines
  const WRAP_CHARS = 12;
  const wrap15 = (value: any): string => {
    const s = String(value ?? "");
    if (!s) return "";
    const out: string[] = [];
    for (let i = 0; i < s.length; i += WRAP_CHARS) {
      out.push(s.slice(i, i + WRAP_CHARS));
    }
    return out.join("\n");
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ext = (name as string)?.toLowerCase() || "";

        if (Platform.OS !== "web") {
          // Native: download file and use local URI
          const res = await fileService.downloadFile(nodeId, name as string);
          if (!res || !res.uri) {
            throw new Error("Download failed - no result returned");
          }

          // Handle different file types on native
          // Audio
          if (
            /\.(mp3|wav|webm|m4a|aac|ogg)$/i.test(ext) ||
            kind === "audio" ||
            res.mimeType?.startsWith("audio/")
          ) {
            if (!cancelled) {
              setAudioUrl(res.uri);
              setLoading(false);
            }
            return;
          }

          // Video
          if (
            /\.(mp4|webm|ogg|mov)$/i.test(ext) ||
            kind === "video" ||
            res.mimeType?.startsWith("video/")
          ) {
            if (!cancelled) {
              setVideoUrl(res.uri);
              setLoading(false);
            }
            return;
          }

          // PDF
          if (ext.endsWith(".pdf") || kind === "pdf") {
            if (!cancelled) {
              setPdfUrl(res.uri);
              setLoading(false);
            }
            return;
          }

          // Mesh (3D models)
          if (/\.(glb|gltf)$/i.test(ext) || kind === "mesh") {
            if (!cancelled) {
              setMeshUrl(res.uri);
              setLoading(false);
            }
            return;
          }

          // Point cloud
          if (/\.(las|laz|ply|pcd|rwi|rwp)$/i.test(ext) || kind === "pointcloud") {
            if (!cancelled) {
              setPointUrl(res.uri);
              setLoading(false);
            }
            return;
          }

          // Text-based files - read content
          const content = await fileService.readFileAsText(res.uri);
          if (!cancelled) {
            setTextContent(content);
            if (ext.endsWith(".txt")) {
              setIsNoteFile(true);
              const filename = (name as string) || "";
              const titleWithoutExt = filename.endsWith(".txt")
                ? filename.slice(0, -4)
                : filename;
              setOriginalTitle(titleWithoutExt);
              setEditableTitle(titleWithoutExt);
            }
          }
          setLoading(false);
          return;
        }

        // Web: downloadFile returns { blob, contentLength, mimeType }
        const { blob } = await fileService.downloadFile(nodeId);

        // AUDIO FIRST (handles audio/webm)
        const isBlobAudio = blob.type && /^audio\//.test(blob.type);
        if (
          isBlobAudio ||
          /\.(mp3|wav|webm|m4a|aac|ogg)$/i.test(ext) ||
          kind === "audio"
        ) {
          const url = window.URL.createObjectURL(blob);
          if (!cancelled) {
            setAudioUrl(url);
            setPdfUrl(null);
            setVideoUrl(null);
            setPointUrl(null);
            setMeshUrl(null);
            setTable(null);
            setTextContent(null);
          }
          return;
        }

        // PDF
        if (ext.endsWith(".pdf") || kind === "pdf") {
          const url = window.URL.createObjectURL(blob);
          if (!cancelled) {
            setPdfUrl(url);
            setVideoUrl(null);
            setPointUrl(null);
            setMeshUrl(null);
            setTable(null);
            setTextContent(null);
          }
          return;
        }

        // VIDEO (skip if blob was audio)
        const isVideoExt = /\.(mp4|webm|ogg|mov)$/i.test(ext) || kind === "video";
        const isBlobVideo = blob.type && /^video\//.test(blob.type);
        if (isVideoExt && isBlobVideo) {
          const url = window.URL.createObjectURL(blob);
          if (!cancelled) {
            setVideoUrl(url);
            setPdfUrl(null);
            setPointUrl(null);
            setMeshUrl(null);
            setAudioUrl(null);
            setTable(null);
            setTextContent(null);
          }
          return;
        }

        // MESH
        if (/\.(glb|gltf)$/i.test(ext) || kind === "mesh") {
          const url = window.URL.createObjectURL(blob);
          if (!cancelled) {
            setMeshUrl(url);
            setPdfUrl(null);
            setVideoUrl(null);
            setPointUrl(null);
            setAudioUrl(null);
            setTable(null);
            setTextContent(null);
          }
          return;
        }

        // POINT CLOUD
        if (/\.(las|laz|ply|pcd|rwi|rwp)$/i.test(ext) || kind === "pointcloud") {
          const url = window.URL.createObjectURL(blob);
          if (!cancelled) {
            setPointUrl(url);
            setPdfUrl(null);
            setVideoUrl(null);
            setMeshUrl(null);
            setAudioUrl(null);
            setTable(null);
            setTextContent(null);
          }
          return;
        }

        // TEXT / CSV / EXCEL (unchanged below)
        // Handle text files (txt, md, json)
        if (ext.endsWith(".txt") || ext.endsWith(".md") || ext.endsWith(".json")) {
          const text = await blob.text();
          // Handle empty files gracefully - set empty string instead of null
          setTextContent(text || "");
          if (ext.endsWith(".txt")) {
            setIsNoteFile(true);
            const filename = (name as string) || "";
            const titleWithoutExt = filename.endsWith(".txt")
              ? filename.slice(0, -4)
              : filename;
            setOriginalTitle(titleWithoutExt);
            setEditableTitle(titleWithoutExt);
          }
        } else {
          // Handle CSV/Excel files
          if (!Papa)
            Papa =
              (await import("papaparse")).default || (await import("papaparse"));
          if (!XLSX) XLSX = await import("xlsx");
          if (!AutoSizer)
            AutoSizer = (await import("react-virtualized-auto-sizer")).default;
          if (!VariableSizeGrid)
            VariableSizeGrid = (await import("react-window")).VariableSizeGrid;
          setGridReady(true);

          // (moved markdown preloading to the txt/md branch above)

          if (ext.endsWith(".csv")) {
            const text = await blob.text();
            const parsed = Papa.parse(text, { skipEmptyLines: true });
            if (parsed?.data) setTable(parsed.data as any);
            else setTextContent(text);
          } else if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
            const arrayBuffer = await blob.arrayBuffer();
            const wb = XLSX.read(arrayBuffer, { type: "array" });
            const firstSheet = wb.SheetNames[0];
            const ws = wb.Sheets[firstSheet];
            const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[];
            setTable(json as string[][]);
          } else {
            // Try CSV by MIME fallback
            try {
              const text = await blob.text();
              const parsed = Papa.parse(text, { skipEmptyLines: true });
              if (parsed?.data) setTable(parsed.data as any);
              else setTextContent(text);
            } catch {
              setError("Unsupported format for preview");
            }
          }
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nodeId, name, kind]);

  const handleDownload = async () => {
    try {
      if (Platform.OS === "web") {
        // Web: downloadFile returns { blob, contentLength, mimeType }
        const { blob } = await fileService.downloadFile(nodeId);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (name as string) || "download";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        Alert.alert("Download", "File downloaded (placeholder).");
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to download file");
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const ext = (name as string)?.toLowerCase() || "";
      let finalFilename = name as string;

      // Handle native platform
      if (Platform.OS !== "web") {
        // For text files on native, we need to upload the content to the server
        if (ext.endsWith(".txt") || ext.endsWith(".md") || ext.endsWith(".json")) {
          if (!textContent) {
            Alert.alert("Error", "No content to save");
            setSaving(false);
            return;
          }

          // For note files, check if title changed and update filename
          if (isNoteFile && editableTitle !== originalTitle) {
            const newFilename = `${editableTitle}.txt`;
            finalFilename = newFilename;
            try {
              await fileService.renameNode(nodeId as string, newFilename);
              setOriginalTitle(editableTitle);
            } catch (e) {
              console.error("Failed to rename file:", e);
              Alert.alert(
                "Warning",
                "Failed to rename file, but content will be saved.",
              );
            }
          }

          // Write content to a temp file, then upload it
          const tempDir =
            FileSystemLegacy.cacheDirectory || FileSystemLegacy.documentDirectory;
          if (!tempDir) {
            throw new Error("No cache directory available");
          }
          const tempPath = `${tempDir}temp_save_${Date.now()}.txt`;
          await FileSystemLegacy.writeAsStringAsync(tempPath, textContent);

          // Upload the file using the replaceFile method
          const mimeType = ext.endsWith(".json") ? "application/json" : "text/plain";
          await fileService.replaceFile(
            nodeId as string,
            tempPath,
            finalFilename,
            mimeType,
          );

          // Clean up temp file
          try {
            await FileSystemLegacy.deleteAsync(tempPath, { idempotent: true });
          } catch {
            // Ignore cleanup errors
          }

          setDirty(false);
          clearDraft();
          Alert.alert("Success", "File saved successfully");
        } else if (table) {
          // CSV/Excel on native - needs more complex handling
          Alert.alert(
            "Info",
            "Spreadsheet saving on native is coming soon. Please use web for now.",
          );
        }
        setSaving(false);
        return;
      }

      // Web platform handling below
      let blob: Blob;

      // Handle text files
      if (ext.endsWith(".txt") || ext.endsWith(".md") || ext.endsWith(".json")) {
        if (!textContent) return;
        const contentType = ext.endsWith(".json")
          ? "application/json"
          : "text/plain";
        blob = new Blob([textContent], { type: contentType });

        // For note files, check if title changed and update filename
        if (isNoteFile && editableTitle !== originalTitle) {
          const newFilename = `${editableTitle}.txt`;
          finalFilename = newFilename;

          // Rename the file first
          try {
            await fileService.renameNode(nodeId as string, newFilename);
            setOriginalTitle(editableTitle); // Update the original title
          } catch (e) {
            console.error("Failed to rename file:", e);
            Alert.alert(
              "Warning",
              "Failed to rename file, but content will be saved.",
            );
          }
        }
      } else if (table) {
        // Handle CSV/Excel files
        // Trim trailing empty rows/columns to avoid growing file size unnecessarily
        let trimmed = table.map((r) => r.slice());
        // Trim columns
        let maxCol = 0;
        for (const r of trimmed) {
          for (let i = r.length - 1; i >= 0; i--) {
            if (String(r[i] ?? "").length > 0) {
              maxCol = Math.max(maxCol, i + 1);
              break;
            }
          }
        }
        trimmed = trimmed.map((r) => r.slice(0, maxCol));
        // Trim rows
        let lastRow = trimmed.length - 1;
        while (lastRow >= 0) {
          const row = trimmed[lastRow] || [];
          const hasData = row.some((v) => String(v ?? "").length > 0);
          if (hasData) break;
          lastRow--;
        }
        trimmed = trimmed.slice(0, Math.max(0, lastRow + 1));

        if (ext.endsWith(".csv")) {
          if (!Papa)
            Papa =
              (await import("papaparse")).default || (await import("papaparse"));
          const csv = Papa.unparse(trimmed);
          blob = new Blob([csv], { type: "text/csv" });
        } else {
          if (!XLSX) XLSX = await import("xlsx");
          const ws = XLSX.utils.aoa_to_sheet(trimmed);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
          const wbout = XLSX.write(wb, {
            bookType: ext.endsWith(".xls") ? "xls" : "xlsx",
            type: "array",
          });
          blob = new Blob([wbout], {
            type: ext.endsWith(".xls")
              ? "application/vnd.ms-excel"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
        }
      } else {
        return;
      }

      // Upload via replaceFile
      const formData = new FormData();
      // On web, wrap blob in File so filename is sent
      const file =
        Platform.OS === "web"
          ? new File([blob], finalFilename, { type: blob.type })
          : (blob as any);
      formData.append("file", file as any, finalFilename);
      await fileService.replaceFile(nodeId as string, formData);
      // Keep current editing mode; do not force exit on save
      setDirty(false);
      // Clear draft after successful save
      await clearDraft();
      Alert.alert("Saved", "File updated successfully.");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to save file");
    } finally {
      setSaving(false);
    }
  };

  // Revoke object URLs on unmount/change
  useEffect(() => {
    return () => {
      if (Platform.OS === "web" && pdfUrl) {
        try {
          window.URL.revokeObjectURL(pdfUrl);
        } catch {}
      }
    };
  }, [pdfUrl]);

  useEffect(() => {
    return () => {
      if (Platform.OS === "web" && videoUrl) {
        try {
          window.URL.revokeObjectURL(videoUrl);
        } catch {}
      }
    };
  }, [videoUrl]);

  useEffect(() => {
    return () => {
      if (Platform.OS === "web" && pointUrl) {
        try {
          window.URL.revokeObjectURL(pointUrl);
        } catch {}
      }
    };
  }, [pointUrl]);

  useEffect(() => {
    return () => {
      if (Platform.OS === "web" && meshUrl) {
        try {
          window.URL.revokeObjectURL(meshUrl);
        } catch {}
      }
    };
  }, [meshUrl]);

  useEffect(() => {
    return () => {
      if (Platform.OS === "web" && audioUrl) {
        try {
          URL.revokeObjectURL(audioUrl);
        } catch {}
      }
    };
  }, [audioUrl]);

  const isPdf = useMemo(() => {
    const ext = (name as string)?.toLowerCase() || "";
    return ext.endsWith(".pdf") || kind === "pdf";
  }, [name, kind]);

  const isVideo = useMemo(() => {
    if (kind === "audio") return false;
    const ext = (name as string)?.toLowerCase() || "";
    if (/\.(mp4|webm|ogg|mov)$/i.test(ext) && audioUrl == null) return true;
    return kind === "video";
  }, [name, kind, audioUrl]);

  const isPoint = useMemo(() => {
    const ext = (name as string)?.toLowerCase() || "";
    return /\.(las|laz|ply|e57|pcd|rwi|rwp)$/.test(ext) || kind === "pointcloud";
  }, [name, kind]);

  const isMesh = useMemo(() => {
    const ext = (name as string)?.toLowerCase() || "";
    // Note: OBJ files are not supported by model-viewer, only glTF/GLB
    // OBJ would need conversion or a different viewer (e.g., three.js with OBJLoader)
    return /\.(glb|gltf)$/.test(ext) || kind === "mesh";
  }, [name, kind]);

  // Check if this is an unsupported 3D format
  const isUnsupported3D = useMemo(() => {
    const ext = (name as string)?.toLowerCase() || "";
    return /\.(obj|fbx|dae|3ds|stl)$/.test(ext);
  }, [name]);

  const isAudio = useMemo(() => {
    const ext = (name as string)?.toLowerCase() || "";
    return /\.(mp3|wav|webm|m4a|aac|ogg)$/.test(ext) || kind === "audio";
  }, [name, kind]);

  const header = useMemo(() => {
    const ext = (name as string)?.toLowerCase() || "";
    if (ext.endsWith(".txt")) {
      if (editing && isNoteFile) return editableTitle || "Text File";
      return originalTitle || (name as string) || "Text File";
    }
    if (ext.endsWith(".md")) return (name as string) || "Markdown File";
    if (ext.endsWith(".pdf") || kind === "pdf")
      return (name as string) || "PDF File";
    if (ext.match(/\.(mp4|webm|ogg|mov)$/) || kind === "video")
      return (name as string) || "Video";
    if (ext.match(/\.(glb|gltf)$/) || kind === "mesh")
      return (name as string) || "3D Model";
    if (ext.match(/\.(las|laz|ply|e57|pcd|rwi|rwp)$/) || kind === "pointcloud")
      return (name as string) || "Point Cloud";
    if (ext.match(/\.(mp3|wav|webm|m4a|aac|ogg)$/) || kind === "audio")
      return (name as string) || "Audio";
    return (name as string) || (kind === "csv" ? "CSV" : "Spreadsheet");
  }, [name, kind, editing, isNoteFile, editableTitle, originalTitle]);

  // Only enable custom zoom for preview types that don't have their own zoom (disable for mesh/pdf/video)
  const canZoomWeb = useMemo(() => {
    return Platform.OS === "web" && !(isPdf || isVideo || isMesh);
  }, [isPdf, isVideo, isMesh]);

  // Web-only: keyboard shortcuts for zoom (i = in, o = out)
  useEffect(() => {
    if (!canZoomWeb) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "i" || e.key === "I") {
        setZoom((z) => Math.min(4, +(z + 0.1).toFixed(2)));
      } else if (e.key === "o" || e.key === "O") {
        setZoom((z) => Math.max(0.25, +(z - 0.1).toFixed(2)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canZoomWeb]);

  // Web-only: mouse wheel to zoom when hovering the preview area
  useEffect(() => {
    if (!canZoomWeb) return;
    const onWheel = (e: WheelEvent) => {
      const host = wrapperRef.current as HTMLElement | null;
      if (!host) return;
      if (!host.contains(e.target as Node)) return;
      // Only zoom when CTRL/CMD is not pressed (avoid browser-level zoom)
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      const step = (e.deltaY || 0) > 0 ? -0.1 : 0.1;
      setZoom((z) => {
        let nz = +(z + step).toFixed(2);
        if (nz < 0.25) nz = 0.25;
        if (nz > 4) nz = 4;
        return nz;
      });
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel as any);
  }, [canZoomWeb]);

  const handleNotePress = (noteId: string) => {
    // Navigate to note detail - projectId should be passed through navigation params if available
    const params: any = { noteId };
    // Try to get projectId from previous route or pass it through params
    router.push({ pathname: "/note-detail", params });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen
        options={{
          title: header,
          headerStyle: { backgroundColor: "#111111" },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: { color: "#F5F5F5" },
        }}
      />
      <View style={styles.outerContainer}>
        <View style={styles.contentContainer}>
          {loading && (
            <View style={styles.center}>
              <ActivityIndicator color="#FF2A2A" />
              <Text style={styles.loadingText}>Loading…</Text>
            </View>
          )}
          {!loading && error && (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {!loading && !error && (
            // Viewport: scrollable on web so scaled content can be panned
            <View
              ref={wrapperRef}
              nativeID={Platform.OS === "web" ? "preview-viewport" : undefined}
              style={
                Platform.OS === "web" ? styles.zoomViewportWeb : styles.zoomWrapper
              }
            >
              {/* Apply transform scale only when allowed; otherwise render normally to let inner viewers (e.g., model-viewer) handle zoom */}
              <View
                nativeID={Platform.OS === "web" ? "preview-content" : undefined}
                style={
                  Platform.OS === "web"
                    ? canZoomWeb
                      ? [
                          styles.zoomContentWeb,
                          {
                            transform: [{ scale: zoom }] as any,
                            transformOrigin: "0 0" as any,
                          },
                        ]
                      : styles.zoomWrapper
                    : styles.zoomWrapper
                }
              >
                {isAudio ? (
                  <AudioPanel audioUrl={audioUrl || ""} />
                ) : isPdf ? (
                  <PdfPanel src={pdfUrl} />
                ) : isVideo ? (
                  <VideoPanel src={videoUrl} />
                ) : isMesh ? (
                  <MeshPanel src={meshUrl} name={name as string} />
                ) : isPoint ? (
                  <PointCloudPanel src={pointUrl} name={name as string} />
                ) : isUnsupported3D ? (
                  <View style={styles.unsupportedContainer}>
                    <Text style={styles.unsupportedIcon}>📦</Text>
                    <Text style={styles.unsupportedTitle}>
                      Unsupported 3D Format
                    </Text>
                    <Text style={styles.unsupportedText}>
                      {(name as string)?.split(".").pop()?.toUpperCase() || "This"}{" "}
                      files cannot be previewed in the browser.
                    </Text>
                    <Text style={styles.unsupportedHint}>
                      Only GLB and GLTF formats are currently supported for 3D
                      preview. You can download this file to view it in a 3D
                      application.
                    </Text>
                  </View>
                ) : table ? (
                  (() => {
                    const ext = (name as string)?.toLowerCase() || "";
                    const isCsv = ext.endsWith(".csv") || kind === "csv";
                    const Panel = isCsv ? CsvPanel : ExcelPanel;
                    return (
                      <Panel
                        table={table}
                        setTable={(updater: any) =>
                          setTable((prev) => updater(prev || ([] as any)) as any)
                        }
                        editing={editing}
                        onDirty={() => setDirty(true)}
                      />
                    );
                  })()
                ) : (
                  <TextFilePanel
                    editing={editing}
                    isNoteFile={isNoteFile}
                    editableTitle={editableTitle}
                    setEditableTitle={(t) => {
                      setEditableTitle(t);
                      setDirty(true);
                    }}
                    textContent={textContent || ""}
                    setTextContent={(t) => {
                      setTextContent(t);
                      setDirty(true);
                    }}
                    filename={(name as string) || ""}
                    onDirty={() => setDirty(true)}
                  />
                )}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Actions: Edit/Save hidden for PDFs, Videos, Point Clouds, Mesh */}
      <View style={styles.actions}>
        {!(isPdf || isVideo || isPoint || isMesh || isAudio) && (
          <>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setEditing((prev) => !prev)}
              disabled={!table && !textContent}
            >
              <Text style={styles.actionButtonText}>
                {editing ? "Stop Editing" : "Edit"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                saving && { opacity: 0.6 },
                !dirty && { opacity: 0.6 },
              ]}
              onPress={handleSave}
              disabled={(!table && !textContent) || saving || !dirty}
            >
              <Text style={styles.actionButtonText}>
                {saving ? "Saving…" : "Save"}
              </Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={styles.actionButton} onPress={handleDownload}>
          <Text style={styles.actionButtonText}>Download</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.closeButton]}
          onPress={() => router.back()}
        >
          <Text style={[styles.actionButtonText, { color: "#9A9A9A" }]}>Close</Text>
        </TouchableOpacity>
      </View>

      {/* Autosave indicator */}
      {editing && saveStatus !== "idle" && (
        <View style={styles.autosaveIndicator}>
          <Text style={styles.autosaveText}>
            {saveStatus === "saving"
              ? "Saving draft…"
              : saveStatus === "saved"
                ? "Draft saved"
                : saveStatus === "error"
                  ? "Draft save failed"
                  : ""}
          </Text>
        </View>
      )}

      {/* Draft Recovery Modal */}
      <Modal
        visible={showDraftRecoveryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDraftRecoveryModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Recover Unsaved Changes?</Text>
            <Text style={styles.modalText}>
              We found unsaved changes from a previous session. Would you like to
              restore them?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  // Discard draft
                  clearDraft();
                  setShowDraftRecoveryModal(false);
                  setPendingDraftData(null);
                }}
              >
                <Text style={styles.modalButtonText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => {
                  // Restore draft
                  if (pendingDraftData) {
                    if (pendingDraftData.textContent !== undefined) {
                      setTextContent(pendingDraftData.textContent || null);
                    }
                    if (pendingDraftData.table) {
                      setTable(pendingDraftData.table);
                    }
                    setDirty(true);
                    setEditing(true);
                  }
                  setShowDraftRecoveryModal(false);
                  setPendingDraftData(null);
                }}
              >
                <Text style={styles.modalButtonText}>Restore</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111111" },
  content: { flex: 1, padding: 12 },
  contentScroll: { flex: 1, minHeight: 0 },
  outerHScroll: { flex: 1 },
  outerContainer: { flex: 1 },
  contentContainer: { flex: 1, padding: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#9A9A9A" },
  errorText: { color: "#FF4444", fontSize: 16 },
  // table/text styles moved into components
  actions: { flexDirection: "row", gap: 12, padding: 16 },
  actionButton: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  closeButton: { backgroundColor: "#1A1A1A" },
  actionButtonText: { color: "#F5F5F5", fontWeight: "600" },
  headerCell: {
    backgroundColor: "#151515",
    borderRightWidth: 1,
    borderRightColor: "#2A2A2A",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  headerText: { color: "#9A9A9A", fontSize: 10, fontWeight: "600" },
  markdownWrapper: {},
  zoomWrapper: { flex: 1 },
  // Scrollable viewport on web to avoid tearing and allow panning when zoomed
  zoomViewportWeb: { flex: 1, overflow: "scroll" as any },
  // Inner content gets scaled
  zoomContentWeb: {
    minWidth: "100%",
    minHeight: "100%",
    maxWidth: "500%",
    maxHeight: "500%",
  },
  // Autosave indicator
  autosaveIndicator: {
    position: "absolute",
    top: 60,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  autosaveText: { color: "#9A9A9A", fontSize: 12 },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#1E1E1A",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333",
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: { color: "#F5F5F5", fontWeight: "700", fontSize: 18, marginBottom: 8 },
  modalText: { color: "#9A9A9A", marginBottom: 16, lineHeight: 22 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  modalButton: {
    backgroundColor: "#2A2A2A",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  modalButtonPrimary: { backgroundColor: "#2A2A2A", borderColor: "#FF2A2A" },
  modalButtonText: { color: "#F5F5F5", fontWeight: "600" },
  // Unsupported 3D format display
  unsupportedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  unsupportedIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  unsupportedTitle: {
    color: "#F5F5F5",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  unsupportedText: {
    color: "#9A9A9A",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 8,
  },
  unsupportedHint: {
    color: "#6A6A6A",
    fontSize: 14,
    textAlign: "center",
    maxWidth: 300,
    lineHeight: 20,
  },
});

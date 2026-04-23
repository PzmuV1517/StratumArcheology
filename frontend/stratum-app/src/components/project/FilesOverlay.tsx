/**
 * @file
 * Project files overlay component.
 *
 * Full-screen overlay for browsing and managing project
 * files and folders.
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
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Platform,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";

import { fileService } from "../../services/fileService";
import { showAlert } from "../../utils/alert";
import { offlineFilesStorage } from "../../services/offlineService";
import { useWebSocket } from "../../contexts/WebSocketContext";
import FileUploadMenu, { SelectedFile } from "../files/FileUploadMenu";
import MyFolderSettingsModal from "./MyFolderSettingsModal";

interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder" | "note";
  mime_type?: string;
  is_locked?: boolean;
  note_id?: string;
  updated_at?: string; // For offline sync
  size?: number;
}

interface Props {
  visible: boolean;
  title?: string;
  currentFolder: { id: string | null; name: string } | null;
  fileNodes: FileNode[];
  fileLoading: boolean;
  breadcrumbs?: { id: string | null; name: string }[];
  onNavigateBreadcrumb?: (index: number) => void;
  onClose: () => void;
  onLoadRoot: () => void;
  onOpenFolder: (
    node: FileNode,
    customBreadcrumbs?: { id: string | null; name: string }[],
  ) => void;
  onUpload: () => void;
  onFileSelected?: (file: SelectedFile) => void; // New: callback for file selection from menu
  onCreateFolder: () => void;
  onDownload: (node: FileNode) => void;
  onRename: (node: FileNode) => void;
  onMove: (node: FileNode) => void;
  onDelete: (node: FileNode) => void;
  onOpenFile: (node: FileNode) => void;
  projectId?: string; // Needed for direct uploads on drop
  onRefreshAfterUpload?: () => void; // Callback to refresh listing after drop upload
  onDropFiles?: (files: File[]) => Promise<void> | void; // Custom drop handler override
  onBulkMove?: (nodes: FileNode[]) => Promise<void> | void; // Optional parent-handled bulk move
  onBulkDelete?: (nodes: FileNode[]) => Promise<void> | void; // Optional parent-handled bulk delete
  onBulkDownload?: (nodes: FileNode[]) => Promise<void> | void; // Optional parent-handled bulk download
  canEdit?: boolean; // Permissions: disable editing for guests
  autoOpenMyFolder?: boolean; // When true, automatically navigate to My Folder on open
  projectMembers?: {
    id: string;
    display_name: string;
    email: string;
    role: string;
  }[]; // For My Folder settings
  currentUserId?: string; // For My Folder settings
}

export default function FilesOverlay({
  visible,
  title = "Files",
  currentFolder,
  fileNodes,
  fileLoading,
  breadcrumbs,
  onNavigateBreadcrumb,
  onClose,
  onLoadRoot,
  onOpenFolder,
  onUpload,
  onFileSelected,
  onCreateFolder,
  onDownload,
  onRename,
  onMove,
  onDelete,
  onOpenFile,
  projectId,
  onRefreshAfterUpload,
  onDropFiles,
  onBulkMove,
  onBulkDelete,
  onBulkDownload,
  canEdit = true,
  autoOpenMyFolder = false,
  projectMembers = [],
  currentUserId,
}: Props) {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const accentColor = "#FF2A2A";
  const textSecondary = isDarkMode ? "#9A9A9A" : "#666666";
  const textTertiary = isDarkMode ? "#666666" : "#7A7A7A";
  const overlayBackground = isDarkMode ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.24)";
  const dragCardBackground = isDarkMode ? "#1A1A1A" : "#FFFFFF";

  // Get safe area insets for proper header spacing on iOS
  const insets = useSafeAreaInsets();
  const { socket } = useWebSocket();
  const [isDragging, setIsDragging] = useState(false);
  const [_dragDepth, setDragDepth] = useState(0);
  const lastDragEvent = useRef<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMyFolderSettings, setShowMyFolderSettings] = useState(false);
  const [multiSelect, setMultiSelect] = useState(false);
  const [showInfoTip, setShowInfoTip] = useState(false);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [offlineFileIds, setOfflineFileIds] = useState<Set<string>>(new Set());
  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [exactOnly, setExactOnly] = useState(false);
  const [extensionFilters, setExtensionFilters] = useState<string[]>([]);
  const [showExtensionFilter, setShowExtensionFilter] = useState(false);
  const [customExtInput, setCustomExtInput] = useState("");
  // Upload menu state (mobile only)
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [isLoadingMyFolder, setIsLoadingMyFolder] = useState(false);
  const [myFolderId, setMyFolderId] = useState<string | null>(null); // Track user's folder ID
  const rootRef = useRef<any>(null);
  const warnedMissingProject = useRef(false);

  // Check if we're already inside the user's personal folder (or a subfolder of it)
  // This works both when using the My Folder button and when navigating manually
  const isInMyFolder = useMemo(() => {
    // Method 1: We've previously navigated via My Folder button and have the ID
    if (myFolderId) {
      if (currentFolder?.id === myFolderId) return true;
      if (breadcrumbs?.some((b) => b.id === myFolderId)) return true;
    }

    // Method 2: Check if we're in a folder named after the current user ID
    // (for when navigating manually through /users/[userId])
    if (currentUserId) {
      // Check if current folder name is the user's ID
      if (currentFolder?.name === currentUserId) {
        // Also store the folder ID for future reference
        if (currentFolder?.id && !myFolderId) {
          setMyFolderId(currentFolder.id);
        }
        return true;
      }
      // Check if any breadcrumb has a folder named after the user ID
      const userFolderBreadcrumb = breadcrumbs?.find(
        (b) => b.name === currentUserId,
      );
      if (userFolderBreadcrumb) {
        // Store the folder ID for future reference
        if (userFolderBreadcrumb.id && !myFolderId) {
          setMyFolderId(userFolderBreadcrumb.id);
        }
        return true;
      }
    }

    return false;
  }, [
    myFolderId,
    currentFolder?.id,
    currentFolder?.name,
    breadcrumbs,
    currentUserId,
  ]);

  // Check if we're inside the /users folder (where personal folders are stored)
  const isInsideUsersFolder = useMemo(() => {
    // We're in the users folder if the current folder is named "users" (root level)
    // or if "users" appears in the breadcrumbs (but not as the current folder itself)
    if (currentFolder?.name?.toLowerCase() === "users") return true;
    return breadcrumbs?.some((b) => b.name?.toLowerCase() === "users") ?? false;
  }, [currentFolder?.name, breadcrumbs]);

  // Helper to get username from user ID
  const getUsernameForId = useCallback(
    (userId: string): string | null => {
      const member = projectMembers.find((m) => m.id === userId);
      return member?.display_name || null;
    },
    [projectMembers],
  );

  // Get display name for a node (handles user ID -> username transformation for /users subfolders)
  const getDisplayName = useCallback(
    (node: FileNode): string => {
      // If we're inside the /users folder and this is a folder, check if the name is a user ID
      if (isInsideUsersFolder && node.type === "folder") {
        // Check if this folder name looks like a user ID (UUID format or Firebase ID)
        const isLikelyUserId =
          /^[a-f0-9-]{36}$/i.test(node.name) || // UUID
          /^[a-zA-Z0-9]{20,}$/.test(node.name); // Firebase UID

        if (isLikelyUserId) {
          // If this is the current user's folder, show "My Folder"
          if (currentUserId && node.name === currentUserId) {
            return "My Folder";
          }
          // Otherwise show other user's display name
          const username = getUsernameForId(node.name);
          if (username) return username;
        }
      }
      return node.name;
    },
    [isInsideUsersFolder, getUsernameForId, currentUserId],
  );

  // Get display name for a breadcrumb (handles user ID -> username transformation)
  const getBreadcrumbDisplayName = useCallback(
    (crumbName: string, crumbIndex: number): string => {
      // Check if any earlier breadcrumb is "users" - meaning this crumb is inside /users
      const hasUsersInPath = breadcrumbs?.some(
        (b, i) => i < crumbIndex && b.name?.toLowerCase() === "users",
      );

      if (hasUsersInPath) {
        const isLikelyUserId =
          /^[a-f0-9-]{36}$/i.test(crumbName) || // UUID
          /^[a-zA-Z0-9]{20,}$/.test(crumbName); // Firebase UID

        if (isLikelyUserId) {
          // If this is the current user's folder, show "My Folder"
          if (currentUserId && crumbName === currentUserId) {
            return "My Folder";
          }
          // Otherwise show other user's display name
          const username = getUsernameForId(crumbName);
          if (username) return username;
        }
      }
      return crumbName;
    },
    [breadcrumbs, getUsernameForId, currentUserId],
  );

  // Navigate to user's personal folder (creates if doesn't exist)
  const handleGoToMyFolder = useCallback(async () => {
    if (!projectId) {
      showAlert("Error", "Project context missing");
      return;
    }

    // If we're already in our folder, don't navigate again
    if (isInMyFolder) {
      return;
    }

    setIsLoadingMyFolder(true);
    try {
      // First try to get existing folder
      let myFolder = await fileService.getMyFolder(projectId);

      // If it doesn't exist, create it
      if (!myFolder) {
        try {
          myFolder = await fileService.createMyFolder(projectId);
        } catch (createError: any) {
          // If creation fails with 400 (already exists), try fetching again
          // This can happen if there's a race condition or the folder name format changed
          if (createError.response?.status === 400) {
            console.log("My Folder already exists, trying to fetch again...");
            myFolder = await fileService.getMyFolder(projectId);
            if (!myFolder) {
              // Still can't find it - there might be a naming mismatch
              showAlert(
                "Error",
                "Your personal folder exists but could not be found. Please check the file list.",
              );
              return;
            }
          } else {
            console.error("Failed to create My Folder:", createError);
            showAlert(
              "Error",
              createError.response?.data?.detail ||
                createError.message ||
                "Failed to create your personal folder",
            );
            return;
          }
        }
      }

      if (myFolder) {
        // Store the folder ID so we can detect if we're already there
        setMyFolderId(myFolder.id);

        // Build correct breadcrumb path: Root > users > {user's folder}
        // The myFolder.parent_id is the "users" folder
        const usersFolderId = myFolder.parent_id;
        const customBreadcrumbs: { id: string | null; name: string }[] = [
          { id: null, name: "Root" },
          { id: usersFolderId, name: "users" },
          { id: myFolder.id, name: myFolder.name },
        ];

        // Navigate to the folder with correct breadcrumb path
        onOpenFolder(
          {
            id: myFolder.id,
            name: myFolder.name,
            type: "folder",
          },
          customBreadcrumbs,
        );
      }
    } catch (error: any) {
      console.error("Failed to access My Folder:", error);
      showAlert(
        "Error",
        error.response?.data?.detail ||
          error.message ||
          "Failed to access your personal folder",
      );
    } finally {
      setIsLoadingMyFolder(false);
    }
  }, [projectId, onOpenFolder, isInMyFolder]);

  // Handle saving My Folder privacy settings
  const handleSaveMyFolderSettings = useCallback(
    async (settings: {
      default_can_view: boolean;
      default_can_edit: boolean;
      member_permissions: {
        user_id: string;
        can_view: boolean;
        can_edit: boolean;
      }[];
    }) => {
      if (!projectId) return;
      try {
        await fileService.updateMyFolderPermissions(projectId, settings);
        showAlert("Success", "Privacy settings updated");
      } catch (error: any) {
        console.error("Failed to update My Folder settings:", error);
        throw error; // Let the modal handle the error display
      }
    },
    [projectId],
  );

  // Handle file selected from upload menu (supports both single file and array)
  const handleFileSelected = useCallback(
    async (filesInput: SelectedFile | SelectedFile[]) => {
      setShowUploadMenu(false);

      // Normalize to array
      const files = Array.isArray(filesInput) ? filesInput : [filesInput];
      if (files.length === 0) return;

      // If parent provides handler, use it (pass first file for backward compat)
      if (onFileSelected) {
        onFileSelected(files[0]);
        return;
      }

      // Otherwise, directly upload using fileService
      if (!projectId) {
        showAlert("Error", "Cannot upload - project context missing");
        return;
      }

      setIsUploading(true);
      setUploadCount(files.length);

      try {
        for (const file of files) {
          // Use the file's actual name - DocumentPicker provides it correctly
          // Decode URL-encoded characters (e.g., %20 -> space)
          let fileName = file.name;
          if (fileName) {
            try {
              fileName = decodeURIComponent(fileName);
            } catch {
              // Already decoded or invalid encoding, use as-is
            }
          }

          // Only generate a name if truly missing (camera photos without name)
          if (!fileName || fileName === "undefined") {
            // For images, try to get extension from mime type
            if (file.mimeType?.startsWith("image/")) {
              const ext = file.mimeType.split("/")[1] || "jpg";
              const cleanExt = ext === "jpeg" ? "jpg" : ext;
              fileName = `photo_${Date.now()}.${cleanExt}`;
            } else {
              // For other files, try to get from URI or use generic name
              const uriParts = file.uri.split("/");
              let lastPart = uriParts[uriParts.length - 1];
              try {
                lastPart = decodeURIComponent(lastPart);
              } catch {
                // Already decoded
              }
              if (lastPart && lastPart.includes(".")) {
                fileName = lastPart;
              } else {
                const ext = file.mimeType?.split("/")[1] || "file";
                fileName = `file_${Date.now()}.${ext}`;
              }
            }
          }

          console.log("[FilesOverlay] Uploading file:", {
            originalName: file.name,
            finalName: fileName,
            mimeType: file.mimeType,
            uri: file.uri,
          });

          await fileService.uploadFile(
            projectId,
            file.uri,
            fileName,
            file.mimeType,
            currentFolder?.id || null,
          );
        }

        const msg =
          files.length === 1
            ? `${files[0].name || "File"} uploaded successfully`
            : `${files.length} files uploaded successfully`;
        showAlert("Success", msg);
        onRefreshAfterUpload?.();
      } catch (error: any) {
        console.error("File upload failed:", error);
        showAlert("Upload Failed", error.message || "Failed to upload file");
      } finally {
        setIsUploading(false);
        setUploadCount(0);
      }
    },
    [projectId, currentFolder, onFileSelected, onRefreshAfterUpload],
  );

  // Load offline file status on mount
  useEffect(() => {
    if (projectId) {
      offlineFilesStorage.getOfflineFiles(projectId).then((files) => {
        setOfflineFileIds(new Set(files.map((f) => f.node_id)));
      });
    }
  }, [projectId, fileNodes]);

  // Prune any locked selections if file list changes
  useEffect(() => {
    const allowed = new Set(fileNodes.filter((n) => !n.is_locked).map((n) => n.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (allowed.has(id)) next.add(id);
      });
      return next;
    });
  }, [fileNodes]);

  // Auto-navigate to My Folder if requested
  useEffect(() => {
    if (visible && autoOpenMyFolder && !isInMyFolder && !isLoadingMyFolder) {
      handleGoToMyFolder();
    }
    // Only run when overlay becomes visible or autoOpenMyFolder changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, autoOpenMyFolder]);

  // Listen for WebSocket file updates to silently refresh the file list
  useEffect(() => {
    if (!socket || !projectId || !visible) return;

    const handleFilesUpdated = (data: any) => {
      if (data.project_id === projectId) {
        // Silently refresh the file list
        console.log("[FilesOverlay] Received files_updated, refreshing...");
        if (onRefreshAfterUpload) {
          onRefreshAfterUpload();
        }
      }
    };

    const handleContentUpdated = (data: any) => {
      if (data.project_id === projectId && data.content_type === "files") {
        handleFilesUpdated(data);
      }
    };

    socket.on("files_updated", handleFilesUpdated);
    socket.on("content_updated", handleContentUpdated);

    return () => {
      socket.off("files_updated", handleFilesUpdated);
      socket.off("content_updated", handleContentUpdated);
    };
  }, [socket, projectId, visible, onRefreshAfterUpload]);

  const handleFilesUpload = useCallback(
    async (dropped: File[]) => {
      if (onDropFiles) {
        await onDropFiles(dropped);
        return;
      }
      if (!projectId) {
        if (!warnedMissingProject.current) {
          console.warn(
            "FilesOverlay: missing projectId prop, cannot auto-upload dropped files",
          );
          showAlert("Cannot upload", "Project context missing.");
          warnedMissingProject.current = true;
        }
        return;
      }
      setIsUploading(true);
      setUploadCount(dropped.length);
      const tasks = dropped.map((f) => {
        const fd = new FormData();
        fd.append("file", f);
        if (currentFolder?.id) fd.append("parent_id", currentFolder.id);
        return fileService.uploadFormData(projectId, fd).catch((err: any) => {
          console.error("Upload failed for", f.name, err);
          showAlert("Upload failed", f.name);
        });
      });
      await Promise.all(tasks);
      setIsUploading(false);
      setUploadCount(0);
      if (onRefreshAfterUpload) onRefreshAfterUpload();
    },
    [projectId, currentFolder, onRefreshAfterUpload, onDropFiles],
  );

  // Robust drag-and-drop handling (depth + timeout + ESC) - only for users with edit permission
  useEffect(() => {
    if (Platform.OS !== "web") return;
    // Don't set up drag-drop handlers if user can't edit
    if (!canEdit) return;

    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      if ([...e.dataTransfer.types].includes("Files")) {
        setDragDepth((d) => d + 1);
        setIsDragging(true);
        lastDragEvent.current = Date.now();
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      if ([...e.dataTransfer.types].includes("Files")) {
        e.preventDefault();
        lastDragEvent.current = Date.now();
      }
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      if ([...e.dataTransfer.types].includes("Files")) {
        setDragDepth((d) => {
          const next = Math.max(0, d - 1);
          if (next === 0) setIsDragging(false);
          return next;
        });
      }
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer) {
        resetDragState();
        return;
      }
      if ([...e.dataTransfer.types].includes("Files")) {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length) void handleFilesUpload(files);
      }
      resetDragState();
    };
    const onDragEnd = () => {
      resetDragState();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") resetDragState();
    };
    const resetDragState = () => {
      setDragDepth(0);
      setIsDragging(false);
    };
    const inactivityInterval = window.setInterval(() => {
      if (isDragging && Date.now() - lastDragEvent.current > 1200) {
        // No dragover recently -> reset
        resetDragState();
      }
    }, 1500);

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("keydown", onKeyDown);
      window.clearInterval(inactivityInterval);
    };
  }, [handleFilesUpload, isDragging, canEdit]);

  const getExtension = (name: string) => {
    const idx = name.lastIndexOf(".");
    return idx === -1 ? "" : name.substring(idx + 1).toLowerCase();
  };
  const getBaseName = (name: string) => {
    const idx = name.lastIndexOf(".");
    return idx === -1 ? name : name.substring(0, idx);
  };

  // Collect existing extensions for suggestions (files only)
  const availableExtensions = useMemo(() => {
    const exts = new Set<string>();
    fileNodes.forEach((n) => {
      if (n.type === "file") {
        const ext = getExtension(n.name);
        if (ext) exts.add(ext);
      }
    });
    return Array.from(exts).sort();
  }, [fileNodes]);

  // Ranking & filtering
  const filteredNodes = useMemo(() => {
    let nodes = fileNodes;
    if (extensionFilters.length > 0) {
      nodes = nodes.filter((n) => {
        if (n.type !== "file") return false;
        const ext = getExtension(n.name);
        return extensionFilters.includes(ext);
      });
    }
    const qRaw = searchQuery.trim();
    if (!qRaw) return nodes;
    const q = qRaw.toLowerCase();
    return nodes
      .map((n) => {
        const baseLower = getBaseName(n.name).toLowerCase();
        let rank = 999;
        if (exactOnly) {
          rank = baseLower === q ? 0 : 999;
        } else {
          if (baseLower === q) rank = 0;
          else if (baseLower.startsWith(q)) rank = 1;
          else if (baseLower.includes(q)) rank = 2;
        }
        return { node: n, rank, baseLower };
      })
      .filter((r) => r.rank !== 999)
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.node.name.localeCompare(b.node.name);
      })
      .map((r) => r.node);
  }, [fileNodes, extensionFilters, searchQuery, exactOnly]);

  // Compute selectable (non-locked) ids for select-all behavior respecting filtered list
  const selectableIds = filteredNodes.filter((n) => !n.is_locked).map((n) => n.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const hasActiveFilters =
    searchQuery.trim().length > 0 || extensionFilters.length > 0 || exactOnly;

  // Early return AFTER all hooks (React requires hooks to be called unconditionally)
  if (!visible) return null;

  return (
    <View ref={rootRef} style={styles.root}>
      {/* Notes-style header */}
      <View style={[styles.modalHeader, { paddingTop: Math.max(12, insets.top) }]}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.modalBackButton}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Close files overlay"
        >
          <IconSymbol name="chevron.backward" size={20} color={accentColor} />
          <Text style={styles.modalBackText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.modalHeaderTitle}>{title}</Text>
        <View style={styles.modalHeaderSpacer} />
      </View>
      {/* Bulk actions bar - separate row when selections exist */}
      {multiSelect && selectedIds.size > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bulkBarScroll}
          style={styles.bulkBarContainer}
        >
          <Text style={styles.bulkText}>{selectedIds.size} selected</Text>
          <TouchableOpacity
            onPress={async () => {
              const nodes = fileNodes.filter((n) => selectedIds.has(n.id));
              if (onBulkMove) return void onBulkMove(nodes);
              showAlert(
                "Bulk move",
                "Parent needs to implement bulk move destination chooser.",
              );
            }}
            style={styles.bulkBtn}
            accessibilityRole="button"
            accessibilityLabel="Move selected files"
          >
            <Text style={styles.bulkBtnText}>Move</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              const nodes = fileNodes.filter((n) => selectedIds.has(n.id));
              if (onBulkDelete) return void onBulkDelete(nodes);
              // default: confirm once, then delete sequentially
              showAlert("Delete selected", `Delete ${nodes.length} item(s)?`, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    for (const n of nodes) {
                      await onDelete(n);
                    }
                    setSelectedIds(new Set());
                  },
                },
              ]);
            }}
            style={styles.bulkBtnDanger}
            accessibilityRole="button"
            accessibilityLabel="Delete selected files"
          >
            <Text style={styles.bulkBtnText}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              const nodes = fileNodes.filter(
                (n) => selectedIds.has(n.id) && n.type === "file",
              );
              if (onBulkDownload) return void onBulkDownload(nodes);
              for (const n of nodes) {
                await onDownload(n);
              }
            }}
            style={styles.bulkBtn}
            accessibilityRole="button"
            accessibilityLabel="Download selected files"
          >
            <Text style={styles.bulkBtnText}>Download</Text>
          </TouchableOpacity>
          {/* Save for Offline button - only on native */}
          {Platform.OS !== "web" && projectId && (
            <TouchableOpacity
              onPress={async () => {
                const nodes = fileNodes.filter(
                  (n) => selectedIds.has(n.id) && n.type === "file",
                );
                if (nodes.length === 0) {
                  showAlert(
                    "No files selected",
                    "Please select files to save for offline access.",
                  );
                  return;
                }
                showAlert(
                  "Save for Offline",
                  `This will save ${nodes.length} file(s) for offline access. You can view them without an internet connection.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Save",
                      onPress: async () => {
                        setIsSavingOffline(true);
                        try {
                          const filesToSave = await Promise.all(
                            nodes.map(async (n) => {
                              const url = await fileService.getDownloadUrl(n.id);
                              return {
                                id: n.id,
                                name: n.name,
                                mime_type: n.mime_type,
                                size: n.size,
                                downloadUrl: url,
                                updated_at: n.updated_at, // For sync tracking
                              };
                            }),
                          );

                          const result =
                            await offlineFilesStorage.saveFilesForOffline(
                              projectId,
                              filesToSave,
                              (current, total, fileName) => {
                                console.log(
                                  `[Offline] Saving ${current}/${total}: ${fileName}`,
                                );
                              },
                            );

                          // Update offline file IDs
                          setOfflineFileIds((prev) => {
                            const next = new Set(prev);
                            nodes.forEach((n) => next.add(n.id));
                            return next;
                          });

                          if (result.failed > 0) {
                            showAlert(
                              "Partially Saved",
                              `${result.success} file(s) saved, ${result.failed} failed.\n${result.errors.slice(0, 3).join("\n")}`,
                            );
                          } else {
                            showAlert(
                              "Saved for Offline",
                              `${result.success} file(s) are now available offline.`,
                            );
                          }
                          setSelectedIds(new Set());
                          setMultiSelect(false);
                        } catch (error: any) {
                          showAlert(
                            "Error",
                            error.message || "Failed to save files for offline.",
                          );
                        } finally {
                          setIsSavingOffline(false);
                        }
                      },
                    },
                  ],
                );
              }}
              style={[styles.bulkBtn, isSavingOffline && { opacity: 0.5 }]}
              disabled={isSavingOffline}
              accessibilityRole="button"
              accessibilityLabel="Save selected files for offline use"
              accessibilityState={{ disabled: isSavingOffline }}
            >
              <Text style={styles.bulkBtnText}>
                {isSavingOffline ? "Saving..." : "Save Offline"}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setSelectedIds(new Set())}
            style={styles.bulkBtnClear}
            accessibilityRole="button"
            accessibilityLabel="Clear selected files"
          >
            <Text style={styles.bulkBtnText}>Clear</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      {Platform.OS === "web" && isDragging && canEdit && (
        <div
          style={{
            position: "absolute" as any,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: overlayBackground,
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            display: "flex",
          }}
          onDragOver={(e: any) => {
            e.preventDefault();
            lastDragEvent.current = Date.now();
          }}
          onDrop={(e: any) => {
            if (e.nativeEvent?.dataTransfer) {
              const dt = e.nativeEvent.dataTransfer;
              const files = Array.from(dt.files || []) as File[];
              if (files.length) {
                void handleFilesUpload(files);
              }
            }
            setIsDragging(false);
            setDragDepth(0);
          }}
        >
          <div
            style={{
              backgroundColor: dragCardBackground,
              borderRadius: 12,
              border: `2px dashed ${accentColor}`,
              padding: 40,
              textAlign: "center",
            }}
          >
            <Text
              style={{
                color: accentColor,
                fontSize: 20,
                fontWeight: "700",
                marginBottom: 8,
              }}
            >
              Drop file here
            </Text>
            <Text style={{ color: textSecondary, fontSize: 14 }}>
              Release or press ESC to cancel
            </Text>
          </div>
        </div>
      )}
      {Platform.OS === "web" && isUploading && (
        <View pointerEvents="none" style={styles.uploadingBanner}>
          <ActivityIndicator color={accentColor} />
          <Text style={styles.uploadingText}>
            Uploading {uploadCount} file{uploadCount === 1 ? "" : "s"}…
          </Text>
        </View>
      )}
      {/* File Upload Menu Modal (mobile only) */}
      {Platform.OS !== "web" && (
        <FileUploadMenu
          visible={showUploadMenu}
          onClose={() => setShowUploadMenu(false)}
          onFileSelected={handleFileSelected}
        />
      )}
      {/* My Folder Settings Modal */}
      {projectId && currentUserId && (
        <MyFolderSettingsModal
          visible={showMyFolderSettings}
          projectId={projectId}
          members={projectMembers}
          currentUserId={currentUserId}
          onClose={() => setShowMyFolderSettings(false)}
          onSave={handleSaveMyFolderSettings}
        />
      )}
      <ScrollView style={styles.contentScroll}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Files</Text>
          <View style={styles.actionRow}>
            {/* My Folder button with settings gear */}
            <View style={styles.myFolderContainer}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.myFolderButton,
                  (isLoadingMyFolder || isInMyFolder) && { opacity: 0.5 },
                ]}
                onPress={handleGoToMyFolder}
                disabled={isLoadingMyFolder || isInMyFolder}
                accessibilityRole="button"
                accessibilityLabel={
                  isInMyFolder ? "Currently in My Folder" : "Open My Folder"
                }
                accessibilityState={{ disabled: isLoadingMyFolder || isInMyFolder }}
              >
                <View style={styles.myFolderButtonContent}>
                  <IconSymbol name="folder.fill" size={14} color="#FFFFFF" />
                  <Text style={styles.myFolderButtonText}>
                    {isLoadingMyFolder ? "Loading..." : "My Folder"}
                  </Text>
                </View>
              </TouchableOpacity>
              {/* Settings gear - only show when My Folder exists */}
              {(myFolderId || isInMyFolder) && currentUserId && (
                <TouchableOpacity
                  style={styles.myFolderSettingsBtn}
                  onPress={() => setShowMyFolderSettings(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Open My Folder sharing settings"
                >
                  <IconSymbol name="gearshape.fill" size={16} color={accentColor} />
                </TouchableOpacity>
              )}
            </View>
            {canEdit && (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onCreateFolder}
                  accessibilityRole="button"
                  accessibilityLabel="Create folder"
                >
                  <Text style={styles.actionButtonText}>+ Folder</Text>
                </TouchableOpacity>
                {/* On mobile, show dropdown menu; on web, use existing upload handler */}
                {Platform.OS !== "web" ? (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setShowUploadMenu(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Open upload options"
                  >
                    <Text style={styles.actionButtonText}>+ Upload ▾</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={onUpload}
                    accessibilityRole="button"
                    accessibilityLabel="Upload files"
                  >
                    <Text style={styles.actionButtonText}>+ Upload</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            {canEdit && !multiSelect ? (
              <TouchableOpacity
                style={styles.multiToggle}
                onPress={() => {
                  setMultiSelect(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Enable multi-select mode"
              >
                <Text style={styles.multiToggleText}>Select multiple items</Text>
              </TouchableOpacity>
            ) : canEdit && multiSelect ? (
              <TouchableOpacity
                style={styles.multiToggleActive}
                onPress={() => {
                  setMultiSelect(false);
                  setSelectedIds(new Set());
                  setShowInfoTip(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Disable multi-select mode"
              >
                <Text style={styles.multiToggleText}>Done</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        {/* Search & filter row */}
        <View style={styles.searchRow}>
          <TextInput
            value={searchQuery}
            placeholder="Search by name..."
            placeholderTextColor={textTertiary}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            accessibilityLabel="Search files by name"
            returnKeyType="search"
          />
          <TouchableOpacity
            style={styles.filterToggle}
            onPress={() => setShowExtensionFilter((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Toggle extension filters"
            accessibilityState={{ expanded: showExtensionFilter }}
          >
            <Text style={styles.filterToggleText}>
              {showExtensionFilter ? "Hide Extensions" : "Filter by extension"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setExactOnly((e) => !e)}
            style={styles.exactToggle}
            accessibilityRole="button"
            accessibilityLabel="Only exact matches"
            accessibilityState={{ checked: exactOnly }}
          >
            <View style={[styles.exactBox, exactOnly && styles.exactBoxChecked]}>
              {exactOnly && <View style={styles.exactBoxDot} />}
            </View>
            <Text style={styles.exactToggleLabel}>Only exact matches</Text>
          </TouchableOpacity>
        </View>
        {showExtensionFilter && (
          <View style={styles.filterPanel}>
            <View style={styles.extChipRow}>
              {availableExtensions.map((ext) => {
                const active = extensionFilters.includes(ext);
                return (
                  <TouchableOpacity
                    key={ext}
                    onPress={() => {
                      setExtensionFilters((prev) => {
                        const next = active
                          ? prev.filter((e) => e !== ext)
                          : [...prev, ext];
                        return next;
                      });
                    }}
                    style={[styles.extChip, active && styles.extChipActive]}
                  >
                    <Text style={styles.extChipText}>.{ext}</Text>
                  </TouchableOpacity>
                );
              })}
              {extensionFilters.length > 0 && (
                <TouchableOpacity
                  style={styles.clearFilterBtn}
                  onPress={() => setExtensionFilters([])}
                >
                  <Text style={styles.addExtText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.customExtRow}>
              <TextInput
                value={customExtInput}
                onChangeText={setCustomExtInput}
                placeholder="Search custom extension (e.g. csv)"
                placeholderTextColor={textTertiary}
                style={styles.customExtInput}
              />
              <TouchableOpacity
                style={styles.addExtBtn}
                onPress={() => {
                  const ext = customExtInput.trim().replace(/^\./, "").toLowerCase();
                  if (!ext) return;
                  setExtensionFilters((prev) =>
                    prev.includes(ext) ? prev : [...prev, ext],
                  );
                  setCustomExtInput("");
                }}
              >
                <Text style={styles.addExtText}>Search</Text>
              </TouchableOpacity>
            </View>
            {customExtInput.trim().length > 0 && (
              <Text style={styles.extPreviewText}>
                Will filter: .
                {customExtInput.trim().replace(/^\./, "").toLowerCase()}{" "}
                {customExtInput.startsWith(".")
                  ? "(dot normalized)"
                  : "(no dot needed)"}
              </Text>
            )}
          </View>
        )}
        {fileLoading ? (
          <ActivityIndicator color={accentColor} />
        ) : (
          <View>
            <View style={styles.breadcrumbRow}>
              {(breadcrumbs && breadcrumbs.length
                ? breadcrumbs
                : [
                    { id: null, name: "Root" },
                    ...(currentFolder ? [currentFolder] : []),
                  ]
              ).map((crumb, idx, arr) => {
                const displayName =
                  idx === 0 ? "Root" : getBreadcrumbDisplayName(crumb.name, idx);
                return (
                  <View key={`${crumb.id ?? "root"}-${idx}`} style={styles.breadcrumbItem}>
                    {idx < arr.length - 1 ? (
                      <TouchableOpacity
                        onPress={() => {
                          if (idx === 0) onLoadRoot();
                          if (onNavigateBreadcrumb) onNavigateBreadcrumb(idx);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Open folder ${displayName}`}
                      >
                        <Text style={styles.breadcrumbLink}>{displayName}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.breadcrumbCurrent}>{displayName}</Text>
                    )}
                    {idx < arr.length - 1 && (
                      <Text style={styles.breadcrumbSeparator}>/</Text>
                    )}
                  </View>
                );
              })}
            </View>

            {filteredNodes.length > 0 ? (
              <View>
                {multiSelect && (
                  <View style={styles.listHeader}>
                    <TouchableOpacity
                      disabled={selectableIds.length === 0}
                      onPress={() => {
                        if (selectableIds.length === 0) return;
                        if (allSelected) setSelectedIds(new Set());
                        else setSelectedIds(new Set(selectableIds));
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={allSelected ? "Deselect all" : "Select all"}
                      accessibilityState={{ disabled: selectableIds.length === 0 }}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          selectableIds.length === 0 && styles.checkboxDisabled,
                          allSelected && styles.checkboxChecked,
                        ]}
                      >
                        {allSelected && <View style={styles.checkboxDot} />}
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.listHeaderText}>Select All</Text>
                    {fileNodes.some((n) => n.is_locked) && (
                      <View
                        style={styles.infoWrapper}
                        {...(Platform.OS === "web"
                          ? {
                              onMouseEnter: () => setShowInfoTip(true),
                              onMouseLeave: () => setShowInfoTip(false),
                            }
                          : {})}
                      >
                        <View style={styles.infoIcon}>
                          <Text style={styles.infoIconText}>i</Text>
                        </View>
                        {Platform.OS === "web" && showInfoTip && (
                          <View style={styles.infoTooltip}>
                            <Text style={styles.infoTooltipText}>
                              Locked items can’t be selected
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
                {filteredNodes.map((node) => (
                  <View
                    key={node.id}
                    style={[
                      styles.fileRow,
                      selectedIds.has(node.id) && styles.fileRowSelected,
                    ]}
                  >
                    {multiSelect ? (
                      node.is_locked ? (
                        <View style={styles.checkboxSpacer} />
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            const next = new Set(selectedIds);
                            if (next.has(node.id)) next.delete(node.id);
                            else next.add(node.id);
                            setSelectedIds(next);
                          }}
                          accessibilityRole="checkbox"
                          accessibilityLabel={`Select ${getDisplayName(node)}`}
                          accessibilityState={{ checked: selectedIds.has(node.id) }}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              selectedIds.has(node.id) && styles.checkboxChecked,
                            ]}
                          >
                              {selectedIds.has(node.id) && <View style={styles.checkboxDot} />}
                          </View>
                        </TouchableOpacity>
                      )
                    ) : (
                      <View style={styles.checkboxSpacer} />
                    )}
                    <View style={styles.fileIconContainer}>
                      <IconSymbol
                        name={node.type === "folder" ? "folder.fill" : "note.text"}
                        size={16}
                        color={node.type === "folder" ? accentColor : textSecondary}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.fileNamePressable}
                      onPress={() =>
                        node.type === "folder"
                          ? onOpenFolder(node)
                          : onOpenFile(node)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${node.type} ${getDisplayName(node)}`}
                    >
                      {renderNameWithExtension(
                        getDisplayName(node),
                        searchQuery,
                        exactOnly,
                        styles,
                      )}
                    </TouchableOpacity>
                    {node.is_locked && <Text style={styles.lockBadge}>LOCKED</Text>}
                    {offlineFileIds.has(node.id) && (
                      <Text style={styles.offlineBadge}>Downloaded</Text>
                    )}
                    <View style={styles.rowActions}>
                      {node.type === "file" && (
                        <TouchableOpacity
                          onPress={() => onDownload(node)}
                          accessibilityRole="button"
                          accessibilityLabel={`Download ${getDisplayName(node)}`}
                        >
                          <Text style={styles.rowActionText}>Download</Text>
                        </TouchableOpacity>
                      )}
                      {!node.is_locked && canEdit && (
                        <>
                          <TouchableOpacity
                            onPress={() => onRename(node)}
                            accessibilityRole="button"
                            accessibilityLabel={`Rename ${getDisplayName(node)}`}
                          >
                            <Text style={styles.rowActionText}>Rename</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => onMove(node)}
                            accessibilityRole="button"
                            accessibilityLabel={`Move ${getDisplayName(node)}`}
                          >
                            <Text style={styles.rowActionText}>Move</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => onDelete(node)}
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${getDisplayName(node)}`}
                          >
                            <Text style={styles.rowDeleteText}>Delete</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  {fileNodes.length === 0 ? "No files" : "No matching files"}
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  {fileNodes.length === 0
                    ? "Create a folder or upload files"
                    : "Try different keywords or clear filters"}
                </Text>
                {fileNodes.length > 0 && hasActiveFilters && (
                  <TouchableOpacity
                    style={styles.clearFilterPill}
                    onPress={() => {
                      setSearchQuery("");
                      setExtensionFilters([]);
                      setExactOnly(false);
                      setShowExtensionFilter(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Clear all active file filters"
                  >
                    <Text style={styles.clearFilterPillText}>Clear filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Helper to highlight matched substring
function renderNameWithExtension(
  name: string,
  query: string,
  exactOnly: boolean,
  styles: ReturnType<typeof createStyles>,
) {
  const idx = name.lastIndexOf(".");
  const hasExt = idx !== -1;
  const base = hasExt ? name.substring(0, idx) : name;
  const ext = hasExt ? name.substring(idx) : "";
  const highlightedBase = highlightBase(base, query, exactOnly, styles);
  return (
    <Text style={styles.fileName}>
      {highlightedBase}
      {hasExt && <Text style={styles.fileExt}>{ext}</Text>}
    </Text>
  );
}

function highlightBase(
  base: string,
  query: string,
  exactOnly: boolean,
  styles: ReturnType<typeof createStyles>,
) {
  const qRaw = query.trim();
  if (!qRaw) return base;
  const q = qRaw.toLowerCase();
  const lower = base.toLowerCase();
  if (exactOnly && lower !== q) return base;
  const matchIndex = lower.indexOf(q);
  if (matchIndex === -1) return base;
  const before = base.slice(0, matchIndex);
  const match = base.slice(matchIndex, matchIndex + q.length);
  const after = base.slice(matchIndex + q.length);
  return (
    <Text>
      {before}
      <Text style={styles.matchHighlight}>{match}</Text>
      {after}
    </Text>
  );
}

const createStyles = (isDarkMode: boolean) => {
  const palette = {
    pageBackground: isDarkMode ? "#111111" : "#F7F7F7",
    surface: isDarkMode ? "#1A1A1A" : "#FFFFFF",
    surfaceAlt: isDarkMode ? "#141414" : "#F1F1F1",
    surfaceMuted: isDarkMode ? "#222222" : "#EAEAEA",
    border: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    borderStrong: isDarkMode ? "#333333" : "#C9C9C9",
    textPrimary: isDarkMode ? "#F5F5F5" : "#1A1A1A",
    textSecondary: isDarkMode ? "#9A9A9A" : "#666666",
    textMuted: isDarkMode ? "#7A7A7A" : "#7A7A7A",
    overlaySoft: isDarkMode ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.16)",
    accent: "#FF2A2A",
    destructive: "#FF4444",
    textOnAccent: "#FFFFFF",
  };

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.pageBackground, position: "relative" },
    contentScroll: { flex: 1, padding: 24 },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
      flexDirection: "row",
      alignItems: "center",
    },
    headerGlass: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDarkMode
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(0, 0, 0, 0.08)",
      flexDirection: "row",
      alignItems: "center",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      backgroundColor: palette.pageBackground,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.borderStrong,
    },
    modalBackButton: {
      flexDirection: "row",
      alignItems: "center",
      minWidth: 70,
    },
    modalBackText: {
      color: palette.accent,
      fontSize: 17,
      marginLeft: 4,
    },
    modalHeaderTitle: {
      color: palette.textPrimary,
      fontSize: 17,
      fontWeight: "600",
    },
    modalHeaderSpacer: {
      minWidth: 70,
    },
    bulkBarContainer: {
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
      maxHeight: 48,
    },
    bulkBarScroll: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    bulkBar: {
      marginLeft: "auto",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    bulkText: { color: palette.textPrimary, marginRight: 8, fontSize: 12 },
    bulkBtn: {
      backgroundColor: palette.borderStrong,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    bulkBtnDanger: {
      backgroundColor: palette.destructive,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    bulkBtnClear: {
      backgroundColor: palette.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    bulkBtnText: { color: palette.textPrimary, fontSize: 12 },
    sectionHeader: {
      flexDirection: "column",
      justifyContent: "flex-start",
      alignItems: "flex-start",
      marginBottom: 16,
      gap: 12,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: palette.textPrimary,
      letterSpacing: 0.5,
    },
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      alignItems: "center",
    },
    actionButton: {
      backgroundColor: palette.accent,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
    },
    myFolderButton: { backgroundColor: palette.accent },
    myFolderButtonContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    myFolderButtonText: {
      fontSize: 12,
      color: palette.textOnAccent,
      fontWeight: "600",
      letterSpacing: 0.5,
    },
    myFolderContainer: { flexDirection: "row", alignItems: "center", gap: 4 },
    myFolderSettingsBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: palette.surfaceMuted,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      justifyContent: "center",
    },
    actionButtonText: {
      fontSize: 12,
      color: palette.textOnAccent,
      fontWeight: "600",
      letterSpacing: 0.5,
    },
    multiToggle: {
      backgroundColor: palette.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    multiToggleActive: {
      backgroundColor: palette.borderStrong,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    multiToggleText: { color: palette.textPrimary, fontSize: 12, fontWeight: "600" },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      gap: 12,
      flexWrap: "wrap",
    },
    searchInput: {
      flexGrow: 1,
      minWidth: 200,
      backgroundColor: palette.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      color: palette.textPrimary,
      borderWidth: 1,
      borderColor: palette.border,
      fontSize: 14,
    },
    exactToggle: { flexDirection: "row", alignItems: "center", gap: 6 },
    exactBox: {
      width: 18,
      height: 18,
      borderWidth: 1,
      borderColor: isDarkMode ? "#555" : "#A0A0A0",
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    exactBoxChecked: { backgroundColor: palette.accent, borderColor: palette.accent },
    exactBoxDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: palette.textOnAccent,
    },
    filterToggle: {
      backgroundColor: palette.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette.border,
    },
    filterToggleText: { color: palette.textPrimary, fontSize: 12 },
    exactToggleLabel: { color: palette.textSecondary, fontSize: 12 },
    filterPanel: {
      backgroundColor: palette.surfaceAlt,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
      marginBottom: 12,
    },
    extChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    extChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: palette.surfaceMuted,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette.borderStrong,
    },
    extChipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
    extChipText: { color: palette.textPrimary, fontSize: 12 },
    customExtRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    customExtInput: {
      flexGrow: 1,
      minWidth: 120,
      backgroundColor: palette.surface,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      color: palette.textPrimary,
      borderWidth: 1,
      borderColor: palette.border,
      fontSize: 12,
    },
    addExtBtn: {
      backgroundColor: palette.borderStrong,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    clearFilterBtn: {
      backgroundColor: palette.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginLeft: "auto",
    },
    addExtText: { color: palette.textPrimary, fontSize: 12 },
    matchHighlight: {
      backgroundColor: palette.accent,
      color: palette.textOnAccent,
      fontWeight: "700",
      paddingHorizontal: 2,
      borderRadius: 4,
    },
    fileExt: { color: palette.textSecondary, fontSize: 12, marginLeft: 4 },
    extPreviewText: { color: palette.textSecondary, fontSize: 11, marginTop: 4 },
    breadcrumbRow: {
      flexDirection: "row",
      marginBottom: 12,
      alignItems: "center",
      flexWrap: "wrap",
    },
    breadcrumbItem: { flexDirection: "row", alignItems: "center" },
    breadcrumbLink: { color: palette.accent },
    breadcrumbCurrent: { color: palette.textSecondary },
    breadcrumbSeparator: { color: palette.textSecondary, marginHorizontal: 6 },
    listHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    listHeaderText: { color: palette.textSecondary, marginLeft: 8 },
    fileRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: palette.border,
    },
    fileRowSelected: { borderColor: palette.accent, backgroundColor: palette.surface },
    fileNamePressable: { flex: 1 },
    rowActions: { flexDirection: "row", gap: 8, marginLeft: 8 },
    rowActionText: { color: palette.textSecondary },
    rowDeleteText: { color: palette.destructive },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: isDarkMode ? "#555" : "#A0A0A0",
      marginRight: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxDisabled: {
      borderColor: palette.borderStrong,
      backgroundColor: palette.surfaceMuted,
    },
    checkboxSpacer: { width: 20, height: 20, marginRight: 10 },
    checkboxChecked: { backgroundColor: palette.accent, borderColor: palette.accent },
    checkboxDot: {
      width: 9,
      height: 9,
      borderRadius: 999,
      backgroundColor: palette.textOnAccent,
    },
    infoWrapper: { marginLeft: 10, position: "relative" },
    infoIcon: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: palette.border,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.borderStrong,
    },
    infoIconText: { color: palette.textPrimary, fontSize: 12, fontWeight: "700" },
    infoTooltip: {
      position: "absolute",
      bottom: 22,
      left: 0,
      backgroundColor: palette.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: palette.border,
      maxWidth: 220,
    },
    infoTooltipText: { color: palette.textPrimary, fontSize: 12 },
    fileIconContainer: {
      width: 20,
      alignItems: "center",
      marginRight: 10,
    },
    fileName: {
      flex: 1,
      color: palette.textPrimary,
      fontSize: 16,
      letterSpacing: 0.3,
    },
    lockBadge: { color: palette.destructive, fontSize: 12, fontWeight: "700" },
    offlineBadge: {
      color: palette.textMuted,
      fontSize: 10,
      fontWeight: "600",
      marginLeft: 6,
      backgroundColor: palette.border,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    emptyState: { alignItems: "center", paddingVertical: 48 },
    emptyStateText: {
      fontSize: 18,
      fontWeight: "600",
      color: palette.textPrimary,
      marginBottom: 8,
      letterSpacing: 0.5,
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: palette.textSecondary,
      marginBottom: 24,
      letterSpacing: 0.5,
    },
    clearFilterPill: {
      backgroundColor: palette.surfaceMuted,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    clearFilterPillText: {
      color: palette.textPrimary,
      fontSize: 12,
      fontWeight: "600",
    },
    dropMask: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: palette.overlaySoft,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 60,
    },
    dropBox: {
      width: 320,
      paddingVertical: 36,
      paddingHorizontal: 24,
      backgroundColor: palette.surface,
      borderWidth: 2,
      borderColor: palette.accent,
      borderStyle: "dashed",
      borderRadius: 16,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.5,
      shadowRadius: 18,
    },
    dropBoxTitle: {
      color: palette.accent,
      fontSize: 22,
      fontWeight: "700",
      marginBottom: 6,
      letterSpacing: 0.5,
    },
    dropBoxSub: { color: palette.textPrimary, fontSize: 14, opacity: 0.9 },
    uploadingBanner: {
      position: "absolute",
      bottom: 16,
      left: 16,
      flexDirection: "row",
      backgroundColor: palette.surface,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: palette.border,
      zIndex: 70,
    },
    uploadingText: { color: palette.textPrimary, fontSize: 14 },
  });
};

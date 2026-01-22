import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
} from "react-native";
import {
  useLocalSearchParams,
  useRouter,
  useGlobalSearchParams,
  Stack,
} from "expo-router";
import { projectService } from "../../src/services/projectService";
import { noteService } from "../../src/services/noteService";
import { fileService } from "../../src/services/fileService";
import * as DocumentPicker from "expo-document-picker";
import MembersModal from "../../src/components/project/MembersModal";
import FilesOverlay from "../../src/components/project/FilesOverlay";
import NotesSection from "../../src/components/project/NotesSection";
import FileGallery from "../../src/components/project/FileGallery";
import ArtefactsTab from "../../src/components/project/ArtefactsTab";
import TimeMachineTab from "../../src/components/project/TimeMachineTab";
import ToolsTab from "../../src/components/project/ToolsTab";
import Timeline from "../../src/components/timeline/Timeline";
import MapEditor from "../../src/components/map/MapEditor";
// Harris Matrix (web only) dynamic require later to avoid SSR issues
import ProjectMenuModal from "../../src/components/project/modals/ProjectMenuModal";
import NewFolderModal from "../../src/components/project/modals/NewFolderModal";
import DeleteConfirmModal from "../../src/components/project/modals/DeleteConfirmModal";
import RenameModal from "../../src/components/project/modals/RenameModal";
import MoveBanner from "../../src/components/project/MoveBanner";
import { ConflictResolutionModal } from "../../src/components/sync/ConflictResolutionModal";
import { conflicts, FileConflict } from "../../src/services/offlineQueueService";
import { useWebSocket } from "../../src/contexts/WebSocketContext";
import type { Project as ServiceProject } from "../../src/services/projectService.types";

// Use types from service with local aliases
type Project = ServiceProject & {
  members?: Member[];
};

interface Note {
  id: string;
  title: string;
  content?: string;
  author_id: string;
  created_at: string;
  updated_at?: string;
}

interface Member {
  id?: string;
  user_id?: string;
  display_name: string;
  email: string;
  role: string;
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const globalParams = useGlobalSearchParams<{ tab?: string; openFiles?: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "gallery"
    | "artefacts"
    | "notes"
    | "gps"
    | "matrix"
    | "history"
    | "tools"
  >("overview");
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [fileNodes, setFileNodes] = useState<any[]>([]);
  const [currentFolder, setCurrentFolder] = useState<{
    id: string | null;
    name: string;
  } | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<
    { id: string | null; name: string }[]
  >([{ id: null, name: "Root" }]);
  const [fileLoading, setFileLoading] = useState(false);
  const [renameNode, setRenameNode] = useState<any | null>(null);
  const [_renameText, setRenameText] = useState("");
  const [moveMode, setMoveMode] = useState<{ node: any | null } | null>(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [_newFolderName, setNewFolderName] = useState("");
  const [deleteNodeTarget, setDeleteNodeTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Download states - used by FilesOverlay component
  const [_downloadingNodeId, _setDownloadingNodeId] = useState<string | null>(null);
  const [_downloadProgress, _setDownloadProgress] = useState<number>(0);
  const [_downloadStatus, _setDownloadStatus] = useState<
    "in-progress" | "finalizing" | null
  >(null);
  // Removed inline preview (now separate screen)
  const [showFilesOverlay, setShowFilesOverlay] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [LuFilesIcon, setLuFilesIcon] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [GiHamburger, setGiHamburger] = useState<any>(null);
  const [HarrisMatrixComponent, setHarrisMatrixComponent] = useState<any>(null);
  const { socket, isConnected, joinProject, leaveProject } = useWebSocket();
  const reopenFilesOnReturnRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Conflict resolution state
  const [projectConflicts, setProjectConflicts] = useState<FileConflict[]>([]);
  const [currentConflict, setCurrentConflict] = useState<FileConflict | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  useEffect(() => {
    // Load web-only icon lazily to avoid native bundling issues
    if (Platform.OS === "web") {
      import("react-icons/lu")
        .then((mod) => setLuFilesIcon(() => mod.LuFiles))
        .catch((e) => console.warn("react-icons not available", e));
      import("react-icons/gi")
        .then((mod) => setGiHamburger(() => mod.GiHamburgerMenu))
        .catch((e) => console.warn("react-icons (gi) not available", e));
    }
    // Load Harris Matrix component lazily
    import("../../src/components/matrix")
      .then((mod) => setHarrisMatrixComponent(() => mod.default))
      .catch((e) => console.warn("HarrisMatrix component not available", e));
  }, []);

  useEffect(() => {
    // Load current user from storage
    (async () => {
      try {
        const { authService } = await import("../../src/services/authService");
        const user = await authService.getCurrentUser();
        setCurrentUser(user);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    loadProjectData();
    // Also check for any file conflicts when loading project
    checkForConflicts();
  }, [id]);

  // WebSocket: Join project room and listen for real-time updates
  useEffect(() => {
    if (!id || !currentUser?.id || !socket) return;

    console.log("[Project] Joining WebSocket room for project:", id);

    // Join the project room
    joinProject(id as string, currentUser.id);

    // Listen for member kicked events
    const handleMemberKicked = (data: any) => {
      console.log("[Project] Received member_kicked event:", data);
      if (data.user_id === currentUser.id && data.project_id === id) {
        Alert.alert(
          "Removed from Project",
          "You have been removed from this project.",
          [{ text: "OK", onPress: () => router.replace("/(tabs)") }],
        );
      }
    };

    // Listen for role changed events
    const handleRoleChanged = (data: any) => {
      console.log("[Project] Received role_changed event:", data);
      if (data.user_id === currentUser.id && data.project_id === id) {
        // Refresh project data to get updated role
        loadProjectData();
        Alert.alert(
          "Role Updated",
          `Your role has been changed to ${data.new_role}.`,
          [{ text: "OK" }],
        );
      }
    };

    // Listen for general member updates
    const handleMembersUpdated = (data: any) => {
      console.log("[Project] Received members_updated event:", data);
      if (data.project_id === id) {
        // Silently refresh only members list without UI disruption
        (async () => {
          try {
            const updated = await projectService.getProject(id as string);
            setMembers(updated?.members || []);
          } catch (e) {
            console.warn("[Project] Silent members refresh failed:", e);
          }
        })();
      }
    };

    // Listen for content updates (notes, files, artefacts)
    const handleContentUpdated = (data: any) => {
      console.log("[Project] Received content_updated event:", data);
      if (data.project_id === id) {
        // Silently refresh data without UI disruption - only refresh relevant data
        (async () => {
          try {
            const [projectData, notesData] = await Promise.all([
              projectService.getProject(id as string),
              noteService.getNotes(id as string),
            ]);
            setProject(projectData);
            setNotes(notesData);
            setMembers(projectData?.members || []);
          } catch (e) {
            console.warn("[Project] Silent content refresh failed:", e);
          }
        })();
      }
    };

    // Listen for timeline updates
    const handleTimelineUpdated = (data: any) => {
      console.log("[Project] Received timeline_updated event:", data);
      // Timeline component handles its own data loading
    };

    socket.on("member_kicked", handleMemberKicked);
    socket.on("role_changed", handleRoleChanged);
    socket.on("members_updated", handleMembersUpdated);
    socket.on("content_updated", handleContentUpdated);
    socket.on("timeline_updated", handleTimelineUpdated);

    // Cleanup listeners on unmount
    return () => {
      console.log("[Project] Leaving WebSocket room for project:", id);
      leaveProject(id as string, currentUser.id);
      socket.off("member_kicked", handleMemberKicked);
      socket.off("role_changed", handleRoleChanged);
      socket.off("members_updated", handleMembersUpdated);
      socket.off("content_updated", handleContentUpdated);
      socket.off("timeline_updated", handleTimelineUpdated);
    };
  }, [id, currentUser?.id, socket, isConnected]);

  const handleManageMembers = useCallback(async () => {
    try {
      if (!id) return;
      const updated = await projectService.getProject(id as string);
      setProject(updated);
      setMembers(updated?.members || []);
    } catch (e) {
      console.error("Failed to refresh members after manage action:", e);
    }
  }, [id]);

  // Get current user's role in this project
  const getCurrentUserRole = useCallback(() => {
    const userId = currentUser?.id || project?.owner_id;
    if (!userId) return null;
    if (userId === project?.owner_id) return "LEADER";
    const member = members.find((m) => m.id === userId);
    return member ? (member.role || "").toString().toUpperCase() : null;
  }, [currentUser?.id, project?.owner_id, members]);

  // Permission helpers - use defensive checks
  const currentRole = getCurrentUserRole();
  const isGuest = currentRole === "GUEST";
  const _isResearcher = currentRole === "RESEARCHER"; // For future use
  const isOwner = currentRole === "LEADER" || !currentRole; // If no role found, assume owner (for backward compatibility)
  const _canEdit = !isGuest; // For future use
  const canChangeSettings = isOwner;
  const _canDownload = !isGuest; // For future use
  const canEditFiles = !isGuest;
  const canEditMatrix = !isGuest;
  const canEditMap = !isGuest;

  // Sync UI with route param when available
  useEffect(() => {
    const tabParam = (globalParams?.tab as string) || "";
    if (tabParam === "overview") setActiveTab("overview");
    else if (tabParam === "notes") setActiveTab("notes");
    else if (tabParam === "artefacts") setActiveTab("artefacts");
    else if (tabParam === "gallery") setActiveTab("gallery");
    else if (tabParam === "matrix") setActiveTab("matrix");
    else if (tabParam === "gps") setActiveTab("gps");
    else if (tabParam === "history") setActiveTab("history");
    else if (tabParam === "tools") setActiveTab("tools");
    else if (tabParam === "files") setShowFilesOverlay(true);
    else if (tabParam === "members") setShowMembersModal(true);
  }, [globalParams?.tab]);

  // Handle openFiles param - especially for opening My Folder directly
  useEffect(() => {
    const openFilesParam = globalParams?.openFiles;
    if (openFilesParam === "myFolder" && id && !loading) {
      // Open files overlay and navigate to My Folder
      setShowFilesOverlay(true);
      // The FilesOverlay will detect the myFolder mode via a ref
      myFolderOnOpenRef.current = true;
    }
  }, [globalParams?.openFiles, id, loading]);

  const myFolderOnOpenRef = useRef(false);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      const [projectData, notesData] = await Promise.all([
        projectService.getProject(id),
        noteService.getNotes(id),
      ]);

      setProject(projectData);
      setNotes(notesData);
      // Members are now included in projectData
      setMembers(projectData.members || []);

      // Cache project for offline access (last 3 projects)
      try {
        const { recentProjectsCache } =
          await import("../../src/services/offlineService");
        await recentProjectsCache.saveRecentProject(
          id,
          projectData,
          notesData,
          projectData.members || [],
        );
      } catch (cacheError) {
        console.warn("[Project] Failed to cache project for offline:", cacheError);
      }
    } catch (error) {
      console.error("Error loading project:", error);

      // Try to load from offline cache if network fails
      try {
        const { recentProjectsCache } =
          await import("../../src/services/offlineService");
        const cached = await recentProjectsCache.getCachedProject(id);
        if (cached) {
          console.log("[Project] Loading from offline cache");
          setProject(cached.project);
          setNotes(cached.notes);
          setMembers(cached.members);
          // Silent load from cache - user can see offline icon if they're offline
        } else {
          Alert.alert(
            "Error",
            "Failed to load project details and no offline cache available.",
          );
        }
      } catch (cacheError) {
        console.error("Error loading from cache:", cacheError);
        Alert.alert("Error", "Failed to load project details");
      }
    } finally {
      setLoading(false);
    }
  };

  // Pull-to-refresh handler for mobile
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [projectData, notesData] = await Promise.all([
        projectService.getProject(id),
        noteService.getNotes(id),
      ]);
      setProject(projectData);
      setNotes(notesData);
      setMembers(projectData.members || []);
    } catch (error) {
      console.error("Error refreshing project:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [id]);

  // Check for file conflicts
  const checkForConflicts = async () => {
    if (!id) return;
    try {
      const projectConflictsList = await conflicts.getProjectConflicts(id as string);
      setProjectConflicts(projectConflictsList);

      // Show first unresolved conflict if any
      if (projectConflictsList.length > 0 && !currentConflict) {
        setCurrentConflict(projectConflictsList[0]);
        setShowConflictModal(true);
      }
    } catch (error) {
      console.error("[Project] Error checking conflicts:", error);
    }
  };

  // Handle conflict resolution
  const handleResolveConflict = async (
    resolution: "keep_local" | "keep_remote" | "keep_both",
  ) => {
    if (!currentConflict) return;

    try {
      await conflicts.resolveConflict(currentConflict.id, resolution);

      // Find and show next conflict if any
      const remaining = projectConflicts.filter((c) => c.id !== currentConflict.id);
      setProjectConflicts(remaining);

      if (remaining.length > 0) {
        setCurrentConflict(remaining[0]);
      } else {
        setCurrentConflict(null);
        setShowConflictModal(false);
        Alert.alert("Conflicts Resolved", "All file conflicts have been resolved.");
        // Refresh files
        loadRootFiles();
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to resolve conflict");
    }
  };

  const loadRootFiles = async () => {
    if (!id) return;
    try {
      setFileLoading(true);
      const nodes = await fileService.listRoot(id as string);
      // Mark Artefacts folder as locked in UI
      const decorated = nodes.map((n: any) =>
        n.type === "folder" && n.name === "Artefacts"
          ? { ...n, is_locked: true }
          : n,
      );
      setFileNodes(decorated);
      setCurrentFolder({ id: null as any, name: "Root" });
      setBreadcrumbs([{ id: null, name: "Root" }]);
    } catch (e) {
      console.error("Failed to load files:", e);
    } finally {
      setFileLoading(false);
    }
  };

  const openFolder = async (node: any) => {
    try {
      setFileLoading(true);
      const children = await fileService.listChildren(node.id);
      setFileNodes(children);
      setCurrentFolder({ id: node.id, name: node.name });
      setBreadcrumbs((prev) => [...prev, { id: node.id, name: node.name }]);
    } catch (e) {
      console.error("Failed to open folder:", e);
    } finally {
      setFileLoading(false);
    }
  };

  const navigateBreadcrumb = async (index: number) => {
    try {
      setFileLoading(true);
      if (index <= 0) {
        await loadRootFiles();
        return;
      }
      const target = breadcrumbs[index];
      if (!target || !target.id) {
        await loadRootFiles();
        return;
      }
      const children = await fileService.listChildren(target.id);
      setFileNodes(children);
      setCurrentFolder({ id: target.id, name: target.name });
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    } catch (e) {
      console.error("Failed to navigate breadcrumb:", e);
    } finally {
      setFileLoading(false);
    }
  };

  const uploadIntoCurrent = async () => {
    // Permission check: guests cannot upload files
    if (isGuest) {
      console.log("Upload blocked: user is guest, isGuest=", isGuest);
      Alert.alert(
        "Permission Denied",
        "Guests can only view files. Upload is not permitted.",
      );
      return;
    }

    try {
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: "*/*",
      });
      if (res.canceled) return;
      const asset = res.assets[0];

      console.log("Upload asset:", {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
      });

      const formData = new FormData();
      const parentId = currentFolder && currentFolder.id ? currentFolder.id : null;
      if (parentId) {
        formData.append("parent_id", String(parentId));
      }

      console.log("DEBUG: About to append file to FormData");

      if (Platform.OS === "web") {
        // On web, fetch blob and create File
        const blob = await fetch(asset.uri).then((r) => r.blob());
        let mime = asset.mimeType || blob.type || "application/octet-stream";
        if (!mime || mime === "application/octet-stream") {
          const lower = (asset.name || "").toLowerCase();
          if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mime = "image/jpeg";
          else if (lower.endsWith(".png")) mime = "image/png";
          else if (lower.endsWith(".heic")) mime = "image/heic";
        }
        const fileName = asset.name || asset.uri.split("/").pop() || "upload";
        const file = new File([blob], fileName, { type: mime });
        formData.append("file", file, fileName);
        console.log("DEBUG: Appended File to FormData:", {
          name: fileName,
          type: mime,
          size: blob.size,
        });
      } else {
        // On native, use the { uri, name, type } shape that RN FormData accepts
        const fileName = asset.name || asset.uri.split("/").pop() || "upload";

        // Properly detect MIME type from file extension
        const getMimeType = (filename: string, fallbackMime?: string): string => {
          const lower = filename.toLowerCase();
          // Images
          if (lower.endsWith(".png")) return "image/png";
          if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
          if (lower.endsWith(".gif")) return "image/gif";
          if (lower.endsWith(".webp")) return "image/webp";
          if (lower.endsWith(".heic") || lower.endsWith(".heif"))
            return "image/heic";
          if (lower.endsWith(".svg")) return "image/svg+xml";
          if (lower.endsWith(".bmp")) return "image/bmp";
          if (lower.endsWith(".ico")) return "image/x-icon";
          // Documents
          if (lower.endsWith(".pdf")) return "application/pdf";
          if (lower.endsWith(".doc")) return "application/msword";
          if (lower.endsWith(".docx"))
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
          if (lower.endsWith(".xlsx"))
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
          if (lower.endsWith(".pptx"))
            return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
          // Text
          if (lower.endsWith(".txt")) return "text/plain";
          if (lower.endsWith(".csv")) return "text/csv";
          if (lower.endsWith(".json")) return "application/json";
          if (lower.endsWith(".xml")) return "application/xml";
          if (lower.endsWith(".md")) return "text/markdown";
          if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
          // Audio
          if (lower.endsWith(".mp3")) return "audio/mpeg";
          if (lower.endsWith(".wav")) return "audio/wav";
          if (lower.endsWith(".m4a")) return "audio/mp4";
          if (lower.endsWith(".aac")) return "audio/aac";
          if (lower.endsWith(".ogg") && !lower.includes("video")) return "audio/ogg";
          if (lower.endsWith(".webm") && !lower.includes("video"))
            return "audio/webm";
          // Video
          if (lower.endsWith(".mp4")) return "video/mp4";
          if (lower.endsWith(".mov")) return "video/quicktime";
          if (lower.endsWith(".avi")) return "video/x-msvideo";
          if (lower.endsWith(".mkv")) return "video/x-matroska";
          if (lower.endsWith(".webm")) return "video/webm";
          // 3D/Point cloud
          if (lower.endsWith(".obj")) return "model/obj";
          if (lower.endsWith(".glb")) return "model/gltf-binary";
          if (lower.endsWith(".gltf")) return "model/gltf+json";
          if (lower.endsWith(".las") || lower.endsWith(".laz"))
            return "application/octet-stream";
          if (lower.endsWith(".ply")) return "application/x-ply";
          // Archives
          if (lower.endsWith(".zip")) return "application/zip";
          if (lower.endsWith(".rar")) return "application/x-rar-compressed";
          if (lower.endsWith(".7z")) return "application/x-7z-compressed";
          if (lower.endsWith(".tar")) return "application/x-tar";
          if (lower.endsWith(".gz")) return "application/gzip";
          // Use fallback or default
          return fallbackMime || "application/octet-stream";
        };

        const fileType = getMimeType(fileName, asset.mimeType);
        formData.append("file", {
          uri: asset.uri,
          name: fileName,
          type: fileType,
        } as any);
        console.log("DEBUG: Appended native file to FormData:", {
          uri: asset.uri,
          name: fileName,
          type: fileType,
        });
      }

      // Log FormData contents (web only, as native FormData doesn't support iteration)
      if (Platform.OS === "web") {
        console.log("DEBUG: FormData entries:");
        for (const [key, value] of (formData as any).entries()) {
          console.log(`  ${key}:`, value);
        }
      }

      // Call the API directly with formData
      const response = await fileService.uploadFormData(id as string, formData);
      console.log("Upload success:", response);

      if (currentFolder?.id)
        await openFolder({ id: currentFolder.id, name: currentFolder.name });
      else await loadRootFiles();
    } catch (e: any) {
      console.error("Upload error:", e);
      const message =
        e?.detail ||
        e?.message ||
        "Could not upload file. Please check your connection and try again.";
      Alert.alert("Upload Failed", message);
    }
  };

  // Load files when opening overlay
  useEffect(() => {
    if (showFilesOverlay) {
      // Re-open in the last visited folder if available; otherwise load root
      (async () => {
        try {
          if (currentFolder?.id) {
            setFileLoading(true);
            const children = await fileService.listChildren(currentFolder.id);
            setFileNodes(children);
          } else {
            await loadRootFiles();
          }
        } catch (e) {
          console.error("Failed to refresh folder on reopen:", e);
          await loadRootFiles();
        } finally {
          setFileLoading(false);
        }
      })();
    }
  }, [showFilesOverlay, id]);

  const openGalleryItem = (node: any) => {
    const lower = (node.name || "").toLowerCase();
    const isAudio =
      node.mime_type?.startsWith("audio/") ||
      /\.(mp3|wav|webm|m4a|aac|ogg)$/i.test(lower);
    if (isAudio) {
      if (node.note_id) {
        router.push({ pathname: "/voice-note/[id]", params: { id: node.note_id } });
      } else {
        router.push({
          pathname: "/data-preview",
          params: { nodeId: node.id, name: node.name, kind: "audio" },
        });
      }
      return;
    }
    const isImage =
      (node.mime_type && node.mime_type.startsWith("image/")) ||
      /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.heic)$/i.test(node.name || "");
    if (isImage) {
      router.push({
        pathname: "/image-preview",
        params: { nodeId: node.id, name: node.name },
      });
      return;
    }
    const lower2 = (node.name || "").toLowerCase();
    const isCsv = node.mime_type === "text/csv" || lower2.endsWith(".csv");
    const isExcel =
      node.mime_type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      node.mime_type === "application/vnd.ms-excel" ||
      lower2.endsWith(".xlsx") ||
      lower2.endsWith(".xls");
    const isText =
      node.mime_type === "text/plain" ||
      lower2.endsWith(".txt") ||
      lower2.endsWith(".md") ||
      lower2.endsWith(".json") ||
      node.mime_type === "application/json";
    const isPdf = node.mime_type === "application/pdf" || lower2.endsWith(".pdf");
    const isVideo =
      node.mime_type?.startsWith("video/") || /\.(mp4|webm|ogg|mov)$/i.test(lower2);
    const isPoint = /\.(las|laz|ply|e57|pcd|rwi|rwp)$/i.test(lower2);
    const isMesh = /\.(glb|gltf)$/i.test(lower2);

    if (isMesh) {
      router.push({
        pathname: "/data-preview",
        params: { nodeId: node.id, name: node.name, kind: "mesh" },
      });
      return;
    }
    if (isPoint) {
      router.push({
        pathname: "/data-preview",
        params: { nodeId: node.id, name: node.name, kind: "pointcloud" },
      });
      return;
    }
    if (isVideo) {
      router.push({
        pathname: "/data-preview",
        params: { nodeId: node.id, name: node.name, kind: "video" },
      });
      return;
    }
    if (isPdf) {
      router.push({
        pathname: "/data-preview",
        params: { nodeId: node.id, name: node.name, kind: "pdf" },
      });
      return;
    }
    if (isText) {
      router.push({
        pathname: "/data-preview",
        params: {
          nodeId: node.id,
          name: node.name,
          kind: lower2.endsWith(".md") ? "markdown" : "text",
        },
      });
      return;
    }
    if (isExcel) {
      router.push({
        pathname: "/data-preview",
        params: { nodeId: node.id, name: node.name, kind: "excel" },
      });
      return;
    }
    if (isCsv) {
      router.push({
        pathname: "/data-preview",
        params: { nodeId: node.id, name: node.name, kind: "csv" },
      });
      return;
    }
  };

  const handleCreateNote = () => {
    // Permission check: guests cannot create notes
    if (isGuest) {
      Alert.alert(
        "Permission Denied",
        "Guests can only view notes. Creating notes is not permitted.",
      );
      return;
    }

    router.push({
      pathname: "/create-note",
      params: { projectId: project?.id },
    });
  };

  const loadNotes = useCallback(async () => {
    if (!id) return;
    try {
      const data = await noteService.getNotes(id as string);
      setNotes(data || []);
    } catch (e) {
      console.error("Failed to load notes", e);
    }
  }, [id]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleNotePress = (noteId: string) => {
    const n: any = (notes as any[]).find((x: any) => x.id === noteId);
    if (!n) return;
    const hasAudio = (n.attachments || []).some((a: any) =>
      (a?.mime_type || a?.file_type || "").startsWith("audio/"),
    );
    const isVoice = (!n.content || n.content.trim() === "") && hasAudio;
    if (isVoice) {
      // Do not navigate; inline preview stays
      return;
    }
    router.push({
      pathname: "/note-detail",
      params: { noteId, projectId: id as string },
    });
  };

  const handleDeleteNote = async (noteId: string) => {
    // Permission check: guests cannot delete notes
    if (isGuest) {
      Alert.alert(
        "Permission Denied",
        "Guests can only view notes. Deleting notes is not permitted.",
      );
      return;
    }

    try {
      await noteService.deleteNote(noteId);
      Alert.alert("Deleted", "Note has been removed.");
      await loadNotes();
    } catch (e: any) {
      const message =
        e?.detail || e?.message || "Failed to delete note. Please try again.";
      Alert.alert("Error", message);
    }
  };

  // Handle file download
  const handleDownloadFile = async (node: any) => {
    if (!node || node.type !== "file") {
      Alert.alert("Error", "Cannot download - not a valid file");
      return;
    }

    try {
      if (Platform.OS === "web") {
        // Web: open download URL in new tab
        const downloadUrl = await fileService.getDownloadUrl(node.id);
        window.open(downloadUrl, "_blank");
      } else {
        // Native: download and share
        Alert.alert("Download", `Download "${node.name}"?`, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Download",
            onPress: async () => {
              try {
                const result = await fileService.downloadFile(node.id, node.name);
                if (result?.uri) {
                  // Offer to share/open the file
                  try {
                    await fileService.shareFile(result.uri);
                  } catch (_shareError) {
                    // If sharing fails, at least tell user where file is
                    Alert.alert("Downloaded", `File saved to: ${result.uri}`);
                  }
                }
              } catch (downloadError: any) {
                Alert.alert(
                  "Download Failed",
                  downloadError.message || "Failed to download file",
                );
              }
            },
          },
        ]);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to prepare download");
    }
  };

  const handleProjectSettings = () => {
    // Permission check: only owners can change project settings
    if (!canChangeSettings) {
      const role = getCurrentUserRole() || "GUEST";
      Alert.alert(
        "Permission Denied",
        `${role}s cannot modify project settings. Only the project owner can change settings.`,
      );
      return;
    }

    // Directly navigate to the Edit Project screen
    if (project?.id) {
      router.push({
        pathname: "/edit-project",
        params: { projectId: project.id },
      });
    } else {
      Alert.alert("Please wait", "Project is still loading.");
    }
  };

  // Note rendering is now handled by NotesSection component
  const _renderNote = ({ item }: { item: Note }) => (
    <TouchableOpacity
      style={styles.noteCard}
      onPress={() => handleNotePress(item.id)}
    >
      <View style={styles.noteHeader}>
        <Text style={styles.noteTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.noteDate}>
          {item.updated_at
            ? new Date(item.updated_at).toLocaleDateString(undefined, {
                timeZone: "UTC",
              })
            : ""}
        </Text>
      </View>
      {item.content && (
        <Text style={styles.notePreview} numberOfLines={2}>
          {item.content}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderMember = ({ item }: { item: Member }) => (
    <View style={styles.memberCardInner}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>
          {item.display_name?.charAt(0).toUpperCase() || "U"}
        </Text>
      </View>
      <View style={styles.memberDetails}>
        <Text style={styles.memberName}>{item.display_name}</Text>
        <Text style={styles.memberEmail}>{item.email}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: "Loading..." }} />
        <ActivityIndicator size="large" color="#FF2A2A" />
        <Text style={styles.loadingText}>Loading project details...</Text>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen
          options={{
            title: "Project Not Found",
            headerStyle: { backgroundColor: "#111111" },
            headerTintColor: "#FF2A2A",
            headerTitleStyle: {
              color: "#F5F5F5",
              fontSize: 18,
              fontWeight: "600",
            },
            headerShown: true,
          }}
        />
        <Text style={styles.errorText}>Project not found</Text>
        <Text style={styles.errorSubtext}>
          You may have been removed from this project or it no longer exists.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={styles.backButtonText}>Go to Projects</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          // Remove visible title next to back while keeping header spacing
          headerTitle: " ",
          headerStyle: { backgroundColor: "#111111" },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: {
            color: "transparent",
            fontSize: 18,
            fontWeight: "600",
          },
          headerBackTitle: "Projects",
          headerShown: true,
          // On iOS, hide custom back button to avoid duplicate with native back
          headerLeft:
            Platform.OS === "ios"
              ? undefined
              : () => (
                  <TouchableOpacity
                    onPress={() => router.replace("/(tabs)")}
                    style={styles.headerBackButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.headerBackIcon}>‹</Text>
                  </TouchableOpacity>
                ),
          headerBackVisible: true,
          presentation: "card",
          // Right side: Files icon (left) + Burger (right)
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => setShowFilesOverlay(true)}
                style={styles.iconButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                {Platform.OS === "web" && LuFilesIcon ? (
                  <LuFilesIcon color="#FF2A2A" size={18} />
                ) : (
                  <Text style={styles.iconText}>📁</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowMenu((p) => !p)}
                style={styles.iconButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                {Platform.OS === "web" && GiHamburger ? (
                  <GiHamburger color="#FF2A2A" size={18} />
                ) : (
                  <Text style={styles.iconText}>☰</Text>
                )}
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <ScrollView
        style={styles.content}
        scrollEnabled={activeTab !== "matrix"}
        refreshControl={
          Platform.OS !== "web" ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#C41E3A"
              colors={["#C41E3A"]}
              progressBackgroundColor="#1C1C1E"
            />
          ) : undefined
        }
      >
        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === "overview" ? (
            <View style={styles.overviewContainer}>
              {/* Hero Section */}
              <View style={styles.overviewHero}>
                <Text style={styles.overviewTitle}>{project.name}</Text>
                {!!project.ran_lmi_id && (
                  <View style={styles.overviewBadge}>
                    <Text style={styles.overviewBadgeText}>
                      RAN/LMI: {project.ran_lmi_id}
                    </Text>
                  </View>
                )}
              </View>

              {/* Stats Grid */}
              <View style={styles.overviewStatsGrid}>
                <View style={styles.overviewStatCard}>
                  <Text style={styles.overviewStatValue}>{members.length}</Text>
                  <Text style={styles.overviewStatLabel}>Team Members</Text>
                </View>
                <View style={styles.overviewStatCard}>
                  <Text style={styles.overviewStatValue}>{notes.length}</Text>
                  <Text style={styles.overviewStatLabel}>Notes</Text>
                </View>
              </View>

              {/* Description */}
              {!!project.description && (
                <View style={styles.overviewCard}>
                  <View style={styles.overviewCardHeader}>
                    <View style={styles.overviewIconCircle}>
                      <Text style={styles.overviewIcon}>📝</Text>
                    </View>
                    <Text style={styles.overviewCardTitle}>About</Text>
                  </View>
                  <Text style={styles.overviewDescription}>
                    {project.description}
                  </Text>
                </View>
              )}

              {/* Interactive Timeline */}
              <View style={styles.overviewCard}>
                <View style={styles.overviewCardHeader}>
                  <View style={styles.overviewIconCircle}>
                    <Text style={styles.overviewIcon}>📅</Text>
                  </View>
                  <Text style={styles.overviewCardTitle}>Activity Timeline</Text>
                </View>
                <View style={{ height: 400, marginTop: 12 }}>
                  <Timeline projectId={project.id} maxHeight={400} />
                </View>
              </View>
            </View>
          ) : activeTab === "gallery" ? (
            <FileGallery
              projectId={project?.id as string}
              onOpenItem={openGalleryItem}
            />
          ) : activeTab === "artefacts" ? (
            <ArtefactsTab projectId={project?.id as string} canEdit={canEditFiles} />
          ) : activeTab === "notes" ? (
            <NotesSection
              notes={notes as any}
              onCreateNote={handleCreateNote}
              onNotePress={handleNotePress}
              onDeleteNote={handleDeleteNote}
              canEdit={!isGuest}
            />
          ) : activeTab === "gps" ? (
            <View
              style={
                Platform.OS === "web"
                  ? ({
                      height: "calc(100vh - 280px)",
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "#2A2A2A",
                    } as any)
                  : {
                      height: 520,
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "#2A2A2A",
                    }
              }
            >
              <MapEditor projectId={project?.id as string} canEdit={canEditMap} />
            </View>
          ) : activeTab === "matrix" ? (
            <View
              style={
                Platform.OS === "web"
                  ? ({
                      height: "calc(100vh - 280px)",
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "#2A2A2A",
                      backgroundColor: "#0A0A0A",
                    } as any)
                  : {
                      height: 520,
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "#2A2A2A",
                      backgroundColor: "#0A0A0A",
                    }
              }
            >
              {Platform.OS === "web" ? (
                <div style={{ height: "100%", width: "100%" }}>
                  {HarrisMatrixComponent &&
                    React.createElement(HarrisMatrixComponent, {
                      projectId: project?.id as string,
                      canEdit: canEditMatrix,
                    })}
                </div>
              ) : (
                HarrisMatrixComponent &&
                React.createElement(HarrisMatrixComponent, {
                  projectId: project?.id as string,
                  canEdit: canEditMatrix,
                })
              )}
            </View>
          ) : activeTab === "history" ? (
            <View
              style={
                Platform.OS === "web"
                  ? ({
                      height: "calc(100vh - 280px)",
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "#2A2A2A",
                      backgroundColor: "#0A0A0A",
                    } as any)
                  : {
                      flex: 1,
                      minHeight: 520,
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "#2A2A2A",
                      backgroundColor: "#0A0A0A",
                    }
              }
            >
              <TimeMachineTab projectId={project?.id as string} />
            </View>
          ) : activeTab === "tools" ? (
            <View
              style={
                Platform.OS === "web"
                  ? ({
                      height: "calc(100vh - 280px)",
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "#2A2A2A",
                      backgroundColor: "#0A0A0A",
                    } as any)
                  : {
                      flex: 1,
                      minHeight: 520,
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "#2A2A2A",
                      backgroundColor: "#0A0A0A",
                    }
              }
            >
              <ToolsTab projectId={project?.id as string} />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom Tab Navigation: Overview + Notes + Artefacts + Matrix + More */}
      <View style={styles.bottomTabContainer}>
        <TouchableOpacity
          style={[
            styles.bottomTab,
            activeTab === "overview" && styles.activeBottomTab,
          ]}
          onPress={() => setActiveTab("overview")}
        >
          <Text
            style={[
              styles.bottomTabText,
              activeTab === "overview" && styles.activeBottomTabText,
            ]}
          >
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomTab, activeTab === "notes" && styles.activeBottomTab]}
          onPress={() => setActiveTab("notes")}
        >
          <Text
            style={[
              styles.bottomTabText,
              activeTab === "notes" && styles.activeBottomTabText,
            ]}
          >
            Notes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.bottomTab,
            activeTab === "artefacts" && styles.activeBottomTab,
          ]}
          onPress={() => setActiveTab("artefacts")}
        >
          <Text
            style={[
              styles.bottomTabText,
              activeTab === "artefacts" && styles.activeBottomTabText,
            ]}
          >
            Artefacts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.bottomTab,
            activeTab === "matrix" && styles.activeBottomTab,
          ]}
          onPress={() => setActiveTab("matrix")}
        >
          <Text
            style={[
              styles.bottomTabText,
              activeTab === "matrix" && styles.activeBottomTabText,
            ]}
          >
            Matrix
          </Text>
        </TouchableOpacity>
        {/* More dropdown button */}
        <TouchableOpacity
          style={[
            styles.bottomTab,
            styles.moreTab,
            ["gallery", "gps", "history", "tools"].includes(activeTab) &&
              styles.activeBottomTab,
          ]}
          onPress={() => setShowMoreMenu(!showMoreMenu)}
        >
          <Text
            style={[
              styles.bottomTabText,
              ["gallery", "gps", "history", "tools"].includes(activeTab) &&
                styles.activeBottomTabText,
            ]}
          >
            More ▾
          </Text>
        </TouchableOpacity>
      </View>

      {/* More menu dropdown */}
      {showMoreMenu && (
        <View style={styles.moreMenuOverlay}>
          <TouchableOpacity
            style={styles.moreMenuBackdrop}
            onPress={() => setShowMoreMenu(false)}
            activeOpacity={1}
          />
          <View style={styles.moreMenu}>
            <TouchableOpacity
              style={[
                styles.moreMenuItem,
                activeTab === "gallery" && styles.moreMenuItemActive,
              ]}
              onPress={() => {
                setActiveTab("gallery");
                setShowMoreMenu(false);
              }}
            >
              <Text
                style={[
                  styles.moreMenuText,
                  activeTab === "gallery" && styles.moreMenuTextActive,
                ]}
              >
                Gallery
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.moreMenuItem,
                activeTab === "gps" && styles.moreMenuItemActive,
              ]}
              onPress={() => {
                setActiveTab("gps");
                setShowMoreMenu(false);
              }}
            >
              <Text
                style={[
                  styles.moreMenuText,
                  activeTab === "gps" && styles.moreMenuTextActive,
                ]}
              >
                Map
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.moreMenuItem,
                activeTab === "history" && styles.moreMenuItemActive,
              ]}
              onPress={() => {
                setActiveTab("history");
                setShowMoreMenu(false);
              }}
            >
              <Text
                style={[
                  styles.moreMenuText,
                  activeTab === "history" && styles.moreMenuTextActive,
                ]}
              >
                Time Machine
              </Text>
            </TouchableOpacity>
            {Platform.OS !== "web" && (
              <TouchableOpacity
                style={[
                  styles.moreMenuItem,
                  activeTab === "tools" && styles.moreMenuItemActive,
                ]}
                onPress={() => {
                  setActiveTab("tools");
                  setShowMoreMenu(false);
                }}
              >
                <Text
                  style={[
                    styles.moreMenuText,
                    activeTab === "tools" && styles.moreMenuTextActive,
                  ]}
                >
                  Tools
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Burger menu modal */}
      <ProjectMenuModal
        visible={showMenu}
        membersCount={members.length}
        onClose={() => setShowMenu(false)}
        onOpenMembers={() => setShowMembersModal(true)}
        onOpenSettings={handleProjectSettings}
        canChangeSettings={canChangeSettings}
      />

      {/* Members modal (component) */}
      <MembersModal
        visible={showMembersModal}
        members={members.map((m) => ({
          id: m.id || m.user_id || "",
          display_name: m.display_name,
          email: m.email,
          role: (m.role || "").toUpperCase() as "LEADER" | "RESEARCHER" | "GUEST",
        }))}
        onClose={() => setShowMembersModal(false)}
        onManage={handleManageMembers}
        renderMember={(m) =>
          renderMember({
            item: {
              ...m,
              role: (m.role || "").toUpperCase() as
                | "LEADER"
                | "RESEARCHER"
                | "GUEST",
            },
          })
        }
        projectId={id as string}
        currentUserId={currentUser?.id || project?.owner_id}
        projectOwnerId={project?.owner_id}
        onKicked={async () => {
          // User was kicked from the project - redirect to home immediately
          setShowMembersModal(false);
          router.replace("/(tabs)");
        }}
      />

      {/* Files overlay full-screen (component) */}
      <Modal
        visible={showFilesOverlay}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowFilesOverlay(false)}
      >
        <FilesOverlay
          visible={true}
          currentFolder={currentFolder}
          breadcrumbs={breadcrumbs}
          fileNodes={fileNodes}
          fileLoading={fileLoading}
          onClose={() => setShowFilesOverlay(false)}
          onLoadRoot={loadRootFiles}
          onOpenFolder={openFolder as any}
          onNavigateBreadcrumb={navigateBreadcrumb}
          onUpload={uploadIntoCurrent}
          onCreateFolder={() => {
            setNewFolderName("");
            setShowNewFolderModal(true);
          }}
          onDownload={handleDownloadFile}
          onRename={(node: any) => {
            setRenameNode(node);
            setRenameText(node.name);
          }}
          onMove={(node: any) => setMoveMode({ node })}
          onDelete={(node: any) => setDeleteNodeTarget(node)}
          onOpenFile={async (node: any) => {
            if (node.type === "folder") return;
            const lower = (node.name || "").toLowerCase();
            const isAudio =
              node.mime_type?.startsWith("audio/") ||
              /\.(mp3|wav|webm|m4a|aac|ogg)$/i.test(lower);
            if (isAudio) {
              if (node.note_id) {
                router.push({
                  pathname: "/voice-note/[id]",
                  params: { id: node.note_id },
                });
              } else {
                router.push({
                  pathname: "/data-preview",
                  params: { nodeId: node.id, name: node.name, kind: "audio" },
                });
              }
              return;
            }
            const isImage =
              (node.mime_type && node.mime_type.startsWith("image/")) ||
              /\.(png|jpg|jpeg|gif|webp|heic)$/i.test(node.name || "");
            if (isImage) {
              reopenFilesOnReturnRef.current = true;
              setShowFilesOverlay(false);
              router.push({
                pathname: "/image-preview",
                params: { nodeId: node.id, name: node.name },
              });
              return;
            }
            const lower2 = (node.name || "").toLowerCase();
            const isCsv = node.mime_type === "text/csv" || lower2.endsWith(".csv");
            const isExcel =
              node.mime_type ===
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
              node.mime_type === "application/vnd.ms-excel" ||
              lower2.endsWith(".xlsx") ||
              lower2.endsWith(".xls");
            const isText =
              node.mime_type === "text/plain" ||
              lower2.endsWith(".txt") ||
              lower2.endsWith(".md") ||
              lower2.endsWith(".json") ||
              node.mime_type === "application/json";
            const isPdf =
              node.mime_type === "application/pdf" || lower2.endsWith(".pdf");
            const isVideo =
              node.mime_type?.startsWith("video/") ||
              /\.(mp4|webm|ogg|mov)$/i.test(lower2);
            const isPoint = /\.(las|laz|ply|e57|pcd|rwi|rwp)$/i.test(lower2);
            const isMesh = /\.(glb|gltf)$/i.test(lower2);

            if (
              isCsv ||
              isExcel ||
              isText ||
              isPdf ||
              isVideo ||
              isPoint ||
              isMesh ||
              isAudio
            ) {
              let kind: string = "csv";
              if (isExcel) kind = "excel";
              else if (isText) kind = lower2.endsWith(".md") ? "markdown" : "text";
              else if (isPdf) kind = "pdf";
              else if (isVideo) kind = "video";
              else if (isPoint) kind = "pointcloud";
              else if (isMesh) kind = "mesh";
              else if (isAudio) kind = "audio";
              reopenFilesOnReturnRef.current = true;
              setShowFilesOverlay(false);
              router.push({
                pathname: "/data-preview",
                params: { nodeId: node.id, name: node.name, kind },
              });
              return;
            }
            Alert.alert("Preview", "This file type is not yet supported.");
          }}
          projectId={id as string}
          onRefreshAfterUpload={async () => {
            try {
              if (currentFolder?.id) {
                const children = await fileService.listChildren(currentFolder.id);
                setFileNodes(children);
              } else {
                await loadRootFiles();
              }
            } catch (e) {
              console.error("Refresh after upload failed:", e);
            }
          }}
          canEdit={canEditFiles}
          projectMembers={members.map((m) => ({
            id: m.id || m.user_id || "",
            display_name: m.display_name,
            email: m.email,
            role: m.role,
          }))}
          currentUserId={currentUser?.id}
        />
        {/* New Folder Modal - rendered inside FilesOverlay Modal for proper z-stacking */}
        <NewFolderModal
          visible={showNewFolderModal}
          onCancel={() => setShowNewFolderModal(false)}
          onCreate={async (name) => {
            if (!canEditFiles) {
              Alert.alert(
                "Permission Denied",
                "Guests can only view files. Creating folders is not permitted.",
              );
              setShowNewFolderModal(false);
              return;
            }

            if (!name) return;
            try {
              const parentId =
                currentFolder && currentFolder.id ? currentFolder.id : undefined;
              await fileService.createFolder(id as string, name, parentId as any);
              setShowNewFolderModal(false);
              if (currentFolder?.id)
                await openFolder({ id: currentFolder.id, name: currentFolder.name });
              else await loadRootFiles();
            } catch {
              Alert.alert("Error", "Failed to create folder");
            }
          }}
        />

        {/* Delete Confirmation Modal - inside FilesOverlay Modal for proper z-stacking */}
        <DeleteConfirmModal
          visible={!!deleteNodeTarget}
          name={deleteNodeTarget?.name || ""}
          isFolder={deleteNodeTarget?.type === "folder"}
          isDeleting={isDeleting}
          onCancel={() => setDeleteNodeTarget(null)}
          onConfirm={async () => {
            if (!canEditFiles) {
              Alert.alert(
                "Permission Denied",
                "Guests can only view files. Deleting is not permitted.",
              );
              setDeleteNodeTarget(null);
              return;
            }

            if (!deleteNodeTarget) return;
            try {
              setIsDeleting(true);
              await fileService.deleteNode(deleteNodeTarget.id);
              setDeleteNodeTarget(null);
              if (currentFolder?.id)
                await openFolder({ id: currentFolder.id, name: currentFolder.name });
              else await loadRootFiles();
            } catch {
              Alert.alert("Error", "Failed to delete");
            } finally {
              setIsDeleting(false);
            }
          }}
        />

        {/* Rename Modal - inside FilesOverlay Modal for proper z-stacking */}
        <RenameModal
          visible={!!renameNode}
          currentName={renameNode?.name || ""}
          isFile={renameNode?.type === "file"}
          onCancel={() => setRenameNode(null)}
          onRename={async (newBaseName) => {
            if (!canEditFiles) {
              Alert.alert(
                "Permission Denied",
                "Guests can only view files. Renaming is not permitted.",
              );
              setRenameNode(null);
              return;
            }

            if (!renameNode) return;
            try {
              let finalName = newBaseName.trim();
              if (
                renameNode.type === "file" &&
                renameNode.name &&
                renameNode.name.includes(".") &&
                !renameNode.name.startsWith(".")
              ) {
                const ext = renameNode.name.substring(
                  renameNode.name.lastIndexOf(".") + 1,
                );
                finalName = `${finalName}.${ext}`;
              }
              await fileService.renameNode(renameNode.id, finalName);
              setRenameNode(null);
              if (currentFolder?.id)
                await openFolder({ id: currentFolder.id, name: currentFolder.name });
              else await loadRootFiles();
            } catch {
              Alert.alert("Error", "Failed to rename");
            }
          }}
        />

        {/* Move Mode Banner - inside FilesOverlay Modal for proper z-stacking */}
        <MoveBanner
          visible={!!moveMode?.node}
          itemName={moveMode?.node?.name || ""}
          onMoveHere={async () => {
            if (!canEditFiles) {
              Alert.alert(
                "Permission Denied",
                "Guests can only view files. Moving is not permitted.",
              );
              setMoveMode(null);
              return;
            }

            if (!moveMode?.node) return;
            try {
              const destParentId = currentFolder?.id || null;
              await fileService.moveNode(
                moveMode.node.id,
                (destParentId || undefined) as any,
              );
              setMoveMode(null);
              if (currentFolder?.id)
                await openFolder({ id: currentFolder.id, name: currentFolder.name });
              else await loadRootFiles();
            } catch {
              Alert.alert("Error", "Failed to move");
            }
          }}
          onCancel={() => setMoveMode(null)}
        />
      </Modal>

      {/* Image preview handled by dedicated screen now */}

      {/* Conflict Resolution Modal */}
      <ConflictResolutionModal
        visible={showConflictModal}
        conflict={currentConflict}
        onResolve={handleResolveConflict}
        onCancel={() => {
          setShowConflictModal(false);
          setCurrentConflict(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111111",
    padding: 24,
  },
  content: {
    flex: 1,
  },
  loadingText: {
    fontSize: 16,
    color: "#9A9A9A",
    marginTop: 16,
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: 18,
    color: "#F5F5F5",
    marginBottom: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  errorSubtext: {
    fontSize: 14,
    color: "#9A9A9A",
    marginBottom: 24,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  backButton: {
    backgroundColor: "#FF2A2A",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  backButtonText: {
    color: "#F5F5F5",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  projectHeader: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  projectName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  projectDescription: {
    fontSize: 16,
    color: "#9A9A9A",
    lineHeight: 24,
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  projectMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  projectMetaText: {
    fontSize: 12,
    color: "#9A9A9A",
    letterSpacing: 0.5,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    margin: 24,
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  activeTab: {
    backgroundColor: "#FF2A2A",
  },
  tabText: {
    fontSize: 14,
    color: "#9A9A9A",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: "#F5F5F5",
  },
  bottomTabContainer: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  bottomTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  activeBottomTab: {
    backgroundColor: "#FF2A2A",
  },
  bottomTabText: {
    fontSize: 12,
    color: "#9A9A9A",
    fontWeight: "600",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  activeBottomTabText: {
    color: "#F5F5F5",
  },
  overviewContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  overviewHero: {
    marginBottom: 24,
    paddingTop: 8,
  },
  overviewTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#F5F5F5",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  overviewBadge: {
    backgroundColor: "#2A2A2A",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#FF2A2A",
  },
  overviewBadgeText: {
    color: "#FF2A2A",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  overviewStatsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  overviewStatCard: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  overviewStatValue: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FF2A2A",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  overviewStatLabel: {
    fontSize: 13,
    color: "#9A9A9A",
    fontWeight: "600",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  overviewCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  overviewCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  overviewIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  overviewIcon: {
    fontSize: 20,
  },
  overviewCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F5F5F5",
    letterSpacing: 0.5,
  },
  overviewDescription: {
    fontSize: 15,
    color: "#CFCFCF",
    lineHeight: 24,
    letterSpacing: 0.3,
  },
  overviewTimelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  overviewTimelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF2A2A",
    marginRight: 16,
    marginTop: 4,
  },
  overviewTimelineContent: {
    flex: 1,
  },
  overviewTimelineLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  overviewTimelineUser: {
    fontSize: 12,
    color: "#9A9A9A",
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  overviewTimelineDate: {
    fontSize: 13,
    color: "#9A9A9A",
    letterSpacing: 0.3,
  },
  timelineList: {
    maxHeight: 400,
  },
  timelineListContent: {
    paddingBottom: 8,
  },
  overviewSection: {
    marginBottom: 24,
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  overviewSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FF2A2A",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  overviewText: {
    fontSize: 15,
    color: "#F5F5F5",
    letterSpacing: 0.3,
  },
  overviewMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  overviewLabel: {
    fontSize: 14,
    color: "#9A9A9A",
    letterSpacing: 0.3,
  },
  overviewValue: {
    fontSize: 14,
    color: "#F5F5F5",
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  tabContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 0,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  fileIcon: {
    fontSize: 18,
    marginRight: 10,
    color: "#F5F5F5",
  },
  fileName: {
    flex: 1,
    color: "#F5F5F5",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  fileExt: {
    color: "#9A9A9A",
    fontSize: 14,
  },
  lockBadge: {
    color: "#FF4444",
    fontSize: 12,
    fontWeight: "700",
  },
  progressBarContainer: {
    marginTop: 4,
    width: 120,
    height: 6,
    backgroundColor: "#2A2A2A",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FF2A2A",
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  previewCard: {
    backgroundColor: "#1E1E1A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#333",
    width: "100%",
    maxHeight: "85%",
  },
  previewTitle: {
    color: "#F5F5F5",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 12,
  },
  previewImageContainer: {
    flex: 1,
    minHeight: 300,
    maxHeight: 600,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  sheetRoot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheetContainer: {
    backgroundColor: "#1E1E1A",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: "#333",
    maxHeight: "80%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#444",
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sheetAction: {
    color: "#9A9A9A",
    fontSize: 14,
    fontWeight: "600",
  },
  sheetActionClose: {
    color: "#FF4444",
    fontSize: 14,
    fontWeight: "600",
  },
  sheetImageWrapper: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetImage: {
    width: "100%",
    height: "100%",
  },
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: "#CCCCCC",
    marginBottom: 16,
    lineHeight: 20,
  },
  confirmInput: {
    backgroundColor: "#121212",
    color: "#F5F5F5",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#2A2A2A",
  },
  modalButtonText: {
    color: "#F5F5F5",
    fontSize: 14,
    fontWeight: "600",
  },
  moveBanner: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F5F5F5",
    letterSpacing: 0.5,
  },
  addButton: {
    backgroundColor: "#FF2A2A",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 12,
    color: "#F5F5F5",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  noteCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F5F5F5",
    flex: 1,
    marginRight: 12,
    letterSpacing: 0.5,
  },
  noteDate: {
    fontSize: 12,
    color: "#9A9A9A",
    letterSpacing: 0.5,
  },
  notePreview: {
    fontSize: 14,
    color: "#9A9A9A",
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FF2A2A",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F5F5F5",
    letterSpacing: 0.5,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  memberEmail: {
    fontSize: 14,
    color: "#9A9A9A",
    letterSpacing: 0.5,
  },
  memberCardInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  memberDetails: {
    flex: 1,
  },
  memberRole: {
    backgroundColor: "#2A2A2A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  memberRoleText: {
    fontSize: 12,
    color: "#FF2A2A",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#9A9A9A",
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  createButton: {
    backgroundColor: "#FF2A2A",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F5F5F5",
    letterSpacing: 0.5,
  },
  settingsButton: {
    padding: 8,
    marginRight: 8,
  },
  settingsIcon: {
    fontSize: 16,
    color: "#FF2A2A",
    fontWeight: "600",
  },
  headerBackButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerBackIcon: {
    color: "#FF2A2A",
    fontSize: 22,
    fontWeight: "700",
    marginTop: -2,
  },
  iconButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  iconText: {
    color: "#FF2A2A",
    fontSize: 18,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  menuCard: {
    backgroundColor: "#1E1E1A",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    marginTop: 56,
    marginRight: 12,
    minWidth: 200,
    paddingVertical: 8,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    color: "#F5F5F5",
    fontSize: 14,
    fontWeight: "600",
  },
  // Gallery styles
  galleryControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  galleryControls: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  galleryModeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  galleryModeBtnActive: {
    backgroundColor: "#FF2A2A",
  },
  galleryModeText: {
    color: "#9A9A9A",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  galleryModeTextActive: {
    color: "#F5F5F5",
  },
  galleryGroupHeader: {
    color: "#F5F5F5",
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  galleryTile: {
    width: "31%",
    minWidth: 120,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 8,
  },
  galleryThumb: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: "#0A0A0A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  galleryIcon: {
    fontSize: 24,
    color: "#F5F5F5",
  },
  galleryName: {
    color: "#CFCFCF",
    fontSize: 12,
  },
  // More dropdown menu styles
  moreTab: {
    borderLeftWidth: 1,
    borderLeftColor: "#2A2A2A",
  },
  moreMenuOverlay: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  moreMenuBackdrop: {
    position: "absolute",
    top: -2000,
    left: 0,
    right: 0,
    bottom: -60,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  moreMenu: {
    position: "absolute",
    right: 12,
    bottom: 8,
    backgroundColor: "#1E1E1A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#333",
    padding: 8,
    minWidth: 180,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      },
    }),
  },
  moreMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  moreMenuItemActive: {
    backgroundColor: "rgba(255, 42, 42, 0.15)",
  },
  moreMenuIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  moreMenuText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#F5F5F5",
    letterSpacing: 0.3,
  },
  moreMenuTextActive: {
    color: "#FF2A2A",
  },
});

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform, RefreshControl, View, Text, ActivityIndicator } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGlobalSearchParams, useLocalSearchParams, useRouter } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { LiquidGlassButton } from "@/src/components/ui/LiquidGlassButton";
import { projectService } from "@/src/services/projectService";
import { noteService } from "@/src/services/noteService";
import { showAlert } from "@/src/utils/alert";
import { fileService } from "@/src/services/fileService";
import * as DocumentPicker from "expo-document-picker";
import { conflicts, FileConflict } from "@/src/services/offlineQueueService";
import { useWebSocket } from "@/src/contexts/WebSocketContext";
import type { Project as ServiceProject } from "@/src/services/projectService.types";
import styles from "@/src/components/project/ProjectDetailStyles";

export interface Note {
  id: string;
  title: string;
  content?: string;
  author_id: string;
  created_at: string;
  updated_at?: string;
}

export interface Member {
  id?: string;
  user_id?: string;
  display_name: string;
  email: string;
  role: string;
}

export type ProjectTabName =
  | "overview"
  | "notes"
  | "artefacts"
  | "matrix"
  | "gallery"
  | "gps"
  | "history"
  | "tools";

export type Project = ServiceProject & {
  members?: Member[];
};

type ProjectDetailContextValue = {
  id?: string | string[];
  project: Project | null;
  notes: Note[];
  members: Member[];
  loading: boolean;
  isRefreshing: boolean;
  currentTabName: ProjectTabName;
  setCurrentTabName: (tab: ProjectTabName) => void;
  bottomContentPad: number;
  iosHeaderPad: number;
  maybeRefreshControl?: React.ReactElement<React.ComponentProps<typeof RefreshControl>>;
  isGuest: boolean;
  isOwner: boolean;
  canChangeSettings: boolean;
  canEditFiles: boolean;
  canEditMatrix: boolean;
  canEditMap: boolean;
  currentUser: any;
  HarrisMatrixComponent: any;
  showMenu: boolean;
  setShowMenu: (value: boolean) => void;
  showFilesOverlay: boolean;
  setShowFilesOverlay: (value: boolean) => void;
  showMembersModal: boolean;
  setShowMembersModal: (value: boolean) => void;
  showNewFolderModal: boolean;
  setShowNewFolderModal: (value: boolean) => void;
  deleteNodeTarget: any | null;
  setDeleteNodeTarget: (value: any | null) => void;
  renameNode: any | null;
  setRenameNode: (value: any | null) => void;
  moveMode: { node: any | null } | null;
  setMoveMode: (value: { node: any | null } | null) => void;
  fileNodes: any[];
  setFileNodes: (value: any[]) => void;
  fileLoading: boolean;
  currentFolder: { id: string | null; name: string };
  breadcrumbs: { id: string | null; name: string }[];
  openFolder: (node: any, customBreadcrumbs?: { id: string | null; name: string }[]) => Promise<void>;
  navigateBreadcrumb: (index: number) => Promise<void>;
  loadRootFiles: () => Promise<void>;
  uploadIntoCurrent: () => Promise<void>;
  openGalleryItem: (node: any) => void;
  openFileFromOverlay: (node: any) => Promise<void>;
  handleCreateNote: () => void;
  handleNotePress: (noteId: string) => void;
  handleDeleteNote: (noteId: string) => Promise<void>;
  handleDownloadFile: (node: any) => Promise<void>;
  handleProjectSettings: () => void;
  handleManageMembers: () => Promise<void>;
  renderMember: ({ item }: { item: Member }) => React.ReactElement;
  setRenameText: (value: string) => void;
  setNewFolderName: (value: string) => void;
  isDeleting: boolean;
  setIsDeleting: (value: boolean) => void;
  projectConflicts: FileConflict[];
  currentConflict: FileConflict | null;
  showConflictModal: boolean;
  handleResolveConflict: (resolution: "keep_local" | "keep_remote" | "keep_both") => Promise<void>;
  setShowConflictModal: (value: boolean) => void;
  setCurrentConflict: (value: FileConflict | null) => void;
  onExitProject: () => Promise<void>;
  onDeleteProject: () => Promise<void>;
  onTransferLeadership: () => void;
  goToProjects: () => void;
  navigateToTab: (tab: ProjectTabName) => void;
};

const ProjectDetailContext = createContext<ProjectDetailContextValue | null>(null);

export function ProjectDetailProvider({ children }: { children: React.ReactNode }) {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const iosHeaderPad =
    Platform.OS === "ios"
      ? Math.max(headerHeight || 0, (insets.top || 0) + 44) + 8
      : 0;

  const { id } = useLocalSearchParams<{ id: string }>();
  const globalParams = useGlobalSearchParams<{ tab?: string; openFiles?: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTabName, setCurrentTabName] = useState<ProjectTabName>("overview");
  const [fileNodes, setFileNodes] = useState<any[]>([]);
  const [currentFolder, setCurrentFolder] = useState<{ id: string | null; name: string }>({
    id: null,
    name: "Root",
  });
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "Root" },
  ]);
  const [fileLoading, setFileLoading] = useState(false);
  const [renameNode, setRenameNode] = useState<any | null>(null);
  const [, setRenameText] = useState("");
  const [moveMode, setMoveMode] = useState<{ node: any | null } | null>(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [, setNewFolderName] = useState("");
  const [deleteNodeTarget, setDeleteNodeTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFilesOverlay, setShowFilesOverlay] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [HarrisMatrixComponent, setHarrisMatrixComponent] = useState<any>(null);
  const { socket, isConnected, joinProject, leaveProject } = useWebSocket();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [projectConflicts, setProjectConflicts] = useState<FileConflict[]>([]);
  const [currentConflict, setCurrentConflict] = useState<FileConflict | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  useEffect(() => {
    import("@/src/components/matrix")
      .then((mod) => setHarrisMatrixComponent(() => mod.default))
      .catch(() => {
        /* HarrisMatrix not available on native - expected */
      });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { authService } = await import("@/src/services/authService");
        const user = await authService.getCurrentUser();
        setCurrentUser(user);
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    loadProjectData();
    checkForConflicts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id || !currentUser?.id || !socket) return;

    joinProject(id as string, currentUser.id);

    const handleMemberKicked = (data: any) => {
      if (data.user_id === currentUser.id && data.project_id === id) {
        showAlert(
          "Removed from Project",
          "You have been removed from this project.",
          [{ text: "OK", onPress: () => router.replace("/(tabs)") }],
        );
      }
    };

    const handleRoleChanged = (data: any) => {
      if (data.user_id === currentUser.id && data.project_id === id) {
        const roleHierarchy: Record<string, number> = {
          leader: 3,
          researcher: 2,
          guest: 1,
        };
        const newRoleLevel = roleHierarchy[data.new_role?.toLowerCase()] || 0;
        const currentRoleLevel = roleHierarchy[getCurrentUserRole()?.toLowerCase() || ""] || 0;

        (async () => {
          try {
            const [projectData, notesData] = await Promise.all([
              projectService.getProject(id as string),
              noteService.getNotes(id as string),
            ]);
            setProject(projectData);
            setNotes(notesData);
            setMembers(projectData?.members || []);
          } catch {
            // ignore
          }
        })();

        if (newRoleLevel < currentRoleLevel) {
          showAlert(
            "Permissions Updated",
            `Your role has been changed to ${data.new_role}. Some actions may now be restricted.`,
            [{ text: "OK" }],
          );
        }
      }
    };

    const handleMembersUpdated = (data: any) => {
      if (data.project_id === id) {
        (async () => {
          try {
            const updated = await projectService.getProject(id as string);
            setMembers(updated?.members || []);
          } catch {
            // ignore
          }
        })();
      }
    };

    const handleContentUpdated = (data: any) => {
      if (data.project_id === id) {
        (async () => {
          try {
            if (data.content_type === "notes") {
              const notesData = await noteService.getNotes(id as string);
              setNotes(notesData);
            } else {
              const [projectData, notesData] = await Promise.all([
                projectService.getProject(id as string),
                noteService.getNotes(id as string),
              ]);
              setProject(projectData);
              setNotes(notesData);
              setMembers(projectData?.members || []);
            }
          } catch {
            // ignore
          }
        })();
      }
    };

    socket.on("member_kicked", handleMemberKicked);
    socket.on("role_changed", handleRoleChanged);
    socket.on("members_updated", handleMembersUpdated);
    socket.on("content_updated", handleContentUpdated);

    return () => {
      leaveProject(id as string, currentUser.id);
      socket.off("member_kicked", handleMemberKicked);
      socket.off("role_changed", handleRoleChanged);
      socket.off("members_updated", handleMembersUpdated);
      socket.off("content_updated", handleContentUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentUser?.id, socket, isConnected]);

  const handleManageMembers = useCallback(async () => {
    try {
      if (!id) return;
      const updated = await projectService.getProject(id as string);
      setProject(updated);
      setMembers(updated?.members || []);
    } catch {
      // ignore
    }
  }, [id]);

  const getCurrentUserRole = useCallback(() => {
    const userId = currentUser?.id || project?.owner_id;
    if (!userId) return null;
    if (userId === project?.owner_id) return "LEADER";
    const member = members.find((m) => m.id === userId);
    return member ? (member.role || "").toString().toUpperCase() : null;
  }, [currentUser?.id, project?.owner_id, members]);

  const currentRole = getCurrentUserRole();
  const isGuest = currentRole === "GUEST";
  const isOwner = currentRole === "LEADER" || !currentRole;
  const canChangeSettings = isOwner;
  const canEditFiles = !isGuest;
  const canEditMatrix = !isGuest;
  const canEditMap = !isGuest;

  useEffect(() => {
    const tabParam = (globalParams?.tab as string) || "";
    if (tabParam === "files") {
      setShowFilesOverlay(true);
      return;
    }
    if (tabParam === "members") {
      setShowMembersModal(true);
      return;
    }
    const knownTabs = [
      "overview",
      "notes",
      "artefacts",
      "matrix",
      "gallery",
      "gps",
      "history",
      "tools",
    ] as const;
    if ((knownTabs as readonly string[]).includes(tabParam)) {
      navigateToTab(tabParam as ProjectTabName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalParams?.tab]);

  useEffect(() => {
    const openFilesParam = globalParams?.openFiles;
    if (openFilesParam === "myFolder" && id && !loading) {
      setShowFilesOverlay(true);
      myFolderOnOpenRef.current = true;
    }
  }, [globalParams?.openFiles, id, loading]);

  const myFolderOnOpenRef = useRef(false);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      if (!id) return;
      const [projectData, notesData] = await Promise.all([
        projectService.getProject(id),
        noteService.getNotes(id),
      ]);

      setProject(projectData);
      setNotes(notesData);
      setMembers(projectData.members || []);

      try {
        const { recentProjectsCache } = await import("@/src/services/offlineService");
        await recentProjectsCache.saveRecentProject(
          id,
          projectData,
          notesData,
          projectData.members || [],
        );
      } catch {
        // ignore
      }
    } catch {
      try {
        const { recentProjectsCache } = await import("@/src/services/offlineService");
        const cached = await recentProjectsCache.getCachedProject(id);
        if (cached) {
          setProject(cached.project);
          setNotes(cached.notes);
          setMembers(cached.members);
        } else {
          showAlert("Error", "Failed to load project details and no offline cache available.");
        }
      } catch {
        showAlert("Error", "Failed to load project details");
      }
    } finally {
      setLoading(false);
    }
  };

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
    } finally {
      setIsRefreshing(false);
    }
  }, [id]);

  const checkForConflicts = async () => {
    if (!id) return;
    try {
      const projectConflictsList = await conflicts.getProjectConflicts(id as string);
      setProjectConflicts(projectConflictsList);
      if (projectConflictsList.length > 0 && !currentConflict) {
        setCurrentConflict(projectConflictsList[0]);
        setShowConflictModal(true);
      }
    } catch {
      // ignore
    }
  };

  const handleResolveConflict = async (
    resolution: "keep_local" | "keep_remote" | "keep_both",
  ) => {
    if (!currentConflict) return;

    try {
      await conflicts.resolveConflict(currentConflict.id, resolution);
      const remaining = projectConflicts.filter((c) => c.id !== currentConflict.id);
      setProjectConflicts(remaining);

      if (remaining.length > 0) {
        setCurrentConflict(remaining[0]);
      } else {
        setCurrentConflict(null);
        setShowConflictModal(false);
        showAlert("Conflicts Resolved", "All file conflicts have been resolved.");
        loadRootFiles();
      }
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to resolve conflict");
    }
  };

  const loadRootFiles = async () => {
    if (!id) return;
    try {
      setFileLoading(true);
      const nodes = await fileService.listRoot(id as string);
      const decorated = nodes.map((n: any) =>
        n.type === "folder" && n.name === "Artefacts" ? { ...n, is_locked: true } : n,
      );
      setFileNodes(decorated);
      setCurrentFolder({ id: null, name: "Root" });
      setBreadcrumbs([{ id: null, name: "Root" }]);
    } finally {
      setFileLoading(false);
    }
  };

  const openFolder = async (
    node: any,
    customBreadcrumbs?: { id: string | null; name: string }[],
  ) => {
    try {
      setFileLoading(true);
      const children = await fileService.listChildren(node.id);
      setFileNodes(children);
      setCurrentFolder({ id: node.id, name: node.name });
      if (customBreadcrumbs) {
        setBreadcrumbs(customBreadcrumbs);
      } else {
        setBreadcrumbs((prev) => [...prev, { id: node.id, name: node.name }]);
      }
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
    } finally {
      setFileLoading(false);
    }
  };

  const uploadIntoCurrent = async () => {
    if (isGuest) {
      showAlert("Permission Denied", "Guests can only view files. Upload is not permitted.");
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

      const formData = new FormData();
      const parentId = currentFolder && currentFolder.id ? currentFolder.id : null;
      if (parentId) {
        formData.append("parent_id", String(parentId));
      }

      if (Platform.OS === "web") {
        const blob = await fetch(asset.uri).then((r) => r.blob());
        let mime = asset.mimeType || blob.type || "application/octet-stream";
        if (!mime || mime === "application/octet-stream") {
          const lower = (asset.name || "").toLowerCase();
          if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mime = "image/jpeg";
          else if (lower.endsWith(".png")) mime = "image/png";
          else if (lower.endsWith(".heic")) mime = "image/heic";
        }
        let fileName = asset.name || asset.uri.split("/").pop() || "upload";
        try {
          fileName = decodeURIComponent(fileName);
        } catch {
          // ignore
        }
        const file = new File([blob], fileName, { type: mime });
        formData.append("file", file, fileName);
      } else {
        let fileName = asset.name || asset.uri.split("/").pop() || "upload";
        try {
          fileName = decodeURIComponent(fileName);
        } catch {
          // ignore
        }

        const getMimeType = (filename: string, fallbackMime?: string): string => {
          const lower = filename.toLowerCase();
          if (lower.endsWith(".png")) return "image/png";
          if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
          if (lower.endsWith(".gif")) return "image/gif";
          if (lower.endsWith(".webp")) return "image/webp";
          if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
          if (lower.endsWith(".svg")) return "image/svg+xml";
          if (lower.endsWith(".bmp")) return "image/bmp";
          if (lower.endsWith(".ico")) return "image/x-icon";
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
          if (lower.endsWith(".txt")) return "text/plain";
          if (lower.endsWith(".csv")) return "text/csv";
          if (lower.endsWith(".json")) return "application/json";
          if (lower.endsWith(".xml")) return "application/xml";
          if (lower.endsWith(".md")) return "text/markdown";
          if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
          if (lower.endsWith(".mp3")) return "audio/mpeg";
          if (lower.endsWith(".wav")) return "audio/wav";
          if (lower.endsWith(".m4a")) return "audio/mp4";
          if (lower.endsWith(".aac")) return "audio/aac";
          if (lower.endsWith(".ogg") && !lower.includes("video")) return "audio/ogg";
          if (lower.endsWith(".webm") && !lower.includes("video")) return "audio/webm";
          if (lower.endsWith(".mp4")) return "video/mp4";
          if (lower.endsWith(".mov")) return "video/quicktime";
          if (lower.endsWith(".avi")) return "video/x-msvideo";
          if (lower.endsWith(".mkv")) return "video/x-matroska";
          if (lower.endsWith(".webm")) return "video/webm";
          if (lower.endsWith(".obj")) return "model/obj";
          if (lower.endsWith(".glb")) return "model/gltf-binary";
          if (lower.endsWith(".gltf")) return "model/gltf+json";
          if (lower.endsWith(".las") || lower.endsWith(".laz"))
            return "application/octet-stream";
          if (lower.endsWith(".ply")) return "application/x-ply";
          if (lower.endsWith(".zip")) return "application/zip";
          if (lower.endsWith(".rar")) return "application/x-rar-compressed";
          if (lower.endsWith(".7z")) return "application/x-7z-compressed";
          if (lower.endsWith(".tar")) return "application/x-tar";
          if (lower.endsWith(".gz")) return "application/gzip";
          return fallbackMime || "application/octet-stream";
        };

        const fileType = getMimeType(fileName, asset.mimeType);
        formData.append("file", {
          uri: asset.uri,
          name: fileName,
          type: fileType,
        } as any);
      }

      await fileService.uploadFormData(id as string, formData);

      if (currentFolder?.id) await openFolder({ id: currentFolder.id, name: currentFolder.name });
      else await loadRootFiles();
    } catch (e: any) {
      const message =
        e?.detail ||
        e?.message ||
        "Could not upload file. Please check your connection and try again.";
      showAlert("Upload Failed", message);
    }
  };

  useEffect(() => {
    if (showFilesOverlay) {
      (async () => {
        try {
          if (currentFolder?.id) {
            setFileLoading(true);
            const children = await fileService.listChildren(currentFolder.id);
            setFileNodes(children);
          } else {
            await loadRootFiles();
          }
        } catch {
          await loadRootFiles();
        } finally {
          setFileLoading(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      node.mime_type?.startsWith("video/") || /(\.mp4|\.webm|\.ogg|\.mov)$/i.test(lower2);
    const isPoint = /\.(las|laz|ply|e57|pcd|rwi|rwp)$/i.test(lower2);
    const isMesh = /\.(glb|gltf)$/i.test(lower2);
    const isUnsupported3D = /\.(obj|fbx|dae|3ds|stl)$/i.test(lower2);

    if (isUnsupported3D) {
      showAlert(
        "Unsupported Format",
        `${lower2.split(".").pop()?.toUpperCase()} files cannot be previewed yet. Only GLB and GLTF 3D formats are currently supported.\n\nYou can still download this file.`,
        [{ text: "OK" }],
      );
      return;
    }

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
    }
  };

  const openFileFromOverlay = async (node: any) => {
    if (node.type === "folder") return;
    const lower = (node.name || "").toLowerCase();
    const isAudio =
      node.mime_type?.startsWith("audio/") || /\.(mp3|wav|webm|m4a|aac|ogg)$/i.test(lower);
    if (isAudio) {
      setShowFilesOverlay(false);
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
      /\.(png|jpg|jpeg|gif|webp|heic)$/i.test(node.name || "");
    if (isImage) {
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
      node.mime_type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
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

    if (isCsv || isExcel || isText || isPdf || isVideo || isPoint || isMesh) {
      let kind: string = "csv";
      if (isExcel) kind = "excel";
      else if (isText) kind = lower2.endsWith(".md") ? "markdown" : "text";
      else if (isPdf) kind = "pdf";
      else if (isVideo) kind = "video";
      else if (isPoint) kind = "pointcloud";
      else if (isMesh) kind = "mesh";
      setShowFilesOverlay(false);
      router.push({
        pathname: "/data-preview",
        params: { nodeId: node.id, name: node.name, kind },
      });
      return;
    }

    showAlert("Preview", "This file type is not yet supported.");
  };

  const handleCreateNote = () => {
    if (isGuest) {
      showAlert("Permission Denied", "Guests can only view notes. Creating notes is not permitted.");
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
    } catch {
      // ignore
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
      return;
    }
    router.push({
      pathname: "/note-detail",
      params: { noteId, projectId: id as string },
    });
  };

  const handleDeleteNote = async (noteId: string) => {
    if (isGuest) {
      showAlert("Permission Denied", "Guests can only view notes. Deleting notes is not permitted.");
      return;
    }

    try {
      await noteService.deleteNote(noteId);
      showAlert("Deleted", "Note has been removed.");
      await loadNotes();
    } catch (e: any) {
      const message = e?.detail || e?.message || "Failed to delete note. Please try again.";
      showAlert("Error", message);
    }
  };

  const handleDownloadFile = async (node: any) => {
    if (!node || node.type !== "file") {
      showAlert("Error", "Cannot download - not a valid file");
      return;
    }

    try {
      if (Platform.OS === "web") {
        const downloadUrl = await fileService.getDownloadUrl(node.id);
        window.open(downloadUrl, "_blank");
      } else {
        showAlert("Download", `Download "${node.name}"?`, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Download",
            onPress: async () => {
              try {
                const result = await fileService.downloadFile(node.id, node.name);
                if (result?.uri) {
                  try {
                    await fileService.shareFile(result.uri);
                  } catch {
                    showAlert("Downloaded", `File saved to: ${result.uri}`);
                  }
                }
              } catch (downloadError: any) {
                showAlert("Download Failed", downloadError.message || "Failed to download file");
              }
            },
          },
        ]);
      }
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to prepare download");
    }
  };

  const handleProjectSettings = () => {
    if (!canChangeSettings) {
      const role = getCurrentUserRole() || "GUEST";
      showAlert(
        "Permission Denied",
        `${role}s cannot modify project settings. Only the project owner can change settings.`,
      );
      return;
    }

    if (project?.id) {
      router.push({
        pathname: "/edit-project",
        params: { projectId: project.id },
      });
    } else {
      showAlert("Please wait", "Project is still loading.");
    }
  };

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

  const bottomContentPad =
    Platform.OS === "ios" ? Math.max(insets.bottom || 0, 24) + 56 + 20 : 120;

  const maybeRefreshControl =
    Platform.OS !== "web" ? (
      <RefreshControl
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        tintColor="#C41E3A"
        colors={["#C41E3A"]}
        progressBackgroundColor="#1C1C1E"
      />
    ) : undefined;

  const navigateToTab = (tab: ProjectTabName) => {
    if (!id) return;
    if (tab === "overview") {
      router.push({ pathname: "/project/[id]", params: { id: id as string } });
      return;
    }
    router.push({
      pathname: `/project/[id]/${tab}` as const,
      params: { id: id as string },
    });
  };

  const onExitProject = async () => {
    if (currentUser?.id && id) {
      try {
        await projectService.removeMember(id as string, currentUser.id);
        router.replace("/(tabs)");
      } catch (e: any) {
        const msg = e?.detail || e?.message || "Failed to leave the project";
        showAlert("Error", msg);
      }
    } else {
      showAlert("Error", "Could not determine your user ID. Try logging out and back in.");
    }
  };

  const onDeleteProject = async () => {
    if (id) {
      try {
        await projectService.deleteProject(id as string);
        router.replace("/(tabs)");
      } catch {
        showAlert("Error", "Failed to delete the project");
      }
    }
  };

  const onTransferLeadership = () => {
    setShowMenu(false);
    setShowMembersModal(true);
  };

  const goToProjects = () => {
    router.replace("/(tabs)");
  };

  const value: ProjectDetailContextValue = {
    id,
    project,
    notes,
    members,
    loading,
    isRefreshing,
    currentTabName,
    setCurrentTabName,
    bottomContentPad,
    iosHeaderPad,
    maybeRefreshControl,
    isGuest,
    isOwner,
    canChangeSettings,
    canEditFiles,
    canEditMatrix,
    canEditMap,
    currentUser,
    HarrisMatrixComponent,
    showMenu,
    setShowMenu,
    showFilesOverlay,
    setShowFilesOverlay,
    showMembersModal,
    setShowMembersModal,
    showNewFolderModal,
    setShowNewFolderModal,
    deleteNodeTarget,
    setDeleteNodeTarget,
    renameNode,
    setRenameNode,
    moveMode,
    setMoveMode,
    fileNodes,
    setFileNodes,
    fileLoading,
    currentFolder,
    breadcrumbs,
    openFolder,
    navigateBreadcrumb,
    loadRootFiles,
    uploadIntoCurrent,
    openGalleryItem,
    openFileFromOverlay,
    handleCreateNote,
    handleNotePress,
    handleDeleteNote,
    handleDownloadFile,
    handleProjectSettings,
    handleManageMembers,
    renderMember,
    setRenameText,
    setNewFolderName,
    isDeleting,
    setIsDeleting,
    projectConflicts,
    currentConflict,
    showConflictModal,
    handleResolveConflict,
    setShowConflictModal,
    setCurrentConflict,
    onExitProject,
    onDeleteProject,
    onTransferLeadership,
    goToProjects,
    navigateToTab,
  };

  return <ProjectDetailContext.Provider value={value}>{children}</ProjectDetailContext.Provider>;
}

export function useProjectDetail() {
  const ctx = useContext(ProjectDetailContext);
  if (!ctx) {
    throw new Error("useProjectDetail must be used within ProjectDetailProvider");
  }
  return ctx;
}

export function ProjectLoadingState() {
  return (
    <View style={styles.safeArea}>
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF2A2A" />
        <Text style={styles.loadingText}>Loading project details...</Text>
      </View>
    </View>
  );
}

export function ProjectNotFoundState({ onReturn }: { onReturn: () => void }) {
  return (
    <View style={styles.safeArea}>
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Project not found</Text>
        <Text style={styles.errorSubtext}>
          You may have been removed from this project or it no longer exists.
        </Text>
        <LiquidGlassButton title="Go to Projects" onPress={onReturn} variant="primary" size="md" />
      </View>
    </View>
  );
}

export function ProjectHeaderActions({
  onOpenFiles,
  onOpenMenu,
}: {
  onOpenFiles: () => void;
  onOpenMenu: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <LiquidGlassButton
        title=""
        onPress={onOpenFiles}
        variant="ghost"
        size="sm"
        icon={<IconSymbol name="folder.fill" size={20} color="#FF2A2A" />}
        style={styles.headerGlassBubbleButtonSpaced}
        textStyle={{ fontSize: 0 }}
      />
      <LiquidGlassButton
        title=""
        onPress={onOpenMenu}
        variant="ghost"
        size="sm"
        icon={<IconSymbol name="line.3.horizontal" size={20} color="#FF2A2A" />}
        style={styles.headerGlassBubbleButton}
        textStyle={{ fontSize: 0 }}
      />
    </View>
  );
}

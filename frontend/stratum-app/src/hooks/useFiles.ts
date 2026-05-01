/**
 * @file
 * File management hook.
 *
 * Provides file listing, upload, download, and deletion
 * functionality for project files.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { fileService, FileNode, socketService } from "../services";

interface FilesState {
  files: FileNode[];
  currentPath: string;
  isLoading: boolean;
  error: string | null;
}

interface FilesActions {
  loadFiles: (path?: string) => Promise<void>;
  createFolder: (name: string) => Promise<boolean>;
  deleteFile: (path: string) => Promise<boolean>;
  navigateToFolder: (path: string) => void;
  navigateUp: () => void;
  refresh: () => Promise<void>;
}

/** Combined files state and action methods returned by {@link useFiles}. */
export type UseFilesReturn = FilesState & FilesActions;

/**
 * Hook for managing project files
 * Includes real-time updates via WebSocket
 */
export function useFiles(projectId: number | undefined): UseFilesReturn {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to real-time file updates
  useEffect(() => {
    if (!projectId) return;

    unsubscribeRef.current = socketService.on("content_updated", (data) => {
      if (data.content_type === "files") {
        // Refresh files list on any file change
        loadFiles(currentPath);
      }
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, currentPath]);

  // Load files when projectId changes
  useEffect(() => {
    if (projectId) {
      loadFiles("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadFiles = useCallback(
    async (path: string = ""): Promise<void> => {
      if (!projectId) return;

      setIsLoading(true);
      setError(null);

      try {
        let data: FileNode[];
        if (path === "" || path === "/") {
          data = await fileService.listRoot(projectId);
        } else {
          data = await fileService.listChildren(projectId, path);
        }
        setFiles(data);
        setCurrentPath(path);
      } catch (e: any) {
        setError(e.message || "Failed to load files");
      } finally {
        setIsLoading(false);
      }
    },
    [projectId],
  );

  const createFolder = useCallback(
    async (name: string): Promise<boolean> => {
      if (!projectId) return false;

      setIsLoading(true);
      setError(null);

      try {
        const folderPath = currentPath ? `${currentPath}/${name}` : name;
        await fileService.createFolder(projectId, folderPath);
        await loadFiles(currentPath);
        return true;
      } catch (e: any) {
        setError(e.message || "Failed to create folder");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, currentPath, loadFiles],
  );

  const deleteFile = useCallback(
    async (nodeId: string): Promise<boolean> => {
      if (!projectId) return false;

      setIsLoading(true);
      setError(null);

      try {
        await fileService.deleteNode(nodeId);
        setFiles((prev) => prev.filter((f) => f.id !== nodeId));
        return true;
      } catch (e: any) {
        setError(e.message || "Failed to delete file");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [projectId],
  );

  const navigateToFolder = useCallback(
    (path: string): void => {
      loadFiles(path);
    },
    [loadFiles],
  );

  const navigateUp = useCallback((): void => {
    if (!currentPath) return;

    const parts = currentPath.split("/");
    parts.pop();
    const parentPath = parts.join("/");
    loadFiles(parentPath);
  }, [currentPath, loadFiles]);

  const refresh = useCallback(async (): Promise<void> => {
    await loadFiles(currentPath);
  }, [loadFiles, currentPath]);

  return {
    files,
    currentPath,
    isLoading,
    error,
    loadFiles,
    createFolder,
    deleteFile,
    navigateToFolder,
    navigateUp,
    refresh,
  };
}

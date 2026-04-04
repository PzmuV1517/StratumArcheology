/**
 * @file
 * Project detail overlay container.
 *
 * Manages visibility of overlapping panels (files, forms, etc.)
 * within the project detail view.
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
import React from "react";
import { Modal } from "react-native";

import ProjectMenuModal from "@/components/project/modals/ProjectMenuModal";
import MembersModal from "@/components/project/MembersModal";
import FilesOverlay from "@/components/project/FilesOverlay";
import NewFolderModal from "@/components/project/modals/NewFolderModal";
import DeleteConfirmModal from "@/components/project/modals/DeleteConfirmModal";
import RenameModal from "@/components/project/modals/RenameModal";
import MoveBanner from "@/components/project/MoveBanner";
import { ConflictResolutionModal } from "@/components/sync/ConflictResolutionModal";
import { showAlert } from "@/utils/alert";
import { fileService } from "@/services/fileService";
import { projectService } from "@/services/projectService";
import { useProjectDetail } from "@/contexts/ProjectDetailContext";

export default function ProjectOverlays() {
  const {
    id,
    project,
    members,
    currentUser,
    showMenu,
    setShowMenu,
    showMembersModal,
    setShowMembersModal,
    showFilesOverlay,
    setShowFilesOverlay,
    showNewFolderModal,
    setShowNewFolderModal,
    deleteNodeTarget,
    setDeleteNodeTarget,
    renameNode,
    setRenameNode,
    setRenameText,
    moveMode,
    setMoveMode,
    fileNodes,
    setFileNodes,
    fileLoading,
    currentFolder,
    breadcrumbs,
    loadRootFiles,
    openFolder,
    navigateBreadcrumb,
    uploadIntoCurrent,
    handleDownloadFile,
    openFileFromOverlay,
    isDeleting,
    setIsDeleting,
    currentTabName,
    setNewFolderName,
    onExitProject,
    onDeleteProject,
    onTransferLeadership,
    canChangeSettings,
    isOwner,
    canEditFiles,
    handleManageMembers,
    renderMember,
    handleProjectSettings,
    goToProjects,
    currentConflict,
    showConflictModal,
    handleResolveConflict,
    setShowConflictModal,
    setCurrentConflict,
    navigateToTab: _navigateToTab,
    refreshProject,
  } = useProjectDetail();

  const handleTogglePublicise = async () => {
    if (!project?.id) return;
    try {
      await projectService.togglePublicise(project.id);
      await refreshProject();
      showAlert("Success", project.is_public ? "Project is now private" : "Project is now public");
    } catch (error) {
      console.error("Failed to toggle publicity:", error);
      showAlert("Error", "Failed to change project visibility");
    }
  };

  return (
    <>
      <ProjectMenuModal
        visible={showMenu}
        membersCount={members.length}
        onClose={() => setShowMenu(false)}
        onOpenMembers={() => setShowMembersModal(true)}
        onOpenSettings={handleProjectSettings}
        currentTabName={currentTabName}
        onExitProject={onExitProject}
        onDeleteProject={onDeleteProject}
        onTransferLeadership={onTransferLeadership}
        isOwner={isOwner}
        isPublic={project?.is_public ?? false}
        onTogglePublicise={handleTogglePublicise}
        canChangeSettings={canChangeSettings}
      />

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
          setShowMembersModal(false);
          goToProjects();
        }}
      />

      <Modal
        visible={showFilesOverlay}
        transparent={false}
        animationType="slide"
        presentationStyle="pageSheet"
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
          onOpenFile={openFileFromOverlay}
          projectId={id as string}
          onRefreshAfterUpload={async () => {
            try {
              if (currentFolder?.id) {
                const children = await fileService.listChildren(currentFolder.id);
                setFileNodes(children);
              } else {
                await loadRootFiles();
              }
            } catch {
              // ignore
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

        <NewFolderModal
          visible={showNewFolderModal}
          onCancel={() => setShowNewFolderModal(false)}
          onCreate={async (name) => {
            if (!canEditFiles) {
              showAlert(
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
              showAlert("Error", "Failed to create folder");
            }
          }}
        />

        <DeleteConfirmModal
          visible={!!deleteNodeTarget}
          name={deleteNodeTarget?.name || ""}
          isFolder={deleteNodeTarget?.type === "folder"}
          isDeleting={isDeleting}
          onCancel={() => setDeleteNodeTarget(null)}
          onConfirm={async () => {
            if (!canEditFiles) {
              showAlert(
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
              showAlert("Error", "Failed to delete");
            } finally {
              setIsDeleting(false);
            }
          }}
        />

        <RenameModal
          visible={!!renameNode}
          currentName={renameNode?.name || ""}
          isFile={renameNode?.type === "file"}
          onCancel={() => setRenameNode(null)}
          onRename={async (newBaseName) => {
            if (!canEditFiles) {
              showAlert(
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
              showAlert("Error", "Failed to rename");
            }
          }}
        />

        <MoveBanner
          visible={!!moveMode?.node}
          itemName={moveMode?.node?.name || ""}
          onMoveHere={async () => {
            if (!canEditFiles) {
              showAlert(
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
              showAlert("Error", "Failed to move");
            }
          }}
          onCancel={() => setMoveMode(null)}
        />
      </Modal>

      <ConflictResolutionModal
        visible={showConflictModal}
        conflict={currentConflict}
        onResolve={handleResolveConflict}
        onCancel={() => {
          setShowConflictModal(false);
          setCurrentConflict(null);
        }}
      />
    </>
  );
}

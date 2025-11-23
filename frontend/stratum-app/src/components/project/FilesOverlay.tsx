import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { fileService } from '../../services/fileService';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'note';
  mime_type?: string;
  is_locked?: boolean;
  note_id?: string;
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
  onOpenFolder: (node: FileNode) => void;
  onUpload: () => void;
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
}

export default function FilesOverlay({ visible, title = 'Files', currentFolder, fileNodes, fileLoading, breadcrumbs, onNavigateBreadcrumb, onClose, onLoadRoot, onOpenFolder, onUpload, onCreateFolder, onDownload, onRename, onMove, onDelete, onOpenFile, projectId, onRefreshAfterUpload, onDropFiles, onBulkMove, onBulkDelete, onBulkDownload }: Props) {
  if (!visible) return null;
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const rootRef = useRef<any>(null);
  const warnedMissingProject = useRef(false);

  // Prune any locked selections if file list changes
  useEffect(() => {
    const allowed = new Set(fileNodes.filter(n => !n.is_locked).map(n => n.id));
    setSelectedIds(prev => {
      const next = new Set<string>();
      prev.forEach(id => { if (allowed.has(id)) next.add(id); });
      return next;
    });
  }, [fileNodes]);

  const handleFilesUpload = useCallback(async (dropped: File[]) => {
    if (onDropFiles) {
      await onDropFiles(dropped);
      return;
    }
    if (!projectId) {
      if (!warnedMissingProject.current) {
        console.warn('FilesOverlay: missing projectId prop, cannot auto-upload dropped files');
        Alert.alert('Cannot upload', 'Project context missing.');
        warnedMissingProject.current = true;
      }
      return;
    }
    setIsUploading(true);
    setUploadCount(dropped.length);
    const tasks = dropped.map(f => {
      const fd = new FormData();
      fd.append('file', f);
      if (currentFolder?.id) fd.append('parent_id', currentFolder.id);
      return fileService.uploadFile(projectId, fd).catch(err => {
        console.error('Upload failed for', f.name, err);
        Alert.alert('Upload failed', f.name);
      });
    });
    await Promise.all(tasks);
    setIsUploading(false);
    setUploadCount(0);
    if (onRefreshAfterUpload) onRefreshAfterUpload();
  }, [projectId, currentFolder, onRefreshAfterUpload, onDropFiles]);

  // Global document-level drag events for reliability
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onDocDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
        if (!isDragging) setIsDragging(true);
      }
    };
    const onDocDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
        setIsDragging(true);
      }
    };
    const clearDrag = () => setIsDragging(false);
    const onDocDrop = (e: DragEvent) => {
      if (!e.dataTransfer) { clearDrag(); return; }
      if (e.dataTransfer.types?.includes('Files')) {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length) void handleFilesUpload(files);
      }
      clearDrag();
    };
    const onMouseOut = (e: MouseEvent) => {
      // If leaving window entirely
      if (!e.relatedTarget && isDragging) clearDrag();
    };
    document.addEventListener('dragover', onDocDragOver);
    document.addEventListener('dragenter', onDocDragEnter);
    document.addEventListener('drop', onDocDrop);
    document.addEventListener('dragend', clearDrag);
    window.addEventListener('mouseout', onMouseOut);
    return () => {
      document.removeEventListener('dragover', onDocDragOver);
      document.removeEventListener('dragenter', onDocDragEnter);
      document.removeEventListener('drop', onDocDrop);
      document.removeEventListener('dragend', clearDrag);
      window.removeEventListener('mouseout', onMouseOut);
    };
  }, [handleFilesUpload, isDragging]);

  // Compute selectable (non-locked) ids for select-all behavior
  const selectableIds = fileNodes.filter(n => !n.is_locked).map(n => n.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));

  return (
    <View ref={rootRef} style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={{ padding: 8, marginRight: 8 }}>
          <Text style={{ color: '#FF2A2A', fontSize: 18 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={{ color: '#F5F5F5', fontSize: 18, fontWeight: '700' }}>{title}</Text>
        {selectedIds.size > 0 && (
          <View style={styles.bulkBar}>
            <Text style={styles.bulkText}>{selectedIds.size} selected</Text>
            <TouchableOpacity
              onPress={async () => {
                const nodes = fileNodes.filter(n => selectedIds.has(n.id));
                if (onBulkMove) return void onBulkMove(nodes);
                Alert.alert('Bulk move', 'Parent needs to implement bulk move destination chooser.');
              }}
              style={styles.bulkBtn}
            >
              <Text style={styles.bulkBtnText}>Move</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                const nodes = fileNodes.filter(n => selectedIds.has(n.id));
                if (onBulkDelete) return void onBulkDelete(nodes);
                // default: confirm once, then delete sequentially
                Alert.alert('Delete selected', `Delete ${nodes.length} item(s)?`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                      for (const n of nodes) { await onDelete(n); }
                      setSelectedIds(new Set());
                    }
                  }
                ]);
              }}
              style={styles.bulkBtnDanger}
            >
              <Text style={styles.bulkBtnText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                const nodes = fileNodes.filter(n => selectedIds.has(n.id) && n.type === 'file');
                if (onBulkDownload) return void onBulkDownload(nodes);
                for (const n of nodes) { await onDownload(n); }
              }}
              style={styles.bulkBtn}
            >
              <Text style={styles.bulkBtnText}>Download</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedIds(new Set())} style={styles.bulkBtnClear}>
              <Text style={styles.bulkBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {Platform.OS === 'web' && isDragging && (
        <View pointerEvents="none" style={styles.dropMask}>
          <View style={styles.dropBox}>
            <Text style={styles.dropBoxTitle}>Drop file here</Text>
            <Text style={styles.dropBoxSub}>Release to upload</Text>
          </View>
        </View>
      )}
      {Platform.OS === 'web' && isUploading && (
        <View pointerEvents="none" style={styles.uploadingBanner}>
          <ActivityIndicator color="#FF2A2A" />
          <Text style={styles.uploadingText}>Uploading {uploadCount} file{uploadCount === 1 ? '' : 's'}…</Text>
        </View>
      )}
      <ScrollView style={{ flex: 1, padding: 24 }}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Files</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.actionButton} onPress={onCreateFolder}>
              <Text style={styles.actionButtonText}>+ Folder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onUpload}>
              <Text style={styles.actionButtonText}>+ Upload</Text>
            </TouchableOpacity>
          </View>
        </View>
        {fileLoading ? (
          <ActivityIndicator color="#FF2A2A" />
        ) : (
          <View>
            <View style={{ flexDirection: 'row', marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {(breadcrumbs && breadcrumbs.length ? breadcrumbs : ([{ id: null, name: 'Root' }, ...(currentFolder ? [currentFolder] : [])]))
                .map((crumb, idx, arr) => (
                  <View key={`${crumb.id ?? 'root'}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {idx < (arr.length - 1) ? (
                      <TouchableOpacity onPress={() => {
                        if (idx === 0) onLoadRoot();
                        if (onNavigateBreadcrumb) onNavigateBreadcrumb(idx);
                      }}>
                        <Text style={{ color: '#FF2A2A' }}>{idx === 0 ? 'Root' : crumb.name}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ color: '#9A9A9A' }}>{idx === 0 ? 'Root' : crumb.name}</Text>
                    )}
                    {idx < (arr.length - 1) && <Text style={{ color: '#9A9A9A', marginHorizontal: 6 }}>/</Text>}
                  </View>
                ))}
            </View>

            {fileNodes.length > 0 ? (
              <View>
                <View style={styles.listHeader}>
                  <TouchableOpacity
                    disabled={selectableIds.length === 0}
                    onPress={() => {
                      if (selectableIds.length === 0) return;
                      if (allSelected) setSelectedIds(new Set());
                      else setSelectedIds(new Set(selectableIds));
                    }}
                  >
                    <View style={[
                      styles.checkbox,
                      selectableIds.length === 0 && styles.checkboxDisabled,
                      allSelected && styles.checkboxChecked,
                    ]}>
                      {allSelected && <Text style={styles.checkboxTick}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  <Text style={{ color: '#9A9A9A', marginLeft: 8 }}>Select All</Text>
                </View>
                {fileNodes.map((node) => (
                  <View key={node.id} style={[styles.fileRow, selectedIds.has(node.id) && styles.fileRowSelected]}>
                    <TouchableOpacity
                      disabled={!!node.is_locked}
                      onPress={() => {
                        if (node.is_locked) return;
                        const next = new Set(selectedIds);
                        if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
                        setSelectedIds(next);
                      }}
                    >
                      <View style={[
                        styles.checkbox,
                        node.is_locked && styles.checkboxDisabled,
                        selectedIds.has(node.id) && styles.checkboxChecked,
                      ]}>
                        {selectedIds.has(node.id) && !node.is_locked && <Text style={styles.checkboxTick}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.fileIcon}>{node.type === 'folder' ? '📁' : node.type === 'note' ? '📝' : '📄'}</Text>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => node.type === 'folder' ? onOpenFolder(node) : onOpenFile(node)}>
                      <Text style={styles.fileName}>{node.name}</Text>
                    </TouchableOpacity>
                    {node.is_locked && <Text style={styles.lockBadge}>LOCKED</Text>}
                    <View style={{ flexDirection: 'row', gap: 8, marginLeft: 8 }}>
                      {node.type === 'file' && (
                        <TouchableOpacity onPress={() => onDownload(node)}>
                          <Text style={{ color: '#9A9A9A' }}>Download</Text>
                        </TouchableOpacity>
                      )}
                      {!node.is_locked && (
                        <>
                          <TouchableOpacity onPress={() => onRename(node)}>
                            <Text style={{ color: '#9A9A9A' }}>Rename</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => onMove(node)}>
                            <Text style={{ color: '#9A9A9A' }}>Move</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => onDelete(node)}>
                            <Text style={{ color: '#FF4444' }}>Delete</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No files</Text>
                <Text style={styles.emptyStateSubtext}>Create a folder or upload files</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111111', position: 'relative' },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A2A', flexDirection: 'row', alignItems: 'center' },
  bulkBar: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulkText: { color: '#F5F5F5', marginRight: 8 },
  bulkBtn: { backgroundColor: '#333', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  bulkBtnDanger: { backgroundColor: '#8B0000', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  bulkBtnClear: { backgroundColor: '#444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  bulkBtnText: { color: '#F5F5F5', fontSize: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#F5F5F5', letterSpacing: 0.5 },
  actionButton: { backgroundColor: '#FF2A2A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  actionButtonText: { fontSize: 12, color: '#F5F5F5', fontWeight: '600', letterSpacing: 0.5 },
  listHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  fileRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#2A2A2A' },
  fileRowSelected: { borderColor: '#FF2A2A', backgroundColor: '#1A1A1A' },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: '#555', marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  checkboxDisabled: { borderColor: '#333', backgroundColor: '#222' },
  checkboxChecked: { backgroundColor: '#FF2A2A', borderColor: '#FF2A2A' },
  checkboxTick: { color: '#111111', fontSize: 14, fontWeight: '700' },
  fileIcon: { fontSize: 18, marginRight: 10, color: '#F5F5F5' },
  fileName: { flex: 1, color: '#F5F5F5', fontSize: 16, letterSpacing: 0.3 },
  lockBadge: { color: '#FF4444', fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyStateText: { fontSize: 18, fontWeight: '600', color: '#F5F5F5', marginBottom: 8, letterSpacing: 0.5 },
  emptyStateSubtext: { fontSize: 14, color: '#9A9A9A', marginBottom: 24, letterSpacing: 0.5 },
  dropMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 60,
  },
  dropBox: {
    width: 320,
    paddingVertical: 36,
    paddingHorizontal: 24,
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#FF2A2A',
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 18,
  },
  dropBoxTitle: { color: '#FF2A2A', fontSize: 22, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 },
  dropBoxSub: { color: '#F5F5F5', fontSize: 14, opacity: 0.9 },
  uploadingBanner: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    zIndex: 70,
  },
  uploadingText: { color: '#F5F5F5', fontSize: 14 },
});

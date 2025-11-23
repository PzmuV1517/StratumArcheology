import React, { useState, useCallback } from 'react';
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
}

export default function FilesOverlay({ visible, title = 'Files', currentFolder, fileNodes, fileLoading, breadcrumbs, onNavigateBreadcrumb, onClose, onLoadRoot, onOpenFolder, onUpload, onCreateFolder, onDownload, onRename, onMove, onDelete, onOpenFile, projectId, onRefreshAfterUpload, onDropFiles }: Props) {
  if (!visible) return null;
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(async (e: any) => {
    if (Platform.OS !== 'web') return; // web-only
    e.preventDefault();
    setIsDragging(false);
    const dt = e.dataTransfer;
    if (!dt || !dt.files || dt.files.length === 0) return;
    const dropped: File[] = Array.from(dt.files);
    // Allow parent override
    if (onDropFiles) {
      await onDropFiles(dropped);
      return;
    }
    if (!projectId) {
      // Fallback: trigger normal upload flow
      if (onUpload) onUpload();
      return;
    }
    for (const f of dropped) {
      const fd = new FormData();
      fd.append('file', f);
      if (currentFolder?.id) fd.append('parent_id', currentFolder.id);
      try {
        await fileService.uploadFile(projectId, fd);
      } catch (err) {
        console.error('Upload failed for', f.name, err);
        Alert.alert('Upload failed', f.name);
      }
    }
    if (onRefreshAfterUpload) onRefreshAfterUpload();
  }, [projectId, currentFolder, onRefreshAfterUpload, onUpload, onDropFiles]);

  return (
    <View
      style={styles.root}
      {...(Platform.OS === 'web'
        ? {
            onDragEnter: (e: any) => {
              e.preventDefault();
              setIsDragging(true);
            },
            onDragOver: (e: any) => {
              e.preventDefault();
              if (!isDragging) setIsDragging(true);
            },
            onDragLeave: (e: any) => {
              e.preventDefault();
              setIsDragging(false);
            },
            onDrop: handleDrop,
          }
        : {})}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={{ padding: 8, marginRight: 8 }}>
          <Text style={{ color: '#FF2A2A', fontSize: 18 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={{ color: '#F5F5F5', fontSize: 18, fontWeight: '700' }}>{title}</Text>
      </View>
      {Platform.OS === 'web' && isDragging && (
        <View pointerEvents="none" style={styles.dropOverlay}>
          <Text style={styles.dropOverlayText}>Drop files to upload</Text>
          <Text style={styles.dropOverlaySub}>Release mouse to start upload</Text>
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
                {fileNodes.map((node) => (
                  <View key={node.id} style={styles.fileRow}>
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
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#F5F5F5', letterSpacing: 0.5 },
  actionButton: { backgroundColor: '#FF2A2A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  actionButtonText: { fontSize: 12, color: '#F5F5F5', fontWeight: '600', letterSpacing: 0.5 },
  fileRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#2A2A2A' },
  fileIcon: { fontSize: 18, marginRight: 10, color: '#F5F5F5' },
  fileName: { flex: 1, color: '#F5F5F5', fontSize: 16, letterSpacing: 0.3 },
  lockBadge: { color: '#FF4444', fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyStateText: { fontSize: 18, fontWeight: '600', color: '#F5F5F5', marginBottom: 8, letterSpacing: 0.5 },
  emptyStateSubtext: { fontSize: 14, color: '#9A9A9A', marginBottom: 24, letterSpacing: 0.5 },
  dropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,42,42,0.12)',
    borderWidth: 3,
    borderColor: '#FF2A2A',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  dropOverlayText: { color: '#FF2A2A', fontSize: 28, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 },
  dropOverlaySub: { color: '#F5F5F5', fontSize: 14, opacity: 0.9 },
});

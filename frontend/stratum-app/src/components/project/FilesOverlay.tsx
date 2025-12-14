import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet, Platform, Alert, TextInput } from 'react-native';
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
  canEdit?: boolean; // Permissions: disable editing for guests
}

export default function FilesOverlay({ visible, title = 'Files', currentFolder, fileNodes, fileLoading, breadcrumbs, onNavigateBreadcrumb, onClose, onLoadRoot, onOpenFolder, onUpload, onCreateFolder, onDownload, onRename, onMove, onDelete, onOpenFile, projectId, onRefreshAfterUpload, onDropFiles, onBulkMove, onBulkDelete, onBulkDownload, canEdit = true }: Props) {
  if (!visible) return null;
  const [isDragging, setIsDragging] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);
  const lastDragEvent = useRef<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [multiSelect, setMultiSelect] = useState(false);
  const [showInfoTip, setShowInfoTip] = useState(false);
  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [exactOnly, setExactOnly] = useState(false);
  const [extensionFilters, setExtensionFilters] = useState<string[]>([]);
  const [showExtensionFilter, setShowExtensionFilter] = useState(false);
  const [customExtInput, setCustomExtInput] = useState('');
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

  // Robust drag-and-drop handling (depth + timeout + ESC) - only for users with edit permission
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Don't set up drag-drop handlers if user can't edit
    if (!canEdit) return;

    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      if ([...e.dataTransfer.types].includes('Files')) {
        setDragDepth(d => d + 1);
        setIsDragging(true);
        lastDragEvent.current = Date.now();
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      if ([...e.dataTransfer.types].includes('Files')) {
        e.preventDefault();
        lastDragEvent.current = Date.now();
      }
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      if ([...e.dataTransfer.types].includes('Files')) {
        setDragDepth(d => {
          const next = Math.max(0, d - 1);
          if (next === 0) setIsDragging(false);
          return next;
        });
      }
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer) { resetDragState(); return; }
      if ([...e.dataTransfer.types].includes('Files')) {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length) void handleFilesUpload(files);
      }
      resetDragState();
    };
    const onDragEnd = () => { resetDragState(); };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resetDragState();
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

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragend', onDragEnd);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragend', onDragEnd);
      window.removeEventListener('keydown', onKeyDown);
      window.clearInterval(inactivityInterval);
    };
  }, [handleFilesUpload, isDragging, canEdit]);

  const getExtension = (name: string) => {
    const idx = name.lastIndexOf('.');
    return idx === -1 ? '' : name.substring(idx + 1).toLowerCase();
  };
  const getBaseName = (name: string) => {
    const idx = name.lastIndexOf('.');
    return idx === -1 ? name : name.substring(0, idx);
  };

  // Collect existing extensions for suggestions (files only)
  const availableExtensions = useMemo(() => {
    const exts = new Set<string>();
    fileNodes.forEach(n => {
      if (n.type === 'file') {
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
      nodes = nodes.filter(n => {
        if (n.type !== 'file') return false;
        const ext = getExtension(n.name);
        return extensionFilters.includes(ext);
      });
    }
    const qRaw = searchQuery.trim();
    if (!qRaw) return nodes;
    const q = qRaw.toLowerCase();
    return nodes
      .map(n => {
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
      .filter(r => r.rank !== 999)
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.node.name.localeCompare(b.node.name);
      })
      .map(r => r.node);
  }, [fileNodes, extensionFilters, searchQuery, exactOnly]);

  // Compute selectable (non-locked) ids for select-all behavior respecting filtered list
  const selectableIds = filteredNodes.filter(n => !n.is_locked).map(n => n.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));

  return (
    <View ref={rootRef} style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={{ padding: 8, marginRight: 8 }}>
          <Text style={{ color: '#FF2A2A', fontSize: 18 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={{ color: '#F5F5F5', fontSize: 18, fontWeight: '700' }}>{title}</Text>
        {multiSelect && selectedIds.size > 0 && (
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
      {Platform.OS === 'web' && isDragging && canEdit && (
        <div style={{position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 9999, display: 'flex'}}
          onDragOver={(e: any) => { e.preventDefault(); lastDragEvent.current = Date.now(); }}
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
          <div style={{backgroundColor: '#1A1A1A', borderRadius: 12, border: '2px dashed #FF2A2A', padding: 40, textAlign: 'center'}}>
            <Text style={{color: '#FF2A2A', fontSize: 20, fontWeight: '700', marginBottom: 8}}>Drop file here</Text>
            <Text style={{color: '#9A9A9A', fontSize: 14}}>Release or press ESC to cancel</Text>
          </div>
        </div>
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
            {canEdit && (
              <>
                <TouchableOpacity style={styles.actionButton} onPress={onCreateFolder}>
                  <Text style={styles.actionButtonText}>+ Folder</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={onUpload}>
                  <Text style={styles.actionButtonText}>+ Upload</Text>
                </TouchableOpacity>
              </>
            )}
            {canEdit && !multiSelect ? (
              <TouchableOpacity
                style={styles.multiToggle}
                onPress={() => {
                  setMultiSelect(true);
                }}
              >
                <Text style={styles.multiToggleText}>Select multiple files/folders?</Text>
              </TouchableOpacity>
            ) : canEdit && multiSelect ? (
              <TouchableOpacity
                style={styles.multiToggleActive}
                onPress={() => {
                  setMultiSelect(false);
                  setSelectedIds(new Set());
                  setShowInfoTip(false);
                }}
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
            placeholderTextColor="#666"
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          <TouchableOpacity
            style={styles.filterToggle}
            onPress={() => setShowExtensionFilter(v => !v)}
          >
            <Text style={{ color: '#F5F5F5', fontSize: 12 }}>{showExtensionFilter ? 'Hide Extensions' : 'Filter by extension'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setExactOnly(e => !e)}
            style={styles.exactToggle}
          >
            <View style={[styles.exactBox, exactOnly && styles.exactBoxChecked]}>
              {exactOnly && <Text style={styles.exactBoxTick}>✓</Text>}
            </View>
            <Text style={{ color: '#9A9A9A', fontSize: 12 }}>Only exact matches</Text>
          </TouchableOpacity>
        </View>
        {showExtensionFilter && (
          <View style={styles.filterPanel}>
            <View style={styles.extChipRow}>
              {availableExtensions.map(ext => {
                const active = extensionFilters.includes(ext);
                return (
                  <TouchableOpacity
                    key={ext}
                    onPress={() => {
                      setExtensionFilters(prev => {
                        const next = active ? prev.filter(e => e !== ext) : [...prev, ext];
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
                placeholderTextColor="#666"
                style={styles.customExtInput}
              />
              <TouchableOpacity
                style={styles.addExtBtn}
                onPress={() => {
                  const ext = customExtInput.trim().replace(/^\./,'').toLowerCase();
                  if (!ext) return;
                  setExtensionFilters(prev => prev.includes(ext) ? prev : [...prev, ext]);
                  setCustomExtInput('');
                }}
              >
                <Text style={styles.addExtText}>Search</Text>
              </TouchableOpacity>
            </View>
            {customExtInput.trim().length > 0 && (
              <Text style={styles.extPreviewText}>
                Will filter: .{customExtInput.trim().replace(/^\./,'').toLowerCase()} {customExtInput.startsWith('.') ? '(dot normalized)' : '(no dot needed)'}
              </Text>
            )}
          </View>
        )}
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
                {multiSelect && (
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
                    {fileNodes.some(n => n.is_locked) && (
                      <View style={styles.infoWrapper}
                        {...(Platform.OS === 'web'
                          ? { onMouseEnter: () => setShowInfoTip(true), onMouseLeave: () => setShowInfoTip(false) }
                          : {})}
                      >
                        <View style={styles.infoIcon}><Text style={styles.infoIconText}>i</Text></View>
                        {Platform.OS === 'web' && showInfoTip && (
                          <View style={styles.infoTooltip}>
                            <Text style={styles.infoTooltipText}>Locked items can’t be selected</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
                {filteredNodes.map((node) => (
                  <View key={node.id} style={[styles.fileRow, selectedIds.has(node.id) && styles.fileRowSelected]}>
                    {multiSelect ? (
                      node.is_locked ? (
                        <View style={styles.checkboxSpacer} />
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            const next = new Set(selectedIds);
                            if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
                            setSelectedIds(next);
                          }}
                        >
                          <View style={[
                            styles.checkbox,
                            selectedIds.has(node.id) && styles.checkboxChecked,
                          ]}>
                            {selectedIds.has(node.id) && <Text style={styles.checkboxTick}>✓</Text>}
                          </View>
                        </TouchableOpacity>
                      )
                    ) : (
                      <View style={styles.checkboxSpacer} />
                    )}
                    <Text style={styles.fileIcon}>{node.type === 'folder' ? '📁' : node.type === 'note' ? '📝' : '📄'}</Text>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => node.type === 'folder' ? onOpenFolder(node) : onOpenFile(node)}>
                      {renderNameWithExtension(node.name, searchQuery, exactOnly)}
                    </TouchableOpacity>
                    {node.is_locked && <Text style={styles.lockBadge}>LOCKED</Text>}
                    <View style={{ flexDirection: 'row', gap: 8, marginLeft: 8 }}>
                      {node.type === 'file' && (
                        <TouchableOpacity onPress={() => onDownload(node)}>
                          <Text style={{ color: '#9A9A9A' }}>Download</Text>
                        </TouchableOpacity>
                      )}
                      {!node.is_locked && canEdit && (
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

// Helper to highlight matched substring
function renderNameWithExtension(name: string, query: string, exactOnly: boolean) {
  const idx = name.lastIndexOf('.');
  const hasExt = idx !== -1;
  const base = hasExt ? name.substring(0, idx) : name;
  const ext = hasExt ? name.substring(idx) : '';
  const highlightedBase = highlightBase(base, query, exactOnly);
  return (
    <Text style={styles.fileName}>
      {highlightedBase}
      {hasExt && <Text style={styles.fileExt}>{ext}</Text>}
    </Text>
  );
}

function highlightBase(base: string, query: string, exactOnly: boolean) {
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
  multiToggle: { backgroundColor: '#222', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A' },
  multiToggleActive: { backgroundColor: '#333', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A' },
  multiToggleText: { color: '#F5F5F5', fontSize: 12, fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' },
  searchInput: { flexGrow: 1, minWidth: 200, backgroundColor: '#1A1A1A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, color: '#F5F5F5', borderWidth: 1, borderColor: '#2A2A2A', fontSize: 14 },
  exactToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exactBox: { width: 18, height: 18, borderWidth: 1, borderColor: '#555', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  exactBoxChecked: { backgroundColor: '#FF2A2A', borderColor: '#FF2A2A' },
  exactBoxTick: { color: '#111', fontSize: 12, fontWeight: '700' },
  filterToggle: { backgroundColor: '#222', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#2A2A2A' },
  filterPanel: { backgroundColor: '#141414', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 12 },
  extChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  extChip: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#222', borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  extChipActive: { backgroundColor: '#FF2A2A', borderColor: '#FF2A2A' },
  extChipText: { color: '#F5F5F5', fontSize: 12 },
  customExtRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customExtInput: { flexGrow: 1, minWidth: 120, backgroundColor: '#1A1A1A', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, color: '#F5F5F5', borderWidth: 1, borderColor: '#2A2A2A', fontSize: 12 },
  addExtBtn: { backgroundColor: '#333', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  clearFilterBtn: { backgroundColor: '#444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 'auto' },
  addExtText: { color: '#F5F5F5', fontSize: 12 },
  matchHighlight: { backgroundColor: '#FF2A2A', color: '#111111', fontWeight: '700', paddingHorizontal: 2, borderRadius: 4 },
  fileExt: { color: '#9A9A9A', fontSize: 12, marginLeft: 4 },
  extPreviewText: { color: '#9A9A9A', fontSize: 11, marginTop: 4 },
  listHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  fileRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#2A2A2A' },
  fileRowSelected: { borderColor: '#FF2A2A', backgroundColor: '#1A1A1A' },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: '#555', marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  checkboxDisabled: { borderColor: '#333', backgroundColor: '#222' },
  checkboxSpacer: { width: 20, height: 20, marginRight: 10 },
  checkboxChecked: { backgroundColor: '#FF2A2A', borderColor: '#FF2A2A' },
  checkboxTick: { color: '#111111', fontSize: 14, fontWeight: '700' },
  infoWrapper: { marginLeft: 10, position: 'relative' },
  infoIcon: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#444' },
  infoIconText: { color: '#F5F5F5', fontSize: 12, fontWeight: '700' },
  infoTooltip: { position: 'absolute', bottom: 22, left: 0, backgroundColor: '#1A1A1A', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#2A2A2A', maxWidth: 220 },
  infoTooltipText: { color: '#F5F5F5', fontSize: 12 },
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

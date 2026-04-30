/**
 * @file
 * Time Machine tab - unified project history, revert, and recycle bin.
 *
 * Displays the node_snapshots timeline with kind/actor filters, supports
 * one-click revert to any snapshot, and shows the 7-day recycle bin with
 * restore and empty-bin actions.
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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showAlert } from "../../utils/alert";
import {
  historyService,
  type DeletedNode,
  type SnapshotEntry,
} from "../../services/fileService.core";

const ACCENT = "#FF2A2A";
const ACCENT_SOFT = "rgba(255,42,42,0.12)";
const PAGE_SIZE = 30;

const KIND_LABELS: Record<string, string> = {
  file_content: "File edit",
  note_content: "Note edit",
  folder_metadata: "Folder change",
  acl_change: "Permissions",
  harris_matrix: "Harris Matrix",
  wheeler: "Wheeler",
  create: "Created",
  delete: "Deleted",
};

const KIND_ICONS: Record<string, string> = {
  file_content: "📄",
  note_content: "📝",
  folder_metadata: "📁",
  acl_change: "🔒",
  harris_matrix: "🔗",
  wheeler: "🗺️",
  create: "✨",
  delete: "🗑️",
};

const ALL_KINDS = Object.keys(KIND_LABELS);

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatExpiry(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const h = Math.floor(diff / 3_600_000);
  if (h <= 0) return "expired";
  if (h < 24) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

interface TimeMachineTabProps {
  projectId: string;
  isOwner?: boolean;
}

type Tab = "timeline" | "bin";

export default function TimeMachineTab({
  projectId,
  isOwner = false,
}: TimeMachineTabProps) {
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<Tab>("timeline");
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [deleted, setDeleted] = useState<DeletedNode[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [binLoading, setBinLoading] = useState(false);

  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const hasMore = snapshots.length < total;

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadTimeline = useCallback(
    async (reset = false) => {
      const isReset = reset || offsetRef.current === 0;
      if (isReset) {
        setLoading(true);
        offsetRef.current = 0;
      } else {
        setLoadingMore(true);
      }
      try {
        const data = await historyService.getProjectTimeline(projectId, {
          limit: PAGE_SIZE,
          offset: offsetRef.current,
          ...(kindFilter ? { kind: kindFilter } : {}),
        });
        if (isReset) {
          setSnapshots(data.snapshots);
        } else {
          setSnapshots((prev) => [...prev, ...data.snapshots]);
        }
        setTotal(data.total);
        offsetRef.current += data.snapshots.length;
      } catch {
        showAlert("Error", "Could not load history");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [projectId, kindFilter],
  );

  const loadBin = useCallback(async () => {
    setBinLoading(true);
    try {
      const data = await historyService.getDeletedNodes(projectId);
      setDeleted(data);
    } catch {
      showAlert("Error", "Could not load recycle bin");
    } finally {
      setBinLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    offsetRef.current = 0;
    loadTimeline(true);
  }, [loadTimeline]);

  useEffect(() => {
    if (activeTab === "bin") loadBin();
  }, [activeTab, loadBin]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    offsetRef.current = 0;
    if (activeTab === "timeline") {
      await loadTimeline(true);
    } else {
      await loadBin();
    }
    setRefreshing(false);
  }, [activeTab, loadTimeline, loadBin]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleRevert = useCallback(
    async (snap: SnapshotEntry) => {
      if (!snap.is_revertible) return;
      showAlert(
        "Revert to this version?",
        `This will restore "${snap.name_at_snapshot || "item"}" to version ${snap.version}. Current changes will be preserved as a new snapshot.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revert",
            style: "destructive",
            onPress: async () => {
              setRevertingId(snap.id);
              try {
                await historyService.restoreSnapshot(snap.id);
                showAlert("Done", "Reverted successfully.");
                await loadTimeline(true);
              } catch (e: any) {
                showAlert(
                  "Error",
                  e.response?.data?.detail || "Revert failed",
                );
              } finally {
                setRevertingId(null);
              }
            },
          },
        ],
      );
    },
    [loadTimeline],
  );

  const handleRestoreDeleted = useCallback(
    async (item: DeletedNode) => {
      setRestoringId(item.snapshot_id);
      try {
        await historyService.restoreSnapshot(item.snapshot_id);
        showAlert("Restored", `"${item.name}" has been restored.`);
        await loadBin();
      } catch (e: any) {
        showAlert("Error", e.response?.data?.detail || "Restore failed");
      } finally {
        setRestoringId(null);
      }
    },
    [loadBin],
  );

  const handleEmptyBin = useCallback(async () => {
    showAlert(
      "Empty recycle bin?",
      "All deleted items will be permanently removed. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Empty bin",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await historyService.emptyBin(projectId);
              showAlert("Done", `Permanently deleted ${res.purged} item(s).`);
              await loadBin();
            } catch (e: any) {
              showAlert("Error", e.response?.data?.detail || "Could not empty bin");
            }
          },
        },
      ],
    );
  }, [projectId, loadBin]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderSnapshotItem = useCallback(
    ({ item }: { item: SnapshotEntry }) => {
      const isReverting = revertingId === item.id;
      const icon = KIND_ICONS[item.kind] ?? "🔄";
      const label = KIND_LABELS[item.kind] ?? item.kind;

      return (
        <View style={styles.snapshotRow}>
          <View style={styles.snapshotIcon}>
            <Text style={styles.snapshotEmoji}>{icon}</Text>
          </View>
          <View style={styles.snapshotBody}>
            <Text style={styles.snapshotSummary} numberOfLines={2}>
              {item.summary || label}
            </Text>
            <View style={styles.snapshotMeta}>
              <Text style={styles.snapshotKind}>{label}</Text>
              <Text style={styles.snapshotDot}> · </Text>
              <Text style={styles.snapshotTime}>{formatRelative(item.created_at)}</Text>
              {!!item.actor_display_name && (
                <>
                  <Text style={styles.snapshotDot}> · </Text>
                  <Text style={styles.snapshotActor} numberOfLines={1}>
                    {item.actor_display_name}
                  </Text>
                </>
              )}
            </View>
          </View>
          {item.is_revertible && item.kind !== "delete" && (
            <TouchableOpacity
              style={styles.revertButton}
              onPress={() => handleRevert(item)}
              disabled={isReverting}
              accessibilityRole="button"
              accessibilityLabel={`Revert to version ${item.version}`}
            >
              {isReverting ? (
                <ActivityIndicator size="small" color={ACCENT} />
              ) : (
                <Text style={styles.revertText}>Revert</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [handleRevert, revertingId],
  );

  const renderDeletedItem = useCallback(
    ({ item }: { item: DeletedNode }) => {
      const isRestoring = restoringId === item.snapshot_id;
      return (
        <View style={styles.snapshotRow}>
          <View style={[styles.snapshotIcon, styles.binIcon]}>
            <Text style={styles.snapshotEmoji}>🗑️</Text>
          </View>
          <View style={styles.snapshotBody}>
            <Text style={styles.snapshotSummary} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.snapshotMeta}>
              <Text style={styles.snapshotTime}>
                {formatRelative(item.deleted_at)}
              </Text>
              {!!item.deleted_by_display_name && (
                <Text style={styles.snapshotActor}>
                  {" "}· {item.deleted_by_display_name}
                </Text>
              )}
              {"  "}
              <Text
                style={[
                  styles.expiryBadge,
                  new Date(item.expires_at).getTime() - Date.now() < 86_400_000 &&
                    styles.expiryBadgeUrgent,
                ]}
              >
                {formatExpiry(item.expires_at)}
              </Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={() => handleRestoreDeleted(item)}
            disabled={isRestoring}
            accessibilityRole="button"
            accessibilityLabel={`Restore ${item.name}`}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color={ACCENT} />
            ) : (
              <Text style={styles.restoreText}>Restore</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [handleRestoreDeleted, restoringId],
  );

  // ── Kind filter chips ──────────────────────────────────────────────────────

  const kindChips = useMemo(
    () => (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
      >
        <TouchableOpacity
          style={[styles.chip, kindFilter === null && styles.chipActive]}
          onPress={() => setKindFilter(null)}
        >
          <Text
            style={[styles.chipText, kindFilter === null && styles.chipTextActive]}
          >
            All
          </Text>
        </TouchableOpacity>
        {ALL_KINDS.map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.chip, kindFilter === k && styles.chipActive]}
            onPress={() => setKindFilter(kindFilter === k ? null : k)}
          >
            <Text
              style={[
                styles.chipText,
                kindFilter === k && styles.chipTextActive,
              ]}
            >
              {KIND_ICONS[k]} {KIND_LABELS[k]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    ),
    [kindFilter],
  );

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "timeline" && styles.tabItemActive]}
          onPress={() => setActiveTab("timeline")}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === "timeline" && styles.tabLabelActive,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "bin" && styles.tabItemActive]}
          onPress={() => setActiveTab("bin")}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === "bin" && styles.tabLabelActive,
            ]}
          >
            Recycle Bin {deleted.length > 0 ? `(${deleted.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "timeline" ? (
        <>
          {kindChips}
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={ACCENT} />
            </View>
          ) : (
            <FlatList
              data={snapshots}
              keyExtractor={(item) => item.id}
              renderItem={renderSnapshotItem}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={ACCENT}
                />
              }
              onEndReached={() => {
                if (hasMore && !loadingMore) {
                  loadTimeline(false);
                }
              }}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footerLoader}>
                    <ActivityIndicator color={ACCENT} size="small" />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No history yet</Text>
                  <Text style={styles.emptyBody}>
                    Changes to files and notes will appear here.
                  </Text>
                </View>
              }
              contentContainerStyle={
                snapshots.length === 0 ? styles.emptyFlex : undefined
              }
            />
          )}
        </>
      ) : (
        <>
          {isOwner && deleted.length > 0 && (
            <TouchableOpacity
              style={styles.emptyBinButton}
              onPress={handleEmptyBin}
            >
              <Text style={styles.emptyBinText}>Empty bin</Text>
            </TouchableOpacity>
          )}
          {binLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={ACCENT} />
            </View>
          ) : (
            <FlatList
              data={deleted}
              keyExtractor={(item) => item.snapshot_id}
              renderItem={renderDeletedItem}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={ACCENT}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>Recycle bin is empty</Text>
                  <Text style={styles.emptyBody}>
                    Deleted items appear here for 7 days before being permanently
                    removed.
                  </Text>
                </View>
              }
              contentContainerStyle={
                deleted.length === 0 ? styles.emptyFlex : undefined
              }
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: ACCENT,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#888888",
  },
  tabLabelActive: {
    color: ACCENT,
    fontWeight: "700",
  },
  chipsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  chipActive: {
    backgroundColor: ACCENT_SOFT,
    borderColor: ACCENT,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#555555",
  },
  chipTextActive: {
    color: ACCENT,
    fontWeight: "700",
  },
  snapshotRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEEEEE",
  },
  snapshotIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  binIcon: {
    backgroundColor: "#FFF0F0",
  },
  snapshotEmoji: {
    fontSize: 16,
  },
  snapshotBody: {
    flex: 1,
  },
  snapshotSummary: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1A1A1A",
    marginBottom: 4,
    lineHeight: 19,
  },
  snapshotMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  snapshotKind: {
    fontSize: 11,
    color: "#888888",
  },
  snapshotDot: {
    fontSize: 11,
    color: "#BBBBBB",
  },
  snapshotTime: {
    fontSize: 11,
    color: "#888888",
  },
  snapshotActor: {
    fontSize: 11,
    color: "#888888",
    maxWidth: 120,
  },
  revertButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: ACCENT_SOFT,
    borderWidth: 1,
    borderColor: ACCENT,
    minWidth: 64,
    alignItems: "center",
    marginLeft: 8,
  },
  revertText: {
    fontSize: 12,
    fontWeight: "700",
    color: ACCENT,
  },
  restoreButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#E8F5E9",
    borderWidth: 1,
    borderColor: "#4CAF50",
    minWidth: 72,
    alignItems: "center",
    marginLeft: 8,
  },
  restoreText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E7D32",
  },
  expiryBadge: {
    fontSize: 10,
    fontWeight: "600",
    color: "#888888",
  },
  expiryBadgeUrgent: {
    color: ACCENT,
  },
  emptyBinButton: {
    margin: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#FFF0F0",
    borderWidth: 1,
    borderColor: ACCENT,
    alignItems: "center",
  },
  emptyBinText: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyFlex: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333333",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 13,
    color: "#777777",
    textAlign: "center",
    lineHeight: 19,
  },
});

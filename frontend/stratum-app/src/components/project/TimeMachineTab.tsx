/**
 * @file
 * Time Machine file versioning tab component.
 *
 * Displays file version history grouped by category for
 * reviewing and restoring previous versions.
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
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../../services/api";
import { showAlert } from "../../utils/alert";

interface FileVersion {
  id: string;
  file_node_id: string;
  version: number;
  storage_path: string;
  size: string | null;
  checksum: string | null;
  created_at: string;
  created_by: string | null;
}

interface FileWithVersions {
  id: string;
  name: string;
  type: string;
  mime_type: string | null;
  size: string | null;
  current_version: number;
  created_at: string;
  updated_at: string;
  category: string;
  versions: FileVersion[];
}

interface TimeMachineData {
  project_id: string;
  total_files: number;
  total_versions: number;
  categories: Record<string, FileWithVersions[]>;
}

interface TimeMachineTabProps {
  projectId: string;
}

const CATEGORY_INFO: Record<string, { icon: string; label: string; color: string }> =
  {
    documents: { icon: "📄", label: "Documents", color: "#4A90D9" },
    spreadsheets: { icon: "📊", label: "Spreadsheets", color: "#34A853" },
    images: { icon: "🖼️", label: "Images", color: "#EA4335" },
    videos: { icon: "🎬", label: "Videos", color: "#9C27B0" },
    audio: { icon: "🎵", label: "Audio", color: "#FF9800" },
    "3d_models": { icon: "🧊", label: "3D Models", color: "#00BCD4" },
    archives: { icon: "📦", label: "Archives", color: "#795548" },
    code: { icon: "💻", label: "Code", color: "#607D8B" },
    other: { icon: "📁", label: "Other", color: "#9E9E9E" },
  };

export default function TimeMachineTab({ projectId }: TimeMachineTabProps) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<TimeMachineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const loadTimeMachineData = useCallback(async () => {
    try {
      const url = selectedCategory
        ? `/files/project/${projectId}/time-machine?category=${selectedCategory}`
        : `/files/project/${projectId}/time-machine`;

      const response = await api.get(url);
      setData(response.data);
    } catch (error) {
      console.error("Error loading time machine data:", error);
      showAlert("Error", "Failed to load version history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId, selectedCategory]);

  useEffect(() => {
    loadTimeMachineData();
  }, [loadTimeMachineData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTimeMachineData();
  }, [loadTimeMachineData]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleFile = (fileId: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const formatFileSize = (size: string | null): string => {
    if (!size) return "Unknown size";
    const bytes = parseInt(size, 10);
    if (isNaN(bytes)) return size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  const downloadVersion = async (
    fileId: string,
    version: number,
    fileName: string,
  ) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const apiBaseUrl =
        config.apiBaseUrl.replace("/api", "") || "http://localhost:8000";
      const url = `${apiBaseUrl}/api/files/${fileId}/version/${version}/download?token=${token}`;

      if (Platform.OS === "web") {
        window.open(url, "_blank");
      } else {
        showAlert("Download Version", `Download ${fileName} version ${version}?`, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Download",
            onPress: () => {
              // For native, we'd use Linking or file download library
              import("expo-linking").then((Linking) => {
                Linking.openURL(url);
              });
            },
          },
        ]);
      }
    } catch (error) {
      console.error("Error downloading version:", error);
      showAlert("Error", "Failed to download version");
    }
  };

  const restoreVersion = async (
    fileId: string,
    version: number,
    fileName: string,
  ) => {
    showAlert(
      "Restore Version",
      `Restore ${fileName} to version ${version}? This will create a new version with the old content.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("authToken");
              const apiBaseUrl =
                config.apiBaseUrl.replace("/api", "") || "http://localhost:8000";

              const response = await fetch(
                `${apiBaseUrl}/api/files/${fileId}/restore/${version}`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                },
              );

              if (!response.ok) {
                throw new Error("Failed to restore version");
              }

              showAlert("Success", `Restored ${fileName} to version ${version}`);
              loadTimeMachineData();
            } catch (error) {
              console.error("Error restoring version:", error);
              showAlert("Error", "Failed to restore version");
            }
          },
        },
      ],
    );
  };

  const renderCategoryFilter = () => {
    const categories = Object.keys(CATEGORY_INFO);

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text
            style={[
              styles.filterChipText,
              !selectedCategory && styles.filterChipTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {categories.map((cat) => {
          const info = CATEGORY_INFO[cat];
          const count = data?.categories[cat]?.length || 0;
          if (count === 0 && selectedCategory !== cat) return null;

          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterChip,
                selectedCategory === cat && styles.filterChipActive,
              ]}
              onPress={() =>
                setSelectedCategory(cat === selectedCategory ? null : cat)
              }
            >
              <Text style={styles.filterChipIcon}>{info.icon}</Text>
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategory === cat && styles.filterChipTextActive,
                ]}
              >
                {info.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderFileVersions = (file: FileWithVersions) => {
    const isExpanded = expandedFiles.has(file.id);
    const info = CATEGORY_INFO[file.category] || CATEGORY_INFO.other;

    return (
      <View key={file.id} style={styles.fileCard}>
        <TouchableOpacity
          style={styles.fileHeader}
          onPress={() => toggleFile(file.id)}
        >
          <View style={styles.fileInfo}>
            <Text style={styles.fileIcon}>{info.icon}</Text>
            <View style={styles.fileDetails}>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <Text style={styles.fileMeta}>
                v{file.current_version} • {formatFileSize(file.size)} •{" "}
                {formatTimeAgo(file.updated_at)}
              </Text>
            </View>
          </View>
          <View style={styles.fileActions}>
            <View style={styles.versionBadge}>
              <Text style={styles.versionBadgeText}>
                {file.versions.length + 1} versions
              </Text>
            </View>
            <Text style={styles.expandIcon}>{isExpanded ? "▼" : "▶"}</Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.versionsContainer}>
            {/* Current version */}
            <View style={styles.versionItem}>
              <View style={styles.versionDot} />
              <View style={styles.versionInfo}>
                <View style={styles.versionHeader}>
                  <Text style={styles.versionLabel}>
                    Version {file.current_version}
                    <Text style={styles.currentVersionBadge}> (Current)</Text>
                  </Text>
                </View>
                <Text style={styles.versionMeta}>
                  {formatDate(file.updated_at)} • {formatFileSize(file.size)}
                </Text>
              </View>
            </View>

            {/* Previous versions */}
            {file.versions.map((version) => (
              <View key={version.id} style={styles.versionItem}>
                <View style={[styles.versionDot, styles.versionDotOld]} />
                <View style={styles.versionInfo}>
                  <View style={styles.versionHeader}>
                    <Text style={styles.versionLabel}>
                      Version {version.version}
                    </Text>
                    <View style={styles.versionActions}>
                      <TouchableOpacity
                        style={styles.versionActionButton}
                        onPress={() =>
                          downloadVersion(file.id, version.version, file.name)
                        }
                      >
                        <Text style={styles.versionActionText}>⬇️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.versionActionButton}
                        onPress={() =>
                          restoreVersion(file.id, version.version, file.name)
                        }
                      >
                        <Text style={styles.versionActionText}>↩️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.versionMeta}>
                    {formatDate(version.created_at)} • {formatFileSize(version.size)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderCategory = (category: string, files: FileWithVersions[]) => {
    if (files.length === 0) return null;

    const info = CATEGORY_INFO[category] || CATEGORY_INFO.other;
    const isExpanded = expandedCategories.has(category);
    const totalVersions = files.reduce((sum, f) => sum + f.versions.length + 1, 0);

    return (
      <View key={category} style={styles.categorySection}>
        <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => toggleCategory(category)}
        >
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryIcon}>{info.icon}</Text>
            <View>
              <Text style={styles.categoryLabel}>{info.label}</Text>
              <Text style={styles.categoryMeta}>
                {files.length} files • {totalVersions} total versions
              </Text>
            </View>
          </View>
          <Text style={styles.expandIcon}>{isExpanded ? "▼" : "▶"}</Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.categoryFiles}>{files.map(renderFileVersions)}</View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF2A2A" />
        <Text style={styles.loadingText}>Loading version history...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>⏰</Text>
        <Text style={styles.emptyTitle}>No version history</Text>
        <Text style={styles.emptySubtitle}>
          Upload and update files to start building version history
        </Text>
      </View>
    );
  }

  const categories = Object.entries(data.categories);

  // Project screen uses an absolute bottom tab bar on Android (height 84).
  // Add enough padding so the last items don't end up behind it.
  const bottomPadding =
    (Platform.OS === "android" ? 84 : 0) + (insets.bottom || 0) + 16;

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.statsHeader}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{data.total_files}</Text>
          <Text style={styles.statLabel}>Files</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{data.total_versions}</Text>
          <Text style={styles.statLabel}>Total Versions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{categories.length}</Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
      </View>

      {/* Category Filter */}
      {renderCategoryFilter()}

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPadding },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF2A2A"
          />
        }
      >
        {categories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text style={styles.emptyTitle}>No files found</Text>
            <Text style={styles.emptySubtitle}>Upload files to see them here</Text>
          </View>
        ) : (
          categories.map(([category, files]) => renderCategory(category, files))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0A0A0A",
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    color: "#9A9A9A",
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9A9A9A",
    textAlign: "center",
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FF2A2A",
  },
  statLabel: {
    fontSize: 12,
    color: "#9A9A9A",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#2A2A2A",
  },
  filterContainer: {
    backgroundColor: "#1A1A1A",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
    flexGrow: 0,
    flexShrink: 0,
    height: 56,
  },
  filterContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2A2A2A",
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  filterChipActive: {
    backgroundColor: "#FF2A2A",
    borderColor: "#FF2A2A",
  },
  filterChipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  filterChipText: {
    fontSize: 13,
    color: "#9A9A9A",
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "#F5F5F5",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  categorySection: {
    marginBottom: 16,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  categoryInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F5F5F5",
  },
  categoryMeta: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  expandIcon: {
    fontSize: 12,
    color: "#666",
  },
  categoryFiles: {
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
  },
  fileCard: {
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  fileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    paddingLeft: 16,
  },
  fileInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  fileIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#F5F5F5",
  },
  fileMeta: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  fileActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  versionBadge: {
    backgroundColor: "#2A2A2A",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 8,
  },
  versionBadgeText: {
    fontSize: 10,
    color: "#9A9A9A",
  },
  versionsContainer: {
    backgroundColor: "#0E0E0E",
    paddingVertical: 8,
    paddingLeft: 32,
    paddingRight: 12,
  },
  versionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  versionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF2A2A",
    marginTop: 6,
    marginRight: 12,
  },
  versionDotOld: {
    backgroundColor: "#666",
  },
  versionInfo: {
    flex: 1,
  },
  versionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  versionLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#F5F5F5",
  },
  currentVersionBadge: {
    color: "#FF2A2A",
    fontWeight: "600",
  },
  versionMeta: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  versionActions: {
    flexDirection: "row",
  },
  versionActionButton: {
    padding: 4,
    marginLeft: 8,
  },
  versionActionText: {
    fontSize: 16,
  },
});

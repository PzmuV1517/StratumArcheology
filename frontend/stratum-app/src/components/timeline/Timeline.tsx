/**
 * @file
 * Project activity timeline component.
 *
 * Displays a chronological list of project activities
 * with user attribution and activity type icons.
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
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Platform,
} from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useActivity } from "../../hooks";
import { activityService, ProjectActivity, authService } from "../../services";
import { Loading, Card } from "../common";

type TimelineMode = "project" | "personal";
type ActivityFilter = "all" | "files" | "notes" | "members" | "forms" | "gps";

interface TimelineProps {
  projectId: string;
  maxHeight?: number;
  onActivityPress?: (activity: ProjectActivity) => void;
}

/**
 * Timeline component for displaying project activity
 * Works on both web and native platforms
 */
export default function Timeline({
  projectId,
  maxHeight,
  onActivityPress,
}: TimelineProps) {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const searchPlaceholderColor = isDarkMode ? "#666666" : "#7A7A7A";
  const [mode, setMode] = useState<TimelineMode>("project");
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { activities, isLoading, hasMore, loadMore, refresh, error } = useActivity(
    projectId,
    mode === "personal",
  );

  // Filter activities by search query and category filter
  const filteredActivities = useMemo(() => {
    let filtered = activities;

    // Apply category filter
    if (activeFilter !== "all") {
      const filterMap: Record<ActivityFilter, string[]> = {
        all: [],
        files: [
          "file_uploaded",
          "file_updated",
          "file_deleted",
          "file_moved",
          "file_renamed",
          "folder_created",
          "folder_deleted",
        ],
        notes: [
          "note_created",
          "note_updated",
          "note_deleted",
          "note_attachment_added",
          "note_attachment_deleted",
        ],
        members: [
          "member_joined",
          "member_left",
          "member_role_changed",
          "ownership_transferred",
        ],
        forms: [
          "context_feature_created",
          "context_feature_added",
          "stratigraphic_unit_created",
          "stratigraphic_unit_added",
          "artefact_created",
          "artefact_added",
        ],
        gps: ["gps_enabled", "gps_disabled", "gps_updated"],
      };
      const allowed = filterMap[activeFilter];
      if (allowed.length > 0) {
        filtered = filtered.filter((a) => allowed.includes(a.activity_type));
      }
    }

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((a) => {
        const desc = activityService
          .getActivityDescription(a, currentUserId)
          .toLowerCase();
        const userName = (a.user_name || "").toLowerCase();
        const extra = JSON.stringify(a.extra_data || {}).toLowerCase();
        return desc.includes(q) || userName.includes(q) || extra.includes(q);
      });
    }

    return filtered;
  }, [activities, activeFilter, searchQuery, currentUserId]);

  // Get current user ID for "You" display
  useEffect(() => {
    (async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user?.id) {
          setCurrentUserId(user.id);
        }
      } catch {
        // Ignore - will just show usernames instead of "You"
      }
    })();
  }, []);

  const renderActivity = ({
    item,
    index,
  }: {
    item: ProjectActivity;
    index: number;
  }) => {
    const icon = activityService.getActivityIcon(item.activity_type);
    const description = activityService.getActivityDescription(item, currentUserId);
    const timestamp = activityService.formatTimestamp(item.created_at);
    const color = activityService.getActivityColor(item.activity_type);
    const isLast = index === filteredActivities.length - 1;
    const isExpanded = expandedId === item.id;
    const extra = item.extra_data || {};

    return (
      <TouchableOpacity
        style={[styles.activityItem, isExpanded && styles.activityItemExpanded]}
        onPress={() => {
          setExpandedId(isExpanded ? null : item.id);
          onActivityPress?.(item);
        }}
        activeOpacity={0.7}
      >
        {/* Timeline connector */}
        <View style={styles.timelineConnector}>
          <View
            style={[styles.iconContainer, { borderColor: color, borderWidth: 2 }]}
          >
            <Text style={styles.icon}>{icon}</Text>
          </View>
          {!isLast && (
            <View style={[styles.line, { backgroundColor: color + "40" }]} />
          )}
        </View>

        {/* Activity content */}
        <View style={styles.content}>
          <Text
            style={styles.description}
            numberOfLines={isExpanded ? undefined : 2}
          >
            {description}
          </Text>
          <Text style={[styles.timestamp, { color }]}>{timestamp}</Text>

          {/* Expanded details */}
          {isExpanded && (
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Type</Text>
                <Text style={styles.detailValue}>
                  {item.activity_type.replace(/_/g, " ")}
                </Text>
              </View>
              {item.user_name && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>By</Text>
                  <Text style={styles.detailValue}>{item.user_name}</Text>
                </View>
              )}
              {extra.file_name && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>File</Text>
                  <Text style={[styles.detailValue, styles.detailLink]}>
                    {extra.file_name}
                  </Text>
                </View>
              )}
              {extra.folder_name && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Folder</Text>
                  <Text style={styles.detailValue}>{extra.folder_name}</Text>
                </View>
              )}
              {extra.note_title && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Note</Text>
                  <Text style={styles.detailValue}>{extra.note_title}</Text>
                </View>
              )}
              {extra.old_name && extra.new_name && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Renamed</Text>
                  <Text style={styles.detailValue}>
                    {extra.old_name} → {extra.new_name}
                  </Text>
                </View>
              )}
              <Text style={styles.detailTimestamp}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>TL</Text>
        <Text style={styles.emptyText}>No activity yet</Text>
        <Text style={styles.emptySubtext}>
          Activity will appear here as you and your team work on this project
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!hasMore || activities.length === 0) return null;

    return (
      <TouchableOpacity style={styles.loadMoreButton} onPress={loadMore}>
        <Text style={styles.loadMoreText}>Load more</Text>
      </TouchableOpacity>
    );
  };

  if (error) {
    return (
      <Card style={styles.errorCard}>
        <Text style={styles.errorText}>Failed to load activity</Text>
        <TouchableOpacity onPress={refresh}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </Card>
    );
  }

  const FILTER_OPTIONS: { key: ActivityFilter; label: string; icon: string }[] = [
    { key: "all", label: "All", icon: "A" },
    { key: "files", label: "Files", icon: "F" },
    { key: "notes", label: "Notes", icon: "N" },
    { key: "members", label: "Members", icon: "M" },
    { key: "forms", label: "Forms", icon: "R" },
    { key: "gps", label: "GPS", icon: "G" },
  ];

  return (
    <View style={[styles.container, maxHeight ? { maxHeight } : undefined]}>
      {/* Toggle between Project and Personal timeline */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            mode === "project" && styles.toggleButtonActive,
          ]}
          onPress={() => setMode("project")}
        >
          <Text
            style={[
              styles.toggleText,
              mode === "project" && styles.toggleTextActive,
            ]}
          >
            All Activity
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            mode === "personal" && styles.toggleButtonActive,
          ]}
          onPress={() => setMode("personal")}
        >
          <Text
            style={[
              styles.toggleText,
              mode === "personal" && styles.toggleTextActive,
            ]}
          >
            My Activity
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search activity..."
          placeholderTextColor={searchPlaceholderColor}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.searchClear}
            onPress={() => setSearchQuery("")}
          >
            <Text style={styles.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        {FILTER_OPTIONS.map((f) => (
          <TouchableOpacity
            key={f.key}
            activeOpacity={0.7}
            style={[
              styles.filterChip,
              activeFilter === f.key && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(f.key === activeFilter ? "all" : f.key)}
          >
            <Text style={styles.filterChipIcon}>{f.icon}</Text>
            <Text
              style={[
                styles.filterChipText,
                activeFilter === f.key && styles.filterChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={Platform.OS === "web"}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && activities.length > 0}
            onRefresh={refresh}
            tintColor="#FF2A2A"
            colors={["#FF2A2A"]}
          />
        }
        contentContainerStyle={
          filteredActivities.length === 0 ? styles.emptyList : undefined
        }
      >
        {isLoading && activities.length === 0 ? (
          <Loading message="Loading activity..." />
        ) : filteredActivities.length === 0 ? (
          renderEmpty()
        ) : (
          <>
            {filteredActivities.map((item, index) => (
              <View key={item.id.toString()}>{renderActivity({ item, index })}</View>
            ))}
            {renderFooter()}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (isDarkMode: boolean) => {
  const palette = {
    pageBackground: isDarkMode ? "#0C0C0E" : "#F7F7F7",
    surface: isDarkMode ? "#1C1C1E" : "#FFFFFF",
    surfaceAlt: isDarkMode ? "#222224" : "#F1F1F1",
    surfaceStrong: isDarkMode ? "#2C2C2E" : "#E8E8E8",
    border: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    borderStrong: isDarkMode ? "#3A3A3A" : "#C9C9C9",
    textPrimary: isDarkMode ? "#FFFFFF" : "#1A1A1A",
    textSecondary: isDarkMode ? "#8E8E93" : "#666666",
    textTertiary: isDarkMode ? "#666666" : "#7A7A7A",
    textQuaternary: isDarkMode ? "#555555" : "#8A8A8A",
  };

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.pageBackground,
      borderRadius: 16,
      overflow: "hidden",
    },
    toggleContainer: {
      flexDirection: "row",
      backgroundColor: palette.surface,
      borderRadius: 8,
      padding: 3,
      marginHorizontal: 16,
      marginVertical: 8,
      height: 36,
    },
    toggleButton: {
      flex: 1,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      height: 30,
    },
    toggleButtonActive: {
      backgroundColor: "#FF2A2A",
    },
    toggleText: {
      fontSize: 12,
      fontWeight: "600",
      color: palette.textSecondary,
    },
    toggleTextActive: {
      color: "#FFFFFF",
    },
    emptyList: {
      flexGrow: 1,
    },
    activityItem: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginHorizontal: 16,
      marginVertical: 4,
      backgroundColor: palette.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.border,
    },
    activityItemExpanded: {
      borderColor: palette.borderStrong,
      backgroundColor: palette.surfaceAlt,
    },
    timelineConnector: {
      width: 40,
      alignItems: "center",
    },
    iconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: palette.surfaceStrong,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    },
    icon: {
      fontSize: 16,
    },
    line: {
      position: "absolute",
      top: 32,
      bottom: -16,
      width: 2,
      backgroundColor: palette.surfaceStrong,
      left: 19,
      display: "none",
    },
    content: {
      flex: 1,
      paddingLeft: 12,
      paddingTop: 4,
    },
    description: {
      fontSize: 14,
      color: palette.textPrimary,
      lineHeight: 20,
    },
    timestamp: {
      fontSize: 12,
      color: palette.textSecondary,
      marginTop: 4,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 17,
      fontWeight: "600",
      color: palette.textPrimary,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: palette.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    loadMoreButton: {
      alignItems: "center",
      padding: 16,
    },
    loadMoreText: {
      fontSize: 14,
      color: "#007AFF",
      fontWeight: "500",
    },
    errorCard: {
      margin: 16,
      alignItems: "center",
    },
    errorText: {
      fontSize: 14,
      color: "#FF3B30",
      marginBottom: 8,
    },
    retryText: {
      fontSize: 14,
      color: "#007AFF",
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginVertical: 6,
      backgroundColor: palette.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.border,
    },
    searchInput: {
      flex: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: palette.textPrimary,
    },
    searchClear: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    searchClearText: {
      color: palette.textTertiary,
      fontSize: 14,
    },
    filterBar: {
      minHeight: 52,
      marginBottom: 8,
    },
    filterBarContent: {
      paddingHorizontal: 16,
      gap: 10,
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.surface,
      paddingHorizontal: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.border,
      height: 36,
      minWidth: 60,
    },
    filterChipActive: {
      backgroundColor: "#FF2A2A",
      borderColor: "#FF2A2A",
    },
    filterChipIcon: {
      fontSize: 12,
      marginRight: 4,
      fontWeight: "700",
      color: palette.textSecondary,
    },
    filterChipText: {
      fontSize: 12,
      color: palette.textSecondary,
      fontWeight: "500",
    },
    filterChipTextActive: {
      color: "#FFFFFF",
    },
    detailsContainer: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: palette.borderStrong,
    },
    detailRow: {
      flexDirection: "row",
      marginBottom: 6,
    },
    detailLabel: {
      fontSize: 12,
      color: palette.textTertiary,
      fontWeight: "600",
      width: 70,
    },
    detailValue: {
      fontSize: 12,
      color: isDarkMode ? "#CFCFCF" : "#4D4D4D",
      flex: 1,
    },
    detailLink: {
      color: "#FF2A2A",
    },
    detailTimestamp: {
      fontSize: 11,
      color: palette.textQuaternary,
      marginTop: 4,
      fontStyle: "italic",
    },
  });
};

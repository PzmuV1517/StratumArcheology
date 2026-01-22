import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useActivity } from "../../hooks";
import { activityService, ProjectActivity, authService } from "../../services";
import { Loading, Card } from "../common";

type TimelineMode = "project" | "personal";

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
  const [mode, setMode] = useState<TimelineMode>("project");
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const { activities, isLoading, hasMore, loadMore, refresh, error } = useActivity(
    projectId,
    mode === "personal",
  );

  // Get current user ID for "You" display
  useEffect(() => {
    (async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user?.id) {
          setCurrentUserId(user.id);
        }
      } catch (e) {
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
    const isLast = index === activities.length - 1;

    return (
      <TouchableOpacity
        style={styles.activityItem}
        onPress={() => onActivityPress?.(item)}
        activeOpacity={onActivityPress ? 0.7 : 1}
        disabled={!onActivityPress}
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
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
          <Text style={[styles.timestamp, { color }]}>{timestamp}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
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

      <ScrollView
        showsVerticalScrollIndicator={Platform.OS === "web"}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && activities.length > 0}
            onRefresh={refresh}
            tintColor="#007AFF"
            colors={["#007AFF"]}
          />
        }
        contentContainerStyle={
          activities.length === 0 ? styles.emptyList : undefined
        }
      >
        {isLoading && activities.length === 0 ? (
          <Loading message="Loading activity..." />
        ) : activities.length === 0 ? (
          renderEmpty()
        ) : (
          <>
            {activities.map((item, index) => (
              <View key={item.id.toString()}>{renderActivity({ item, index })}</View>
            ))}
            {renderFooter()}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0C0C0E",
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#1C1C1E",
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
    backgroundColor: "#C41E3A",
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
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
    paddingVertical: 8,
  },
  timelineConnector: {
    width: 40,
    alignItems: "center",
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2C2C2E",
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
    bottom: -8,
    width: 2,
    backgroundColor: "#3C3C3E",
    left: 19,
  },
  content: {
    flex: 1,
    paddingLeft: 12,
    paddingTop: 4,
  },
  description: {
    fontSize: 14,
    color: "#FFFFFF",
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 12,
    color: "#8E8E93",
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
    color: "#FFFFFF",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#8E8E93",
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
});

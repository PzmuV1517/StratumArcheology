/**
 * @file
 * Messages tab — DM conversation list (Slack-style inbox).
 *
 * Shows all direct-message conversations the user has,
 * ordered by most recent. Tapping opens the DM thread.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { chatService } from "@/services/chatService";
import type { ConversationPreview } from "@/services/chatService.types";

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessagesScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await chatService.getConversations();
    setConversations(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const renderItem = ({ item }: { item: ConversationPreview }) => {
    const initial = (item.other_user_name ?? "?")[0].toUpperCase();
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => router.push(`/(tabs)/dm/${item.other_user_id}` as any)}
      >
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.other_user_name ?? "Unknown"}
            </Text>
            <Text style={styles.time}>{formatRelative(item.last_message_at)}</Text>
          </View>
          <Text style={styles.preview} numberOfLines={1}>
            {item.last_message}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>Direct messages with team members</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Loading…</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            Start a direct message from a project member's profile.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.other_user_id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF2A2A"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "web" ? 8 : 60,
    paddingBottom: 16,
    backgroundColor: "#111111",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#F5F5F5",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#9A9A9A",
    marginTop: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    color: "#F5F5F5",
    fontSize: 18,
    fontWeight: "600",
  },
  rowContent: {
    flex: 1,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F5F5F5",
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 13,
    color: "#9A9A9A",
  },
  preview: {
    fontSize: 14,
    color: "#9A9A9A",
    lineHeight: 18,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#9A9A9A",
    textAlign: "center",
    lineHeight: 20,
  },
});

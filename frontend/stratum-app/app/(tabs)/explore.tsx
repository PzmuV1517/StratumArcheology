/**
 * @file
 * Unearthed tab screen.
 *
 * Browse publicly visible archaeological projects and search for
 * users by name or @username.
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
import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { projectService } from "@/services/projectService";
import type { Project } from "@/services/projectService.types";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchedUser {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  photo_url: string | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function UnearthedScreen() {
  const [popularProjects, setPopularProjects] = useState<Project[]>([]);
  const [searchedProjects, setSearchedProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedUsers, setSearchedUsers] = useState<SearchedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const pageBackground = isDarkMode ? "#111111" : "#F7F7F7";
  const surfaceBackground = isDarkMode ? "#1A1A1A" : "#FFFFFF";
  const borderColor = isDarkMode ? "#2A2A2A" : "#D9D9D9";
  const textPrimary = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const textSecondary = isDarkMode ? "#9A9A9A" : "#666666";
  const avatarPlaceholder = isDarkMode ? "#2A2A2A" : "#E3E3E3";
  const coverGradient = isDarkMode
    ? [
        "#1A1A1A",
        "rgba(26,26,26,0.92)",
        "rgba(26,26,26,0.5)",
        "rgba(26,26,26,0.15)",
        "transparent",
      ]
    : [
        "#FFFFFF",
        "rgba(255,255,255,0.9)",
        "rgba(255,255,255,0.55)",
        "rgba(255,255,255,0.2)",
        "transparent",
      ];

  const isSearching = searchQuery.trim().length >= 3;

  // ─── Data fetching ──────────────────────────────────────────────────────

  const loadPopularProjects = useCallback(async () => {
    try {
      const projects = await projectService.getPublicProjects();
      setPopularProjects(projects);
    } catch (error) {
      console.error("Failed to load public projects:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPopularProjects();
    }, [loadPopularProjects]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (isSearching) {
      // Re-run current search on pull-to-refresh
      const trimmed = searchQuery.trim();
      Promise.all([
        projectService.getPublicProjects(trimmed),
        projectService.searchUsers(trimmed),
      ])
        .then(([projects, users]) => {
          setSearchedProjects(projects);
          setSearchedUsers(users);
        })
        .catch((err) => console.error("Refresh failed:", err))
        .finally(() => setRefreshing(false));
    } else {
      loadPopularProjects();
    }
  }, [isSearching, searchQuery, loadPopularProjects]);

  // ─── Unified search with debounce ───────────────────────────────────────

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setSearchedProjects([]);
      setSearchedUsers([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const [projects, users] = await Promise.all([
          projectService.getPublicProjects(trimmed),
          projectService.searchUsers(trimmed),
        ]);
        setSearchedProjects(projects);
        setSearchedUsers(users);
      } catch (error) {
        console.error("Search failed:", error);
        setSearchedProjects([]);
        setSearchedUsers([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchedProjects([]);
    setSearchedUsers([]);
  }, []);

  // ─── Render helpers ─────────────────────────────────────────────────────

  const renderProjectCard = (project: Project) => {
    const memberCount = (project as Project & { member_count?: number })
      .member_count;
    return (
      <TouchableOpacity
        key={project.id}
        style={[
          styles.projectCard,
          { backgroundColor: surfaceBackground, borderColor },
        ]}
        onPress={() => router.push(`/public-project/${project.id}`)}
        activeOpacity={0.7}
      >
        {project.cover_image_url && (
          <View style={styles.coverImageWrapper}>
            <Image
              source={{ uri: project.cover_image_url }}
              style={styles.coverImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={coverGradient}
              locations={[0, 0.2, 0.35, 0.45, 0.6]}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        )}
        <View style={styles.cardTextContent}>
          <Text
            style={[styles.projectName, { color: textPrimary }]}
            numberOfLines={1}
          >
            {project.name}
          </Text>
          <Text
            style={[styles.projectDescription, { color: textSecondary }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {project.description || "No description"}
          </Text>
          <View style={styles.projectMeta}>
            <Text style={[styles.dateText, { color: textSecondary }]}>
              Updated{" "}
              {project.updated_at
                ? new Date(project.updated_at).toLocaleDateString()
                : "—"}
            </Text>
            {memberCount != null && memberCount > 0 && (
              <View style={styles.memberBadge}>
                <IconSymbol name="person.2.fill" size={12} color={textSecondary} />
                <Text style={[styles.memberCount, { color: textSecondary }]}>
                  {memberCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderUserRow = (user: SearchedUser) => (
    <TouchableOpacity
      key={user.id}
      style={[styles.userRow, { backgroundColor: surfaceBackground, borderColor }]}
      onPress={() => router.push(`/profile/${user.id}`)}
      activeOpacity={0.7}
    >
      {user.photo_url ? (
        <Image source={{ uri: user.photo_url }} style={styles.avatar} />
      ) : (
        <View
          style={[
            styles.avatar,
            styles.avatarPlaceholder,
            { backgroundColor: avatarPlaceholder },
          ]}
        >
          <Text style={[styles.avatarLetter, { color: textPrimary }]}>
            {(user.display_name || user.email).charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: textPrimary }]} numberOfLines={1}>
          {user.display_name || user.email}
        </Text>
        {user.username && (
          <Text
            style={[styles.userHandle, { color: textSecondary }]}
            numberOfLines={1}
          >
            @{user.username}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  // ─── Search results view ────────────────────────────────────────────────

  const renderSearchResults = () => {
    if (searching) {
      return (
        <ActivityIndicator size="small" color="#FF2A2A" style={{ marginTop: 24 }} />
      );
    }

    const noResults = searchedProjects.length === 0 && searchedUsers.length === 0;

    if (noResults) {
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>No results</Text>
          <Text style={[styles.emptySubtext, { color: textSecondary }]}>
            Nothing found matching &quot;{searchQuery.trim()}&quot;
          </Text>
        </View>
      );
    }

    return (
      <>
        {searchedProjects.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Projects</Text>
            {searchedProjects.map(renderProjectCard)}
          </>
        )}
        {searchedUsers.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>People</Text>
            {searchedUsers.map(renderUserRow)}
          </>
        )}
      </>
    );
  };

  // ─── Main render ────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: pageBackground }]}>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Unearthed</Text>
        <Text style={[styles.headerSubtitle, { color: textSecondary }]}>
          Discover public projects &amp; find researchers
        </Text>
      </View>

      {/* Unified search bar */}
      <View
        style={[
          styles.searchInputWrapper,
          { backgroundColor: surfaceBackground, borderColor },
        ]}
      >
        <IconSymbol
          name="magnifyingglass"
          size={18}
          color={textSecondary}
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={[styles.searchInput, { color: textPrimary }]}
          placeholder="Search projects or people..."
          placeholderTextColor={textSecondary}
          value={searchQuery}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={clearSearch}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.clearButton, { color: textSecondary }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF2A2A"
            colors={["#FF2A2A"]}
          />
        }
      >
        {isSearching ? (
          renderSearchResults()
        ) : loading ? (
          <ActivityIndicator
            size="large"
            color="#FF2A2A"
            style={{ marginTop: 40 }}
          />
        ) : popularProjects.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="cube.fill" size={48} color={textSecondary} />
            <Text style={[styles.emptyTitle, { color: textPrimary }]}>
              No public projects yet
            </Text>
            <Text style={[styles.emptySubtext, { color: textSecondary }]}>
              When project owners publicise their excavations, they will appear here
              for everyone to explore.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: textSecondary }]}>
              Popular
            </Text>
            {popularProjects.map(renderProjectCard)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: Platform.OS === "web" ? 8 : 60,
      paddingBottom: 16,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      letterSpacing: 0.5,
    },
    headerSubtitle: {
      fontSize: 15,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginTop: 6,
    },

    /* ── Search bar ─────────────────────────────────── */
    searchInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 10,
      marginHorizontal: 24,
      marginBottom: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    searchInput: {
      flex: 1,
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 15,
      paddingVertical: 12,
    },
    clearButton: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontSize: 16,
      paddingLeft: 8,
    },

    /* ── Section titles ─────────────────────────────── */
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: isDarkMode ? "#9A9A9A" : "#666666",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 12,
      marginTop: 8,
    },

    /* ── Scroll / content ──────────────────────────── */
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 40,
    },

    /* ── Project cards ─────────────────────────────── */
    projectCard: {
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDarkMode ? 0.4 : 0.14,
      shadowRadius: 20,
      elevation: 8,
      overflow: "hidden",
    },
    coverImageWrapper: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
      alignItems: "flex-end",
    },
    coverImage: {
      width: "100%",
      height: "100%",
      position: "absolute",
      right: 0,
      top: 0,
    },
    cardTextContent: {
      padding: 16,
    },
    projectName: {
      fontSize: 18,
      fontWeight: "600",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 8,
      letterSpacing: 0.5,
    },
    projectDescription: {
      fontSize: 14,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginBottom: 12,
      lineHeight: 20,
    },
    projectMeta: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 8,
    },
    dateText: {
      fontSize: 12,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      letterSpacing: 0.5,
    },
    memberBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    memberCount: {
      fontSize: 12,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontWeight: "600",
    },

    /* ── User rows ─────────────────────────────────── */
    userRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: 12,
    },
    avatarPlaceholder: {
      backgroundColor: isDarkMode ? "#2A2A2A" : "#E3E3E3",
      justifyContent: "center",
      alignItems: "center",
    },
    avatarLetter: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 18,
      fontWeight: "700",
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 16,
      fontWeight: "600",
    },
    userHandle: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontSize: 13,
      marginTop: 2,
    },

    /* ── Empty states ──────────────────────────────── */
    emptyState: {
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: 32,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginTop: 16,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      textAlign: "center",
      lineHeight: 20,
    },
  });

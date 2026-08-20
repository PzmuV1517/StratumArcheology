/**
 * @file
 * Public-facing profile view screen.
 *
 * Displays a user's profile (banner, avatar, name, username,
 * description, social links, timezone/local time, projects).
 * Accessible by clicking on a user's name or avatar in chat.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface ProfileUser {
  id: number;
  email: string;
  display_name: string;
  username: string | null;
  photo_url: string | null;
  banner_url: string | null;
  description: string | null;
  phone: string | null;
  timezone: string | null;
  show_projects: boolean;
  link_x: string | null;
  link_discord: string | null;
  link_bsky: string | null;
  link_linkedin: string | null;
  link_website: string | null;
}

const SOCIAL_LINKS = [
  { key: "link_x" as const, label: "X (Twitter)", icon: "𝕏" },
  { key: "link_discord" as const, label: "Discord", icon: "💬" },
  { key: "link_bsky" as const, label: "Bluesky", icon: "🦋" },
  { key: "link_linkedin" as const, label: "LinkedIn", icon: "in" },
  { key: "link_website" as const, label: "Website", icon: "🌐" },
];

export default function ProfileViewScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile =
    currentUser && profile && String(currentUser.id) === String(profile.id);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data } = await api.get(`/auth/users/${userId}`);
        setProfile(data);
      } catch (e: any) {
        setError(e?.response?.data?.detail || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  /** Compute the user's local time if timezone is set */
  const localTime = useMemo(() => {
    if (!profile?.timezone) return null;
    try {
      return new Date().toLocaleTimeString("en-US", {
        timeZone: profile.timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return null;
    }
  }, [profile?.timezone]);

  const openLink = (url: string) => {
    if (url.startsWith("http")) {
      Linking.openURL(url);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#FF2A2A" size="large" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>{error || "User not found"}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasSocials = SOCIAL_LINKS.some(({ key }) => profile[key]);

  return (
    <View style={styles.container}>
      {/* Back button */}
      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
          <Text style={styles.backArrowText}>← Back</Text>
        </TouchableOpacity>
        {isOwnProfile && (
          <TouchableOpacity onPress={() => router.push("/settings")}>
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {profile.banner_url ? (
          <Image source={{ uri: profile.banner_url }} style={styles.banner} />
        ) : (
          <View style={styles.bannerPlaceholder} />
        )}

        {/* Avatar + name */}
        <View style={styles.avatarRow}>
          {profile.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>
                {profile.display_name?.charAt(0).toUpperCase() || "?"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.nameSection}>
          <Text style={styles.displayName}>{profile.display_name}</Text>
          {profile.username && (
            <Text style={styles.username}>@{profile.username}</Text>
          )}
        </View>

        {/* Timezone / local time */}
        {profile.timezone && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🕐 Local time</Text>
            <Text style={styles.infoValue}>
              {localTime || "-"} ({profile.timezone})
            </Text>
          </View>
        )}

        {profile.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.descriptionText}>{profile.description}</Text>
          </View>
        ) : null}

        {/* Social links */}
        {hasSocials && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Links</Text>
            {SOCIAL_LINKS.map(({ key, label, icon }) => {
              const val = profile[key];
              if (!val) return null;
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.socialRow}
                  onPress={() => openLink(val)}
                  activeOpacity={val.startsWith("http") ? 0.6 : 1}
                >
                  <Text style={styles.socialIcon}>{icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.socialLabel}>{label}</Text>
                    <Text style={styles.socialValue} numberOfLines={1}>
                      {val}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {profile.phone ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <Text style={styles.fieldValue}>{profile.phone}</Text>
          </View>
        ) : null}

        {/* DM button (for other users) */}
        {!isOwnProfile && (
          <TouchableOpacity
            style={styles.dmButton}
            onPress={() =>
              router.push({
                pathname: "/dm/[userId]" as any,
                params: { userId: String(profile.id) },
              })
            }
          >
            <Text style={styles.dmButtonText}>Send Message</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: isDarkMode ? "#111111" : "#F7F7F7" },
    center: { justifyContent: "center", alignItems: "center" },

    topBar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 8,
      backgroundColor: isDarkMode ? "rgba(17,17,17,0.7)" : "rgba(247,247,247,0.9)",
      borderBottomWidth: isDarkMode ? 0 : StyleSheet.hairlineWidth,
      borderBottomColor: isDarkMode ? "transparent" : "#D9D9D9",
    },
    backArrow: { paddingVertical: 8 },
    backArrowText: { color: "#007AFF", fontSize: 16, fontWeight: "600" },
    editLink: { color: "#007AFF", fontSize: 16, fontWeight: "600" },

    banner: { width: "100%", height: 160, resizeMode: "cover" },
    bannerPlaceholder: {
      width: "100%",
      height: 160,
      backgroundColor: isDarkMode ? "#1E1E1E" : "#E6E6E6",
    },

    avatarRow: { paddingHorizontal: 24, marginTop: -44 },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 4,
      borderColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    avatarFallback: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: "#FF2A2A",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 4,
      borderColor: isDarkMode ? "#111111" : "#F7F7F7",
    },
    avatarText: {
      fontSize: 36,
      color: isDarkMode ? "#F5F5F5" : "#FFFFFF",
      fontWeight: "700",
    },

    nameSection: { paddingHorizontal: 24, paddingTop: 12 },
    displayName: {
      fontSize: 24,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
    },
    username: {
      fontSize: 15,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginTop: 2,
    },

    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 24,
      marginTop: 16,
    },
    infoLabel: { fontSize: 14, color: isDarkMode ? "#9A9A9A" : "#666666" },
    infoValue: { fontSize: 14, color: isDarkMode ? "#CCCCCC" : "#4D4D4D" },

    section: { paddingHorizontal: 24, marginTop: 24 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: isDarkMode ? "#9A9A9A" : "#666666",
      marginBottom: 10,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    descriptionText: {
      fontSize: 15,
      color: isDarkMode ? "#E0E0E0" : "#2E2E2E",
      lineHeight: 22,
    },
    fieldValue: { fontSize: 15, color: isDarkMode ? "#CCCCCC" : "#4D4D4D" },

    socialRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? "#1A1A1A" : "#D9D9D9",
    },
    socialIcon: { fontSize: 18, width: 28, textAlign: "center" },
    socialLabel: { fontSize: 13, color: isDarkMode ? "#9A9A9A" : "#666666" },
    socialValue: { fontSize: 14, color: "#007AFF", marginTop: 2 },

    dmButton: {
      backgroundColor: "#007AFF",
      padding: 16,
      borderRadius: 16,
      alignItems: "center",
      marginTop: 32,
      marginHorizontal: 24,
    },
    dmButtonText: {
      color: isDarkMode ? "#F5F5F5" : "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
    },

    errorText: { color: "#FF4444", fontSize: 16, marginBottom: 16 },
    backBtn: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: isDarkMode ? "#2A2A2A" : "#EFEFEF",
      borderWidth: 1,
      borderColor: isDarkMode ? "#333333" : "#D9D9D9",
    },
    backBtnText: { color: isDarkMode ? "#F5F5F5" : "#1A1A1A", fontSize: 14 },
  });

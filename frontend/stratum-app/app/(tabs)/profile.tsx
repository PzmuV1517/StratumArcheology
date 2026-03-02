/**
 * @file
 * Profile tab screen.
 *
 * Full profile editing with banner, avatar, description,
 * social links, timezone, and project visibility settings.
 *
 * MIT License
 *
 * Copyright (c) 2026 Andrei Banu & Levin Mircea
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Image,
  Platform,
  Switch,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../src/services/api";
import { config } from "../../src/config/config";
import { showAlert } from "../../src/utils/alert";
import { ConflictResolutionModal } from "../../src/components/sync/ConflictResolutionModal";
import type { FileConflict } from "../../src/services/offlineQueueService";
import * as ImagePicker from "expo-image-picker";

/* ── Social link definitions ──────────────────────────── */
const SOCIAL_LINKS = [
  { key: "link_x", label: "X (Twitter)", placeholder: "https://x.com/handle" },
  { key: "link_discord", label: "Discord", placeholder: "username#0000 or invite link" },
  { key: "link_bsky", label: "Bluesky", placeholder: "https://bsky.app/profile/handle" },
  { key: "link_linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/..." },
  { key: "link_website", label: "Website", placeholder: "https://yoursite.com" },
] as const;

type SocialKey = (typeof SOCIAL_LINKS)[number]["key"];

/* ── Timezone options ─────────────────────────────────── */
const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "Europe/Bucharest", "Europe/Moscow", "Asia/Tokyo", "Asia/Shanghai",
  "Asia/Kolkata", "Australia/Sydney",
];

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();

  /* ── Logout / UI state ──────────────────────────────── */
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  /* ── Dev modal ───────────────────────────────────────── */
  const [showDevModal, setShowDevModal] = useState(false);
  const [apiInput, setApiInput] = useState("");
  const [effectiveApi, setEffectiveApi] = useState("");
  const [savingApi, setSavingApi] = useState(false);
  const [showConflictTest, setShowConflictTest] = useState(false);

  /* ── Profile editing state ──────────────────────────── */
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("");
  const [showProjects, setShowProjects] = useState(true);
  const [socials, setSocials] = useState<Record<SocialKey, string>>({
    link_x: "",
    link_discord: "",
    link_bsky: "",
    link_linkedin: "",
    link_website: "",
  });

  /* ── Timezone picker ────────────────────────────────── */
  const [showTzPicker, setShowTzPicker] = useState(false);

  /* ── Sync from user ─────────────────────────────────── */
  const resetForm = useCallback(() => {
    if (!user) return;
    setDisplayName(user.display_name || "");
    setUsername(user.username || "");
    setDescription(user.description || "");
    setPhone(user.phone || "");
    setTimezone(user.timezone || "");
    setShowProjects(user.show_projects !== false);
    setSocials({
      link_x: user.link_x || "",
      link_discord: user.link_discord || "",
      link_bsky: user.link_bsky || "",
      link_linkedin: user.link_linkedin || "",
      link_website: user.link_website || "",
    });
  }, [user]);

  useEffect(() => { resetForm(); }, [resetForm]);

  useEffect(() => {
    (async () => {
      const override = await AsyncStorage.getItem("apiBaseUrlOverride");
      const current = override || config.apiBaseUrl;
      setEffectiveApi(current);
      setApiInput(current);
      if (override) api.defaults.baseURL = override;
    })();
  }, []);

  /* ── Image picker ───────────────────────────────────── */
  const pickImage = async (type: "avatar" | "banner") => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === "avatar" ? [1, 1] : [16, 5],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    // Upload to backend
    const form = new FormData();
    form.append("file", { uri, name: `${type}.jpg`, type: "image/jpeg" } as any);
    try {
      const field = type === "avatar" ? "photo_url" : "banner_url";
      const { data } = await api.post("/files/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await api.patch("/auth/me", { [field]: data.url || data.file_url });
      await refreshUser();
    } catch (e: any) {
      showAlert("Upload failed", e?.response?.data?.detail || "Could not upload image");
    }
  };

  /* ── Save profile ───────────────────────────────────── */
  const handleSave = async () => {
    if (username.length > 0 && username.length < 3) {
      showAlert("Invalid username", "Username must be at least 3 characters");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, any> = {
        display_name: displayName,
        description,
        phone,
        timezone,
        show_projects: showProjects,
        ...socials,
      };
      if (username) body.username = username;
      await api.patch("/auth/me", body);
      await refreshUser();
      setEditing(false);
    } catch (e: any) {
      showAlert("Save failed", e?.response?.data?.detail || "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  /* ── Logout ─────────────────────────────────────────── */
  const performLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      router.replace("/(auth)/login");
    } catch (e) {
      console.error("Logout failed:", e);
    } finally {
      setIsLoggingOut(false);
    }
  };

  /* ── About / Help ───────────────────────────────────── */
  const handleHelpSupport = () => {
    showAlert(
      "Help & Support",
      "Need help?\n\n• Email: support@stratum.app\n• Documentation: docs.stratum.app\n• Community Forum: forum.stratum.app",
      [{ text: "OK", style: "default" }],
    );
  };

  const handleAbout = () => {
    showAlert(
      "About STRATUM",
      "STRATUM v1.0.0\n\nArchaeological Site Documentation & Collaboration Platform\n\nBuilt for FLL 2025-2026 UNEARTHED Challenge\n\n© 2026 Andrei Banu & Levin Mircea",
      [{ text: "OK", style: "default" }],
    );
  };

  /* ── Dev modal helpers ──────────────────────────────── */
  const openDevModal = async () => {
    try {
      const override = await AsyncStorage.getItem("apiBaseUrlOverride");
      const current = override || config.apiBaseUrl;
      setApiInput(current);
      setShowDevModal(true);
    } catch {
      setApiInput(config.apiBaseUrl);
      setShowDevModal(true);
    }
  };
  const validateUrl = (url: string) => /^https?:\/\//i.test(url);
  const saveApiOverride = async () => {
    if (!validateUrl(apiInput)) {
      showAlert("Invalid URL", "Please enter a valid http(s) URL, e.g. http://192.168.1.10:8000/api");
      return;
    }
    try {
      setSavingApi(true);
      await AsyncStorage.setItem("apiBaseUrlOverride", apiInput);
      api.defaults.baseURL = apiInput;
      setEffectiveApi(apiInput);
      setShowDevModal(false);
      showAlert("Applied", "Backend API base URL updated for this app.");
    } catch {
      showAlert("Error", "Failed to save API URL override");
    } finally {
      setSavingApi(false);
    }
  };
  const resetApiOverride = async () => {
    try {
      setSavingApi(true);
      await AsyncStorage.removeItem("apiBaseUrlOverride");
      api.defaults.baseURL = config.apiBaseUrl;
      setEffectiveApi(config.apiBaseUrl);
      setApiInput(config.apiBaseUrl);
      setShowDevModal(false);
      showAlert("Reset", "Reverted to default backend API URL.");
    } catch {
      showAlert("Error", "Failed to reset API URL override");
    } finally {
      setSavingApi(false);
    }
  };

  /* ── Conflict demo data ─────────────────────────────── */
  const demoConflict: FileConflict = {
    id: "demo-conflict-1",
    nodeId: "node-abc-123",
    projectId: "project-xyz",
    fileName: "field-notes-sector-B.txt",
    localVersion: {
      nodeId: "node-abc-123", projectId: "project-xyz",
      name: "field-notes-sector-B.txt", localVersion: 3, remoteVersion: 4,
      localUpdatedAt: new Date(Date.now() - 3600000).toISOString(),
      remoteUpdatedAt: new Date(Date.now() - 1800000).toISOString(),
      hasLocalEdits: true, localEditPath: "/offline/project-xyz/field-notes-sector-B.txt",
    },
    remoteVersion: {
      version: 4, updatedAt: new Date(Date.now() - 1800000).toISOString(),
      updatedBy: "Dr. Petrova",
    },
    localEditPath: "/offline/project-xyz/field-notes-sector-B.txt",
    createdAt: new Date().toISOString(),
    resolved: false,
  };
  const demoLocalContent = "Excavation notes – Sector B, Layer 4\n\nFound ceramic fragment at 1.2m depth.\nSoil: dark brown clay with charcoal inclusions.\nPossible hearth feature identified in NE quadrant.";
  const demoRemoteContent = "Excavation notes – Sector B, Layer 4\n\nFound ceramic fragment at 1.2m depth.\nSoil: dark brown clay with charcoal inclusions.\nPossible hearth feature identified in NE quadrant.\n\nUpdate: Fragment catalogued as SB-L4-0042. Cross-ref with GPS marker B-17.";

  /* ═══════════════════  RENDER  ═══════════════════════ */
  return (
    <View style={styles.container}>
      {/* ── Header ─────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity onPress={() => router.push({ pathname: "/profile/[userId]", params: { userId: String(user?.id ?? "") } })}>
            <Text style={styles.headerBtn}>View</Text>
          </TouchableOpacity>
          {editing ? (
            <TouchableOpacity onPress={() => { resetForm(); setEditing(false); }}>
              <Text style={[styles.headerBtn, { color: "#FF4444" }]}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.headerBtn}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled">

        {/* ── Banner + Avatar ──────────────────────────── */}
        <TouchableOpacity
          activeOpacity={editing ? 0.7 : 1}
          onPress={editing ? () => pickImage("banner") : undefined}
          style={styles.bannerWrap}
        >
          {user?.banner_url ? (
            <Image source={{ uri: user.banner_url }} style={styles.bannerImage} />
          ) : (
            <View style={styles.bannerPlaceholder}>
              {editing && <Text style={styles.bannerHint}>Tap to set banner</Text>}
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.avatarRow}>
          <TouchableOpacity
            activeOpacity={editing ? 0.7 : 1}
            onPress={editing ? () => pickImage("avatar") : undefined}
          >
            {user?.photo_url ? (
              <Image source={{ uri: user.photo_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.display_name?.charAt(0).toUpperCase() || "U"}
                </Text>
              </View>
            )}
            {editing && (
              <View style={styles.avatarEditBadge}>
                <Text style={{ color: "#FFF", fontSize: 10 }}>✎</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Name + Username ──────────────────────────── */}
        {editing ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor="#666"
            />
            <Text style={styles.fieldLabel}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
              placeholder="unique_username"
              placeholderTextColor="#666"
              autoCapitalize="none"
              maxLength={30}
            />
          </View>
        ) : (
          <View style={styles.nameSection}>
            <Text style={styles.displayName}>{user?.display_name || "User"}</Text>
            {user?.username ? (
              <Text style={styles.usernameText}>@{user.username}</Text>
            ) : null}
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        )}

        {/* ── Description ──────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          {editing ? (
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: "top" }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Tell others about yourself..."
              placeholderTextColor="#666"
              multiline
              maxLength={500}
            />
          ) : (
            <Text style={styles.fieldValue}>
              {user?.description || "No description yet."}
            </Text>
          )}
        </View>

        {/* ── Social Links ─────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social Links</Text>
          {editing ? (
            SOCIAL_LINKS.map(({ key, label, placeholder }) => (
              <View key={key} style={{ marginBottom: 12 }}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={socials[key]}
                  onChangeText={(t) => setSocials((p) => ({ ...p, [key]: t }))}
                  placeholder={placeholder}
                  placeholderTextColor="#666"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ))
          ) : (
            <View>
              {SOCIAL_LINKS.map(({ key, label }) => {
                const val = socials[key] || (user as any)?.[key];
                if (!val) return null;
                return (
                  <View key={key} style={styles.socialRow}>
                    <Text style={styles.socialLabel}>{label}</Text>
                    <Text style={styles.socialValue} numberOfLines={1}>{val}</Text>
                  </View>
                );
              })}
              {!SOCIAL_LINKS.some(({ key }) => socials[key] || (user as any)?.[key]) && (
                <Text style={styles.fieldValue}>No social links added.</Text>
              )}
            </View>
          )}
        </View>

        {/* ── Phone ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Phone</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 234 567 8900"
              placeholderTextColor="#666"
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.fieldValue}>{user?.phone || "Not set"}</Text>
          )}
        </View>

        {/* ── Timezone ─────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timezone</Text>
          {editing ? (
            <TouchableOpacity style={styles.input} onPress={() => setShowTzPicker(true)}>
              <Text style={{ color: timezone ? "#F5F5F5" : "#666", fontSize: 16 }}>
                {timezone || "Select timezone..."}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.fieldValue}>{user?.timezone || "Not set"}</Text>
          )}
        </View>

        {/* ── Show Projects ────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Show Projects on Profile</Text>
              <Text style={styles.switchHint}>
                When enabled, others can see which projects you belong to.
              </Text>
            </View>
            <Switch
              value={showProjects}
              onValueChange={editing ? setShowProjects : undefined}
              disabled={!editing}
              trackColor={{ false: "#3A3A3C", true: "#FF2A2A80" }}
              thumbColor={showProjects ? "#FF2A2A" : "#9A9A9A"}
            />
          </View>
        </View>

        {/* ── Save button ──────────────────────────────── */}
        {editing && (
          <TouchableOpacity
            style={[styles.saveButton, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#F5F5F5" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        )}

        {/* ── Account section ──────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.menuItem} onPress={handleHelpSupport}>
            <Text style={styles.menuItemText}>Help & Support</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleAbout}>
            <Text style={styles.menuItemText}>About</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>

          {Platform.OS !== "web" && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/scan-qr" as any)}
            >
              <Text style={styles.menuItemText}>Scan QR Code</Text>
              <Text style={styles.menuItemArrow}>→</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Development ──────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Development</Text>
          <TouchableOpacity style={styles.menuItem} onPress={openDevModal}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Backend API Base URL</Text>
              <Text style={styles.menuItemSubtext} numberOfLines={1}>{effectiveApi}</Text>
            </View>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowConflictTest(true)}>
            <Text style={styles.menuItemText}>Test Conflict Resolution</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, isLoggingOut && { opacity: 0.7 }]}
          onPress={() => setShowLogoutModal(true)}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <ActivityIndicator color="#F5F5F5" />
          ) : (
            <Text style={styles.logoutButtonText}>Logout</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Logout modal ───────────────────────────────── */}
      <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm logout</Text>
            <Text style={styles.modalText}>Are you sure you want to log out of STRATUM?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowLogoutModal(false)} disabled={isLoggingOut}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalLogoutButton, isLoggingOut && { opacity: 0.7 }]}
                onPress={performLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <ActivityIndicator color="#F5F5F5" />
                ) : (
                  <Text style={[styles.modalButtonText, styles.modalLogoutText]}>Logout</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Dev API modal ──────────────────────────────── */}
      <Modal visible={showDevModal} transparent animationType="fade" onRequestClose={() => setShowDevModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Backend API Base URL</Text>
            <Text style={styles.modalText}>
              Enter the full API url including /api.{"\n"}Example: http://192.168.1.100:8000/api
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="http://host:port/api"
              placeholderTextColor="#777"
              value={apiInput}
              onChangeText={setApiInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowDevModal(false)} disabled={savingApi}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#3A0C0C", borderWidth: 1, borderColor: "#FF4444" }]}
                onPress={resetApiOverride}
                disabled={savingApi}
              >
                {savingApi ? <ActivityIndicator color="#F5F5F5" /> : <Text style={[styles.modalButtonText, { color: "#FF4444" }]}>Reset</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: "#FF2A2A" }]} onPress={saveApiOverride} disabled={savingApi}>
                {savingApi ? <ActivityIndicator color="#F5F5F5" /> : <Text style={[styles.modalButtonText, { color: "#F5F5F5" }]}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Timezone picker modal ──────────────────────── */}
      <Modal visible={showTzPicker} transparent animationType="slide" onRequestClose={() => setShowTzPicker(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: "60%" }]}>
            <Text style={styles.modalTitle}>Select Timezone</Text>
            <ScrollView style={{ marginTop: 12 }}>
              {TIMEZONES.map((tz) => (
                <TouchableOpacity
                  key={tz}
                  style={[styles.tzItem, timezone === tz && styles.tzItemActive]}
                  onPress={() => { setTimezone(tz); setShowTzPicker(false); }}
                >
                  <Text style={[styles.tzText, timezone === tz && { color: "#FF2A2A" }]}>{tz}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.modalButton, { alignSelf: "flex-end", marginTop: 12 }]} onPress={() => setShowTzPicker(false)}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConflictResolutionModal
        visible={showConflictTest}
        conflict={demoConflict}
        onResolve={(resolution) => { setShowConflictTest(false); showAlert("Resolution", `You chose: ${resolution}`); }}
        onCancel={() => setShowConflictTest(false)}
        localContent={demoLocalContent}
        remoteContent={demoRemoteContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111111" },
  header: {
    padding: 24, paddingTop: 60, backgroundColor: "#111111",
    borderBottomWidth: 1, borderBottomColor: "#2A2A2A",
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
  },
  headerTitle: { fontSize: 32, fontWeight: "700", color: "#F5F5F5", letterSpacing: 0.5 },
  headerBtn: { fontSize: 16, fontWeight: "600", color: "#007AFF" },
  content: { flex: 1, padding: 0 },

  /* Banner */
  bannerWrap: { width: "100%", height: 140, backgroundColor: "#1A1A1A" },
  bannerImage: { width: "100%", height: 140, resizeMode: "cover" },
  bannerPlaceholder: {
    flex: 1, backgroundColor: "#1E1E1E",
    justifyContent: "center", alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: "#2A2A2A",
  },
  bannerHint: { color: "#666", fontSize: 13 },

  /* Avatar */
  avatarRow: { paddingHorizontal: 24, marginTop: -40 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#FF2A2A", justifyContent: "center", alignItems: "center",
    borderWidth: 3, borderColor: "#111111",
  },
  avatarImage: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: "#111111",
  },
  avatarText: { fontSize: 32, color: "#F5F5F5", fontWeight: "700" },
  avatarEditBadge: {
    position: "absolute", bottom: 0, right: 0,
    backgroundColor: "#007AFF", borderRadius: 10,
    width: 20, height: 20, justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#111111",
  },

  /* Name section (view mode) */
  nameSection: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  displayName: { fontSize: 22, fontWeight: "700", color: "#F5F5F5" },
  usernameText: { fontSize: 15, color: "#9A9A9A", marginTop: 2 },
  email: { fontSize: 13, color: "#666", marginTop: 4 },

  /* Editable fields */
  fieldGroup: { paddingHorizontal: 24, paddingTop: 12 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#9A9A9A", marginBottom: 6, marginTop: 12, textTransform: "uppercase" },
  fieldValue: { fontSize: 15, color: "#CCCCCC", lineHeight: 22 },
  input: {
    backgroundColor: "#1A1A1A", color: "#F5F5F5", padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: "#2A2A2A", fontSize: 16,
  },

  /* Social links (view) */
  socialRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1A1A1A",
  },
  socialLabel: { fontSize: 14, color: "#9A9A9A", width: 90 },
  socialValue: { fontSize: 14, color: "#007AFF", flex: 1, textAlign: "right" },

  /* Switch */
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchHint: { fontSize: 12, color: "#666", marginTop: 2 },

  /* Section */
  section: { paddingHorizontal: 24, marginTop: 24 },
  sectionTitle: {
    fontSize: 12, fontWeight: "600", color: "#9A9A9A",
    marginBottom: 12, letterSpacing: 0.5, textTransform: "uppercase",
  },

  /* Save */
  saveButton: {
    backgroundColor: "#FF2A2A", padding: 16, borderRadius: 16,
    alignItems: "center", marginTop: 28, marginHorizontal: 24,
  },
  saveButtonText: { color: "#F5F5F5", fontSize: 16, fontWeight: "600" },

  /* Menu items */
  menuItem: {
    backgroundColor: "#1A1A1A", padding: 16, borderRadius: 16,
    marginBottom: 8, borderWidth: 1, borderColor: "#2A2A2A",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  menuItemText: { fontSize: 16, color: "#F5F5F5", letterSpacing: 0.5 },
  menuItemSubtext: { fontSize: 12, color: "#9A9A9A", marginTop: 4 },
  menuItemArrow: { fontSize: 16, color: "#9A9A9A" },

  /* Logout */
  logoutButton: {
    backgroundColor: "#FF2A2A", padding: 16, borderRadius: 16,
    alignItems: "center", marginTop: 32, marginHorizontal: 24,
  },
  logoutButtonText: { color: "#F5F5F5", fontSize: 16, fontWeight: "600", letterSpacing: 0.5 },

  /* Modals */
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalCard: {
    backgroundColor: "#1E1E1E", borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: "#333", width: "100%",
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#F5F5F5", marginBottom: 8 },
  modalText: { fontSize: 14, color: "#CCCCCC", marginBottom: 16, lineHeight: 20 },
  modalInput: {
    backgroundColor: "#121212", color: "#F5F5F5", padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: "#333", marginBottom: 16,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  modalButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#2A2A2A" },
  modalButtonText: { color: "#F5F5F5", fontSize: 14, fontWeight: "600" },
  modalLogoutButton: { backgroundColor: "#3A0C0C", borderWidth: 1, borderColor: "#FF4444" },
  modalLogoutText: { color: "#FF4444" },

  /* Timezone picker */
  tzItem: { paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#2A2A2A" },
  tzItemActive: { backgroundColor: "#1A0505" },
  tzText: { fontSize: 15, color: "#F5F5F5" },
});


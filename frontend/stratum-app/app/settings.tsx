/**
 * @file
 * Application settings screen.
 *
 * Provides user preferences, theme settings, and
 * account management options.
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
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
  Switch,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/contexts/AuthContext";
import { useOnboarding } from "../src/contexts/OnboardingContext";
import api from "../src/services/api";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { showAlert } from "../src/utils/alert";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { config } from "../src/config/config";
import { ConflictResolutionModal } from "../src/components/sync/ConflictResolutionModal";
import type { FileConflict } from "../src/services/offlineQueueService";
import {
  offlineFilesStorage,
  recentProjectsCache,
} from "../src/services/offlineService";
import {
  offlineQueue,
  getOfflineStorageStats,
  OfflineStorageStats,
} from "../src/services/offlineQueueService";
import { OfflineFile } from "../src/db/schema";

/* ── Social link definitions ────────────────────────────────────── */
const SOCIAL_LINKS = [
  { key: "link_x", label: "X (Twitter)", placeholder: "https://x.com/handle" },
  { key: "link_discord", label: "Discord", placeholder: "username#0000 or invite link" },
  { key: "link_bsky", label: "Bluesky", placeholder: "https://bsky.app/profile/handle" },
  { key: "link_linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/..." },
  { key: "link_website", label: "Website", placeholder: "https://yoursite.com" },
] as const;

type SocialKey = (typeof SOCIAL_LINKS)[number]["key"];

/* ── Timezone options ───────────────────────────────────────── */
const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "Europe/Bucharest", "Europe/Moscow", "Asia/Tokyo", "Asia/Shanghai",
  "Asia/Kolkata", "Australia/Sydney",
];

// Storage bar component
function StorageBar({
  stratumUsed,
  otherUsed,
  totalStorage,
}: {
  stratumUsed: number;
  otherUsed: number;
  totalStorage: number;
}) {
  const free = totalStorage - stratumUsed - otherUsed;
  const stratumPercent = (stratumUsed / totalStorage) * 100;
  const otherPercent = (otherUsed / totalStorage) * 100;
  const freePercent = (free / totalStorage) * 100;

  const formatSize = (bytes: number) => {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <View style={storageStyles.container}>
      <View style={storageStyles.bar}>
        <View
          style={[
            storageStyles.segment,
            { width: `${stratumPercent}%`, backgroundColor: "#FF2A2A" },
          ]}
        />
        <View
          style={[
            storageStyles.segment,
            { width: `${otherPercent}%`, backgroundColor: "#666" },
          ]}
        />
        <View
          style={[
            storageStyles.segment,
            { width: `${freePercent}%`, backgroundColor: "#2A2A2A" },
          ]}
        />
      </View>
      <View style={storageStyles.legend}>
        <View style={storageStyles.legendItem}>
          <View style={[storageStyles.legendDot, { backgroundColor: "#FF2A2A" }]} />
          <Text style={storageStyles.legendText}>
            STRATUM ({formatSize(stratumUsed)})
          </Text>
        </View>
        <View style={storageStyles.legendItem}>
          <View style={[storageStyles.legendDot, { backgroundColor: "#666" }]} />
          <Text style={storageStyles.legendText}>
            Other ({formatSize(otherUsed)})
          </Text>
        </View>
        <View style={storageStyles.legendItem}>
          <View
            style={[
              storageStyles.legendDot,
              { backgroundColor: "#2A2A2A", borderWidth: 1, borderColor: "#444" },
            ]}
          />
          <Text style={storageStyles.legendText}>Free ({formatSize(free)})</Text>
        </View>
      </View>
    </View>
  );
}

const storageStyles = StyleSheet.create({
  container: { marginVertical: 16 },
  bar: {
    height: 12,
    borderRadius: 6,
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: "#2A2A2A",
  },
  segment: { height: "100%" },
  legend: { marginTop: 12, gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendText: { color: "#9A9A9A", fontSize: 12 },
});

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { replayOnboarding } = useOnboarding();

  // Storage stats
  const [stratumUsed, setStratumUsed] = useState(0);
  const [otherUsed, setOtherUsed] = useState(0);
  const [totalStorage, setTotalStorage] = useState(64 * 1e9);
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [offlineStorageStats, setOfflineStorageStats] =
    useState<OfflineStorageStats | null>(null);

  // Offline files
  const [offlineFiles, setOfflineFiles] = useState<OfflineFile[]>([]);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "unknown" | "connected" | "disconnected"
  >("unknown");
  const connectionCheckedRef = React.useRef(false);

  // Network state
  const [networkState, setNetworkState] = useState<NetInfoState | null>(null);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);

  // Downloaded projects
  const [downloadedProjects, setDownloadedProjects] = useState<any[]>([]);

  // Profile settings (simple modal fields)
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(user?.display_name || "");
  const [newPhotoUrl, setNewPhotoUrl] = useState(user?.photo_url || "");
  const [newBio, setNewBio] = useState(user?.bio || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Extended profile edit fields
  const [selectedBannerImage, setSelectedBannerImage] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTimezone, setEditTimezone] = useState("");
  const [editShowProjects, setEditShowProjects] = useState(true);
  const [editSocials, setEditSocials] = useState<Record<SocialKey, string>>({
    link_x: "", link_discord: "", link_bsky: "", link_linkedin: "", link_website: "",
  });
  const [showTzPicker, setShowTzPicker] = useState(false);

  // Developer tools state
  const [showDevModal, setShowDevModal] = useState(false);
  const [apiInput, setApiInput] = useState(config.apiBaseUrl);
  const [effectiveApi, setEffectiveApi] = useState(config.apiBaseUrl);
  const [savingApi, setSavingApi] = useState(false);
  const [showConflictTest, setShowConflictTest] = useState(false);

  // ─── Network subscription ────────────────────────────
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkState(state);
      if (!connectionCheckedRef.current) {
        if (state.isConnected === false) {
          setConnectionStatus("disconnected");
        }
      }
    });
    NetInfo.fetch().then((state) => {
      setNetworkState(state);
      if (state.isConnected === false) {
        setConnectionStatus("disconnected");
      }
    });
    return () => unsubscribe();
  }, []);

  // ─── Load API override on mount ──────────────────────
  useEffect(() => {
    (async () => {
      try {
        const override = await AsyncStorage.getItem("apiBaseUrlOverride");
        const current = override || config.apiBaseUrl;
        setEffectiveApi(current);
        setApiInput(current);
        if (override) api.defaults.baseURL = override;
      } catch {}
    })();
  }, []);

  const loadPendingQueue = useCallback(async () => {
    try {
      const queue = await offlineQueue.getQueue();
      const pendingCount = queue.filter((a) => a.status === "pending").length;
      setPendingQueueCount(pendingCount);
    } catch (err) {
      console.error("Failed to load pending queue:", err);
    }
  }, []);

  useEffect(() => {
    loadStorageInfo();
    loadOfflineFiles();
    loadDownloadedProjects();
    loadPendingQueue();
  }, [loadPendingQueue]);

  // ─── Storage helpers ─────────────────────────────────
  const loadStorageInfo = async () => {
    if (Platform.OS === "web") {
      setLoadingStorage(false);
      return;
    }
    try {
      const stratumSize = await offlineFilesStorage.getOfflineStorageSize();
      setStratumUsed(stratumSize);
      try {
        const queueStats = await getOfflineStorageStats();
        setOfflineStorageStats(queueStats);
        if (queueStats && queueStats.totalSize) {
          setStratumUsed((prev) => prev + queueStats.totalSize * 1024);
        }
      } catch (queueErr) {
        console.warn("Failed to get queue storage stats:", queueErr);
      }
      try {
        if (typeof FileSystem.getFreeDiskStorageAsync === "function") {
          const freeSpace = await FileSystem.getFreeDiskStorageAsync();
          let totalDiskSpace = freeSpace;
          if (typeof FileSystem.getTotalDiskCapacityAsync === "function") {
            try {
              totalDiskSpace = await FileSystem.getTotalDiskCapacityAsync();
              setTotalStorage(totalDiskSpace);
              setOtherUsed(totalDiskSpace - freeSpace - stratumSize);
              setStorageAvailable(true);
            } catch {
              const estimatedTotal = freeSpace + stratumSize + 20 * 1e9;
              setTotalStorage(estimatedTotal);
              setOtherUsed(estimatedTotal - freeSpace - stratumSize);
              setStorageAvailable(true);
            }
          } else {
            const estimatedTotal = freeSpace + stratumSize + 20 * 1e9;
            setTotalStorage(estimatedTotal);
            setOtherUsed(estimatedTotal - freeSpace - stratumSize);
            setStorageAvailable(true);
          }
        } else {
          console.warn("Storage APIs not available, using fallback values");
          setTotalStorage(64 * 1e9);
          setOtherUsed(32 * 1e9);
        }
      } catch (storageErr) {
        console.warn("Storage API error:", storageErr);
        setTotalStorage(64 * 1e9);
        setOtherUsed(32 * 1e9);
      }
    } catch (err) {
      console.error("Failed to load storage info:", err);
    } finally {
      setLoadingStorage(false);
    }
  };

  const loadOfflineFiles = async () => {
    const files = await offlineFilesStorage.getOfflineFiles();
    setOfflineFiles(files);
  };

  const loadDownloadedProjects = async () => {
    const projects = await recentProjectsCache.getRecentProjects();
    setDownloadedProjects(projects);
  };

  // ─── Connection check ────────────────────────────────
  const checkConnection = async () => {
    setCheckingConnection(true);
    connectionCheckedRef.current = true;
    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        setConnectionStatus("disconnected");
        showAlert("No Network", "Your device is not connected to a network. Check your Wi-Fi or cellular data.");
        setCheckingConnection(false);
        return;
      }
      if (!netState.isInternetReachable) {
        setConnectionStatus("disconnected");
        showAlert("No Internet", "Network connected but internet is not reachable. Try again later.");
        setCheckingConnection(false);
        return;
      }
      const response = await api.get("/health");
      if (response.status === 200) {
        setConnectionStatus("connected");
        const pendingMessage = pendingQueueCount > 0 ? `\n\n${pendingQueueCount} pending action(s) waiting to sync.` : "";
        showAlert("Connected \u2713", `Successfully connected to STRATUM backend.${pendingMessage}`);
      } else {
        setConnectionStatus("disconnected");
        showAlert("Connection Failed", "Could not reach STRATUM backend.");
      }
    } catch {
      setConnectionStatus("disconnected");
      showAlert("Connection Failed", "Could not reach STRATUM backend. The server may be temporarily unavailable.");
    } finally {
      setCheckingConnection(false);
    }
  };

  const removeOfflineFile = async (nodeId: string) => {
    await offlineFilesStorage.removeOfflineFile(nodeId);
    await loadOfflineFiles();
    await loadStorageInfo();
  };

  const clearAllOfflineFiles = async () => {
    showAlert(
      "Clear All Offline Files",
      "This will remove all files saved for offline access. You will need an internet connection to view them again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            await offlineFilesStorage.clearAllOfflineFiles();
            await loadOfflineFiles();
            await loadStorageInfo();
          },
        },
      ],
    );
  };

  const removeDownloadedProject = async (projectId: string) => {
    showAlert(
      "Remove Downloaded Project",
      "This will remove the cached project data. You will need internet to view it again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await recentProjectsCache.removeProject(projectId);
              await loadDownloadedProjects();
              await loadStorageInfo();
            } catch (error) {
              console.error("Failed to remove downloaded project:", error);
              showAlert("Error", "Failed to remove downloaded project");
            }
          },
        },
      ],
    );
  };

  // ─── Image pickers ───────────────────────────────────
  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showAlert("Permission Required", "Please allow access to your photo library to upload a profile picture.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
          showAlert("Image Too Large", "Please select an image under 50MB.");
          return;
        }
        setSelectedImage(asset.uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      showAlert("Error", "Failed to pick image.");
    }
  };

  const pickBannerImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showAlert("Permission Required", "Please allow access to your photo library to upload a banner.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 5],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
          showAlert("Image Too Large", "Please select an image under 50MB.");
          return;
        }
        setSelectedBannerImage(asset.uri);
      }
    } catch (error) {
      console.error("Error picking banner:", error);
      showAlert("Error", "Failed to pick banner image.");
    }
  };

  const uploadProfileImage = async (): Promise<string | null> => {
    if (!selectedImage) return null;
    try {
      const formData = new FormData();
      const filename = `profile_${user?.id}_${Date.now()}.jpg`;
      if (Platform.OS === "web") {
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        formData.append("file", blob, filename);
      } else {
        formData.append("file", { uri: selectedImage, type: "image/jpeg", name: filename } as any);
      }
      const response = await api.post("/files/profile-picture", formData);
      return response.data.url;
    } catch (error: any) {
      console.error("Failed to upload profile image:", error);
      if (selectedImage.startsWith("data:") || Platform.OS === "web") {
        return selectedImage;
      }
      throw error;
    }
  };

  // ─── Save profile (full) ─────────────────────────────
  const saveProfile = async () => {
    if (editUsername.length > 0 && editUsername.length < 3) {
      showAlert("Invalid username", "Username must be at least 3 characters");
      return;
    }
    setSavingProfile(true);
    try {
      // Upload banner if changed
      if (selectedBannerImage) {
        try {
          const bannerForm = new FormData();
          const bannerFilename = `banner_${user?.id}_${Date.now()}.jpg`;
          if (Platform.OS === "web") {
            const res = await fetch(selectedBannerImage);
            const blob = await res.blob();
            bannerForm.append("file", blob, bannerFilename);
          } else {
            bannerForm.append("file", { uri: selectedBannerImage, type: "image/jpeg", name: bannerFilename } as any);
          }
          await api.post("/files/banner-image", bannerForm);
        } catch {
          console.warn("Banner upload failed, continuing");
        }
      }

      // Upload avatar if changed
      if (selectedImage && selectedImage !== user?.photo_url) {
        try {
          await uploadProfileImage();
        } catch {
          console.warn("Avatar upload failed, keeping existing photo");
        }
      }

      // Build patch body with ALL profile fields
      const body: Record<string, any> = {
        display_name: newDisplayName,
        bio: newBio,
        description: editDescription,
        phone: editPhone,
        timezone: editTimezone,
        show_projects: editShowProjects,
        ...editSocials,
      };
      if (editUsername) body.username = editUsername;

      await api.patch("/auth/me", body);

      if (refreshUser) {
        await refreshUser();
      }
      showAlert("Success", "Profile updated successfully.");
      setShowProfileModal(false);
      setSelectedImage(null);
      setSelectedBannerImage(null);
    } catch (error: any) {
      showAlert("Error", error?.response?.data?.detail || error.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const openProfileModal = () => {
    setNewDisplayName(user?.display_name || "");
    setNewPhotoUrl(user?.photo_url || "");
    setNewBio(user?.bio || "");
    setSelectedImage(null);
    setSelectedBannerImage(null);
    setEditUsername((user as any)?.username || "");
    setEditDescription((user as any)?.description || "");
    setEditPhone((user as any)?.phone || "");
    setEditTimezone((user as any)?.timezone || "");
    setEditShowProjects((user as any)?.show_projects !== false);
    setEditSocials({
      link_x: (user as any)?.link_x || "",
      link_discord: (user as any)?.link_discord || "",
      link_bsky: (user as any)?.link_bsky || "",
      link_linkedin: (user as any)?.link_linkedin || "",
      link_website: (user as any)?.link_website || "",
    });
    setShowProfileModal(true);
  };

  const handleReplayTutorial = () => {
    showAlert(
      "Replay Tutorial?",
      "This will show you the STRATUM onboarding walkthrough again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Start Tutorial", onPress: () => { replayOnboarding(); } },
      ],
    );
  };

  // ─── Help / About / Dev helpers ──────────────────────
  const handleHelpSupport = () => {
    showAlert(
      "Help & Support",
      "Need help?\n\n\u2022 Email: support@stratum.app\n\u2022 Documentation: docs.stratum.app\n\u2022 Community Forum: forum.stratum.app",
      [{ text: "OK", style: "default" }],
    );
  };

  const handleAbout = () => {
    showAlert(
      "About STRATUM",
      "STRATUM v1.0.0\n\nArchaeological Site Documentation & Collaboration Platform\n\nBuilt for FLL 2025-2026 UNEARTHED Challenge\n\n\u00a9 2026 Andrei Banu & Levin Mircea",
      [{ text: "OK", style: "default" }],
    );
  };

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

  /* ── Conflict demo data ─────────────────────────────────────── */
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
  const demoLocalContent = "Excavation notes \u2013 Sector B, Layer 4\n\nFound ceramic fragment at 1.2m depth.\nSoil: dark brown clay with charcoal inclusions.\nPossible hearth feature identified in NE quadrant.";
  const demoRemoteContent = "Excavation notes \u2013 Sector B, Layer 4\n\nFound ceramic fragment at 1.2m depth.\nSoil: dark brown clay with charcoal inclusions.\nPossible hearth feature identified in NE quadrant.\n\nUpdate: Fragment catalogued as SB-L4-0042. Cross-ref with GPS marker B-17.";

  // Group offline files by project
  const groupedOfflineFiles = offlineFiles.reduce(
    (acc, file) => {
      if (!acc[file.project_id]) {
        acc[file.project_id] = [];
      }
      acc[file.project_id].push(file);
      return acc;
    },
    {} as Record<string, OfflineFile[]>,
  );

  const formatSize = (bytes: number) => {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  /* ======================================================
   *  RENDER
   * ==================================================== */
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* ── Profile Settings Section ─────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Settings</Text>

          <TouchableOpacity style={styles.menuItem} onPress={openProfileModal}>
            <View style={styles.profilePreview}>
              {user?.photo_url ? (
                <Image
                  source={{ uri: user.photo_url }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Text style={styles.profilePlaceholderText}>
                    {user?.display_name?.charAt(0).toUpperCase() || "U"}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.menuItemText}>Edit Profile</Text>
                <Text style={styles.menuItemSubtext}>
                  Change photo, name, bio, socials & more
                </Text>
              </View>
            </View>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push({ pathname: "/profile/[userId]", params: { userId: String(user?.id ?? "") } })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>View My Profile</Text>
              <Text style={styles.menuItemSubtext}>
                See how others see your profile
              </Text>
            </View>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleReplayTutorial}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Replay Tutorial</Text>
              <Text style={styles.menuItemSubtext}>
                Learn how to use STRATUM again
              </Text>
            </View>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* ── Storage Section - Mobile Only ─────────────── */}
        {Platform.OS !== "web" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Storage</Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Device Storage</Text>
              {loadingStorage ? (
                <ActivityIndicator color="#FF2A2A" style={{ marginVertical: 20 }} />
              ) : storageAvailable ? (
                <StorageBar
                  stratumUsed={stratumUsed}
                  otherUsed={otherUsed}
                  totalStorage={totalStorage}
                />
              ) : (
                <View style={{ paddingVertical: 16, alignItems: "center" }}>
                  <Text
                    style={{ color: "#9A9A9A", fontSize: 13, textAlign: "center" }}
                  >
                    Storage info unavailable in this environment.{"\n"}
                    Build a development build for accurate data.
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowOfflineModal(true)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemText}>Offline Usage</Text>
                <Text style={styles.menuItemSubtext}>
                  {offlineFiles.length} file(s) \u2022 {formatSize(stratumUsed)}
                </Text>
              </View>
              <Text style={styles.menuItemArrow}>→</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Account Section ──────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.menuItem} onPress={handleHelpSupport}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Help & Support</Text>
            </View>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleAbout}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>About</Text>
            </View>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>

          {Platform.OS !== "web" && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push("/scan-qr" as any)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemText}>Scan QR Code</Text>
              </View>
              <Text style={styles.menuItemArrow}>→</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Connection & Sync Section ────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection & Sync</Text>

          <View style={styles.card}>
            <View style={styles.connectionRow}>
              <View
                style={[
                  styles.connectionIndicator,
                  {
                    backgroundColor:
                      connectionStatus === "connected"
                        ? "#4CAF50"
                        : connectionStatus === "disconnected"
                          ? "#FF4444"
                          : "#666",
                  },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.connectionTitle}>
                  {connectionStatus === "connected"
                    ? "Online"
                    : connectionStatus === "disconnected"
                      ? "Offline"
                      : "Not checked"}
                </Text>
                <Text style={styles.connectionSubtitle}>
                  {networkState?.type === "wifi"
                    ? "Wi-Fi"
                    : networkState?.type === "cellular"
                      ? "Cellular"
                      : networkState?.type === "none"
                        ? "No Network"
                        : "Tap Refresh to check"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={checkConnection}
                disabled={checkingConnection}
              >
                {checkingConnection ? (
                  <ActivityIndicator color="#FF2A2A" size="small" />
                ) : (
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                )}
              </TouchableOpacity>
            </View>

            {pendingQueueCount > 0 && (
              <View style={styles.syncQueueInfo}>
                <Text style={styles.syncQueueText}>
                  {pendingQueueCount} pending action(s) waiting to sync
                </Text>
                {connectionStatus === "connected" && (
                  <Text style={styles.syncQueueHint}>
                    Will sync automatically in the background
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* ── Development Section ──────────────────────── */}
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
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Test Conflict Resolution</Text>
            </View>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Offline Usage Modal ────────────────────────── */}
      <Modal
        visible={showOfflineModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOfflineModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowOfflineModal(false)}>
              <Text style={styles.backText}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Offline Usage</Text>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Connection Check */}
            <TouchableOpacity
              style={[styles.actionButton, checkingConnection && { opacity: 0.7 }]}
              onPress={checkConnection}
              disabled={checkingConnection}
            >
              {checkingConnection ? (
                <ActivityIndicator color="#F5F5F5" />
              ) : (
                <>
                  <Text style={styles.actionButtonText}>Check Connection</Text>
                  {connectionStatus !== "unknown" && (
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            connectionStatus === "connected" ? "#4CAF50" : "#FF4444",
                        },
                      ]}
                    />
                  )}
                </>
              )}
            </TouchableOpacity>

            {/* Queue Storage Stats */}
            {offlineStorageStats && (
              <View style={[styles.card, { marginTop: 16 }]}>
                <Text style={styles.cardTitle}>Offline Storage Details</Text>
                <View style={styles.storageStatRow}>
                  <Text style={styles.storageStatLabel}>Sync Queue</Text>
                  <Text style={styles.storageStatValue}>
                    {offlineStorageStats.queueSize} KB
                  </Text>
                </View>
                <View style={styles.storageStatRow}>
                  <Text style={styles.storageStatLabel}>File Versions</Text>
                  <Text style={styles.storageStatValue}>
                    {offlineStorageStats.versionsSize} KB
                  </Text>
                </View>
                <View style={styles.storageStatRow}>
                  <Text style={styles.storageStatLabel}>Pending Edits</Text>
                  <Text style={styles.storageStatValue}>
                    {offlineStorageStats.pendingEditsSize} KB
                  </Text>
                </View>
                <View style={styles.storageStatRow}>
                  <Text style={styles.storageStatLabel}>Conflicts</Text>
                  <Text style={styles.storageStatValue}>
                    {offlineStorageStats.conflictsSize} KB
                  </Text>
                </View>
                <View
                  style={[
                    styles.storageStatRow,
                    {
                      borderTopWidth: 1,
                      borderTopColor: "#333",
                      paddingTop: 8,
                      marginTop: 8,
                    },
                  ]}
                >
                  <Text style={[styles.storageStatLabel, { fontWeight: "600" }]}>
                    Total Queue Storage
                  </Text>
                  <Text style={[styles.storageStatValue, { color: "#FF2A2A" }]}>
                    {offlineStorageStats.totalSize} KB
                  </Text>
                </View>
              </View>
            )}

            {/* Pending Queue Actions */}
            {pendingQueueCount > 0 && (
              <View style={[styles.card, { marginTop: 16 }]}>
                <Text style={styles.cardTitle}>Pending Sync Actions</Text>
                <Text style={styles.pendingQueueCount}>{pendingQueueCount}</Text>
                <Text style={styles.pendingQueueDescription}>
                  {connectionStatus === "connected"
                    ? "Actions will sync automatically in the background"
                    : "Will sync when connection is restored"}
                </Text>
              </View>
            )}

            {/* Offline Files */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Saved Files</Text>

            {offlineFiles.length === 0 ? (
              <Text style={styles.emptyText}>
                No files saved for offline access.
              </Text>
            ) : (
              <>
                {Object.entries(groupedOfflineFiles).map(([projectId, files]) => (
                  <View key={projectId} style={styles.projectGroup}>
                    <Text style={styles.projectGroupTitle}>
                      Project: {projectId.slice(0, 8)}...
                    </Text>
                    {files.map((file) => (
                      <View key={file.node_id} style={styles.fileItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fileName} numberOfLines={1}>
                            {file.name}
                          </Text>
                          <Text style={styles.fileSize}>
                            {formatSize(file.size)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => removeOfflineFile(file.node_id)}
                          style={styles.removeButton}
                        >
                          <Text style={styles.removeButtonText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ))}

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: "#3A0C0C",
                      borderColor: "#FF4444",
                      borderWidth: 1,
                      marginTop: 16,
                    },
                  ]}
                  onPress={clearAllOfflineFiles}
                >
                  <Text style={[styles.actionButtonText, { color: "#FF4444" }]}>
                    Clear All Offline Files
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Downloaded Projects */}
            <Text style={[styles.sectionTitle, { marginTop: 32 }]}>
              Downloaded Projects
            </Text>
            <Text style={styles.descriptionText}>
              Projects downloaded for offline viewing. You can see their files but
              can only open files that are also saved offline.
            </Text>

            {downloadedProjects.length === 0 ? (
              <Text style={styles.emptyText}>
                No projects downloaded for offline access.
              </Text>
            ) : (
              downloadedProjects.map((project) => {
                const projectData = JSON.parse(project.project_data);
                return (
                  <View key={project.project_id} style={styles.projectItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.projectName}>{projectData.name}</Text>
                      <Text style={styles.projectDate}>
                        Downloaded:{" "}
                        {new Date(project.accessed_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeDownloadedProject(project.project_id)}
                      style={styles.removeButton}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Profile Edit Modal (full) ──────────────────── */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowProfileModal(false)}>
              <Text style={styles.backText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity
              onPress={saveProfile}
              disabled={savingProfile}
              style={{ opacity: savingProfile ? 0.5 : 1 }}
            >
              {savingProfile ? (
                <ActivityIndicator color="#FF2A2A" size="small" />
              ) : (
                <Text style={[styles.backText, { color: "#FF2A2A" }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            {/* Banner */}
            <TouchableOpacity onPress={pickBannerImage} activeOpacity={0.7}>
              <View style={styles.bannerEditWrap}>
                {selectedBannerImage || user?.banner_url ? (
                  <Image
                    source={{ uri: selectedBannerImage || user?.banner_url }}
                    style={styles.bannerEditImage}
                  />
                ) : (
                  <View style={styles.bannerEditPlaceholder}>
                    <Text style={{ color: "#666", fontSize: 13 }}>Tap to set banner</Text>
                  </View>
                )}
                <View style={styles.bannerEditBadge}>
                  <Text style={styles.editBadgeText}>Edit</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Profile Picture */}
            <View style={styles.profileEditSection}>
              <TouchableOpacity onPress={pickImage} style={styles.profileImageEdit}>
                {selectedImage || user?.photo_url ? (
                  <Image
                    source={{ uri: selectedImage || user?.photo_url }}
                    style={styles.profileImageLarge}
                  />
                ) : (
                  <View style={styles.profilePlaceholderLarge}>
                    <Text style={styles.profilePlaceholderTextLarge}>
                      {user?.display_name?.charAt(0).toUpperCase() || "U"}
                    </Text>
                  </View>
                )}
                <View style={styles.editBadge}>
                  <Text style={styles.editBadgeText}>Edit</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.profileEditHint}>Tap to change photo</Text>
            </View>

            {/* Display Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={newDisplayName}
                onChangeText={setNewDisplayName}
                placeholder="Enter display name"
                placeholderTextColor="#666"
                autoCapitalize="words"
              />
            </View>

            {/* Username */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.input}
                value={editUsername}
                onChangeText={(t) => setEditUsername(t.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                placeholder="unique_username"
                placeholderTextColor="#666"
                autoCapitalize="none"
                maxLength={30}
              />
            </View>

            {/* Bio */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bio</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={newBio}
                onChangeText={setNewBio}
                placeholder="Tell us about yourself..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={300}
              />
              <Text style={styles.charCount}>{newBio.length}/300</Text>
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: "top" }]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Tell others about yourself..."
                placeholderTextColor="#666"
                multiline
                maxLength={500}
              />
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="+1 234 567 8900"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
              />
            </View>

            {/* Timezone */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Timezone</Text>
              <TouchableOpacity style={styles.input} onPress={() => setShowTzPicker(true)}>
                <Text style={{ color: editTimezone ? "#F5F5F5" : "#666", fontSize: 16 }}>
                  {editTimezone || "Select timezone..."}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Social Links */}
            <Text style={[styles.inputLabel, { marginTop: 8, marginBottom: 4 }]}>Social Links</Text>
            {SOCIAL_LINKS.map(({ key, label, placeholder }) => (
              <View key={key} style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { fontSize: 12 }]}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={editSocials[key]}
                  onChangeText={(t) => setEditSocials((p) => ({ ...p, [key]: t }))}
                  placeholder={placeholder}
                  placeholderTextColor="#666"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ))}

            {/* Show Projects Toggle */}
            <View style={[styles.switchRow, { marginVertical: 16 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Show Projects on Profile</Text>
                <Text style={styles.switchHint}>
                  When enabled, others can see which projects you belong to.
                </Text>
              </View>
              <Switch
                value={editShowProjects}
                onValueChange={setEditShowProjects}
                trackColor={{ false: "#3A3A3C", true: "#FF2A2A80" }}
                thumbColor={editShowProjects ? "#FF2A2A" : "#9A9A9A"}
              />
            </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Timezone picker modal ──────────────────────── */}
      <Modal visible={showTzPicker} transparent animationType="slide" onRequestClose={() => setShowTzPicker(false)}>
        <View style={styles.tzModalBackdrop}>
          <View style={[styles.tzModalCard, { maxHeight: "60%" }]}>
            <Text style={styles.tzModalTitle}>Select Timezone</Text>
            <ScrollView style={{ marginTop: 12 }}>
              {TIMEZONES.map((tz) => (
                <TouchableOpacity
                  key={tz}
                  style={[styles.tzItem, editTimezone === tz && styles.tzItemActive]}
                  onPress={() => { setEditTimezone(tz); setShowTzPicker(false); }}
                >
                  <Text style={[styles.tzText, editTimezone === tz && { color: "#FF2A2A" }]}>{tz}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.tzCancelBtn, { alignSelf: "flex-end", marginTop: 12 }]} onPress={() => setShowTzPicker(false)}>
              <Text style={styles.tzCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Dev API modal ──────────────────────────────── */}
      <Modal visible={showDevModal} transparent animationType="fade" onRequestClose={() => setShowDevModal(false)}>
        <View style={styles.tzModalBackdrop}>
          <View style={styles.tzModalCard}>
            <Text style={styles.tzModalTitle}>Backend API Base URL</Text>
            <Text style={styles.devModalText}>
              Enter the full API url including /api.{"\n"}Example: http://192.168.1.100:8000/api
            </Text>
            <TextInput
              style={styles.devModalInput}
              placeholder="http://host:port/api"
              placeholderTextColor="#777"
              value={apiInput}
              onChangeText={setApiInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.devModalActions}>
              <TouchableOpacity style={styles.devModalBtn} onPress={() => setShowDevModal(false)} disabled={savingApi}>
                <Text style={styles.devModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.devModalBtn, { backgroundColor: "#3A0C0C", borderWidth: 1, borderColor: "#FF4444" }]}
                onPress={resetApiOverride}
                disabled={savingApi}
              >
                {savingApi ? <ActivityIndicator color="#F5F5F5" /> : <Text style={[styles.devModalBtnText, { color: "#FF4444" }]}>Reset</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.devModalBtn, { backgroundColor: "#FF2A2A" }]} onPress={saveApiOverride} disabled={savingApi}>
                {savingApi ? <ActivityIndicator color="#F5F5F5" /> : <Text style={[styles.devModalBtnText, { color: "#F5F5F5" }]}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Conflict Resolution test ───────────────────── */}
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
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backText: {
    color: "#FF2A2A",
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9A9A9A",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F5F5F5",
    marginBottom: 8,
  },
  menuItem: {
    backgroundColor: "#1A1A1A",
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuItemText: {
    fontSize: 16,
    color: "#F5F5F5",
  },
  menuItemSubtext: {
    fontSize: 12,
    color: "#9A9A9A",
    marginTop: 4,
  },
  menuItemArrow: {
    fontSize: 18,
    color: "#9A9A9A",
  },
  profilePreview: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  profilePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FF2A2A",
    justifyContent: "center",
    alignItems: "center",
  },
  profilePlaceholderText: {
    fontSize: 18,
    color: "#F5F5F5",
    fontWeight: "700",
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#111111",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F5F5F5",
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  actionButton: {
    backgroundColor: "#FF2A2A",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonText: {
    color: "#F5F5F5",
    fontSize: 16,
    fontWeight: "600",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  emptyText: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
    marginVertical: 16,
  },
  descriptionText: {
    color: "#9A9A9A",
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  projectGroup: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  projectGroupTitle: {
    fontSize: 12,
    color: "#FF2A2A",
    fontWeight: "600",
    marginBottom: 8,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
  },
  fileName: {
    fontSize: 14,
    color: "#F5F5F5",
  },
  fileSize: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#3A0C0C",
    borderRadius: 8,
  },
  removeButtonText: {
    color: "#FF4444",
    fontSize: 12,
    fontWeight: "600",
  },
  projectItem: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    flexDirection: "row",
    alignItems: "center",
  },
  projectName: {
    fontSize: 16,
    color: "#F5F5F5",
    fontWeight: "600",
  },
  projectDate: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  // Profile edit modal
  profileEditSection: {
    alignItems: "center",
    marginVertical: 16,
  },
  profileImageEdit: {
    position: "relative",
  },
  profileImageLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profilePlaceholderLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#FF2A2A",
    justifyContent: "center",
    alignItems: "center",
  },
  profilePlaceholderTextLarge: {
    fontSize: 48,
    color: "#F5F5F5",
    fontWeight: "700",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#333",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#111111",
  },
  editBadgeText: {
    color: "#F5F5F5",
    fontSize: 12,
    fontWeight: "600",
  },
  profileEditHint: {
    color: "#666",
    fontSize: 13,
    marginTop: 12,
  },
  // Banner edit
  bannerEditWrap: {
    width: "100%",
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
    marginBottom: 8,
    position: "relative",
  },
  bannerEditImage: {
    width: "100%",
    height: 120,
    resizeMode: "cover",
  },
  bannerEditPlaceholder: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 12,
  },
  bannerEditBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "#333",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#111111",
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: "#9A9A9A",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    color: "#F5F5F5",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  bioInput: {
    height: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: "#666",
    textAlign: "right",
    marginTop: 4,
  },
  // Switch row
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  switchHint: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  // Connection & Sync styles
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  connectionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  connectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F5F5F5",
  },
  connectionSubtitle: {
    fontSize: 12,
    color: "#9A9A9A",
    marginTop: 2,
  },
  refreshButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF2A2A",
  },
  refreshButtonText: {
    color: "#FF2A2A",
    fontSize: 14,
    fontWeight: "600",
  },
  syncQueueInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
  },
  syncQueueText: {
    fontSize: 14,
    color: "#FF9500",
    fontWeight: "500",
  },
  syncQueueHint: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  storageStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  storageStatLabel: {
    fontSize: 14,
    color: "#9A9A9A",
  },
  storageStatValue: {
    fontSize: 14,
    color: "#F5F5F5",
    fontWeight: "500",
  },
  pendingQueueCount: {
    fontSize: 48,
    fontWeight: "700",
    color: "#FF9500",
    textAlign: "center",
    marginVertical: 8,
  },
  pendingQueueDescription: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },
  // Timezone picker modal
  tzModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  tzModalCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333",
    width: "100%",
  },
  tzModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F5F5F5",
    marginBottom: 8,
  },
  tzItem: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  tzItemActive: {
    backgroundColor: "#1A0505",
  },
  tzText: {
    fontSize: 15,
    color: "#F5F5F5",
  },
  tzCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#2A2A2A",
  },
  tzCancelText: {
    color: "#F5F5F5",
    fontSize: 14,
    fontWeight: "600",
  },
  // Dev modal
  devModalText: {
    fontSize: 14,
    color: "#CCCCCC",
    marginBottom: 16,
    lineHeight: 20,
  },
  devModalInput: {
    backgroundColor: "#121212",
    color: "#F5F5F5",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: 16,
  },
  devModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  devModalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#2A2A2A",
  },
  devModalBtnText: {
    color: "#F5F5F5",
    fontSize: 14,
    fontWeight: "600",
  },
});

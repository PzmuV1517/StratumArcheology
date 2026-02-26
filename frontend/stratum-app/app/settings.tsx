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
  const _router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { replayOnboarding } = useOnboarding();

  // Storage stats
  const [stratumUsed, setStratumUsed] = useState(0);
  const [otherUsed, setOtherUsed] = useState(0);
  const [totalStorage, setTotalStorage] = useState(64 * 1e9); // Default 64GB
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [offlineStorageStats, setOfflineStorageStats] =
    useState<OfflineStorageStats | null>(null);

  // Offline files
  const [offlineFiles, setOfflineFiles] = useState<OfflineFile[]>([]);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  // Connection status - use a ref to track actual status
  const [connectionStatus, setConnectionStatus] = useState<
    "unknown" | "connected" | "disconnected"
  >("unknown");
  const connectionCheckedRef = React.useRef(false);

  // Network state (real-time from NetInfo)
  const [networkState, setNetworkState] = useState<NetInfoState | null>(null);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);

  // Downloaded projects
  const [downloadedProjects, setDownloadedProjects] = useState<any[]>([]);

  // Profile settings
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(user?.display_name || "");
  const [newPhotoUrl, setNewPhotoUrl] = useState(user?.photo_url || "");
  const [newBio, setNewBio] = useState(user?.bio || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Subscribe to network state changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkState(state);
      // Only update connection status if we haven't done a manual check yet
      // This prevents auto-setting to 'connected' when the user hasn't verified backend connectivity
      if (!connectionCheckedRef.current) {
        // Set to unknown until user manually checks - network available != backend connected
        if (state.isConnected === false) {
          setConnectionStatus("disconnected");
        }
        // Don't auto-set to connected - let user verify with the check button
      }
    });

    // Get initial state
    NetInfo.fetch().then((state) => {
      setNetworkState(state);
      if (state.isConnected === false) {
        setConnectionStatus("disconnected");
      }
      // Don't auto-set to connected - keep unknown until manual check
    });

    return () => unsubscribe();
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

  // Load storage info on mount
  useEffect(() => {
    loadStorageInfo();
    loadOfflineFiles();
    loadDownloadedProjects();
    loadPendingQueue();
  }, [loadPendingQueue]);

  const loadStorageInfo = async () => {
    if (Platform.OS === "web") {
      setLoadingStorage(false);
      return;
    }

    try {
      // Get STRATUM offline files size
      const stratumSize = await offlineFilesStorage.getOfflineStorageSize();
      setStratumUsed(stratumSize);

      // Get offline queue storage stats
      try {
        const queueStats = await getOfflineStorageStats();
        setOfflineStorageStats(queueStats);
        // Add queue storage to stratum size for more accurate total
        if (queueStats && queueStats.totalSize) {
          setStratumUsed((prev) => prev + queueStats.totalSize * 1024); // Convert KB to bytes
        }
      } catch (queueErr) {
        console.warn("Failed to get queue storage stats:", queueErr);
      }

      // Get device storage info - wrap in try-catch for Expo Go compatibility
      try {
        if (typeof FileSystem.getFreeDiskStorageAsync === "function") {
          const freeSpace = await FileSystem.getFreeDiskStorageAsync();

          // Also try to get total disk storage for more accurate calculation
          let totalDiskSpace = freeSpace;
          if (typeof FileSystem.getTotalDiskCapacityAsync === "function") {
            try {
              totalDiskSpace = await FileSystem.getTotalDiskCapacityAsync();
              setTotalStorage(totalDiskSpace);
              setOtherUsed(totalDiskSpace - freeSpace - stratumSize);
              setStorageAvailable(true);
            } catch {
              // Fallback: estimate total based on free space
              const estimatedTotal = freeSpace + stratumSize + 20 * 1e9; // Rough estimate
              setTotalStorage(estimatedTotal);
              setOtherUsed(estimatedTotal - freeSpace - stratumSize);
              setStorageAvailable(true);
            }
          } else {
            // Fallback: estimate total based on free space
            const estimatedTotal = freeSpace + stratumSize + 20 * 1e9;
            setTotalStorage(estimatedTotal);
            setOtherUsed(estimatedTotal - freeSpace - stratumSize);
            setStorageAvailable(true);
          }
        } else {
          // Fallback for Expo Go where this API may not be available
          console.warn("Storage APIs not available, using fallback values");
          setTotalStorage(64 * 1e9); // Default 64GB
          setOtherUsed(32 * 1e9); // Estimate 32GB used by other
        }
      } catch (storageErr) {
        console.warn("Storage API error:", storageErr);
        // Fallback values
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

  const checkConnection = async () => {
    setCheckingConnection(true);
    connectionCheckedRef.current = true; // Mark that we've done a manual check
    try {
      // First check network connectivity via NetInfo
      const netState = await NetInfo.fetch();

      if (!netState.isConnected) {
        setConnectionStatus("disconnected");
        showAlert(
          "No Network",
          "Your device is not connected to a network. Check your Wi-Fi or cellular data.",
        );
        setCheckingConnection(false);
        return;
      }

      if (!netState.isInternetReachable) {
        setConnectionStatus("disconnected");
        showAlert(
          "No Internet",
          "Network connected but internet is not reachable. Try again later.",
        );
        setCheckingConnection(false);
        return;
      }

      // Now try to reach the STRATUM backend using the health endpoint
      const response = await api.get("/health");
      if (response.status === 200) {
        setConnectionStatus("connected");
        const pendingMessage =
          pendingQueueCount > 0
            ? `\n\n${pendingQueueCount} pending action(s) waiting to sync.`
            : "";
        showAlert(
          "Connected ✓",
          `Successfully connected to STRATUM backend.${pendingMessage}`,
        );
      } else {
        setConnectionStatus("disconnected");
        showAlert("Connection Failed", "Could not reach STRATUM backend.");
      }
    } catch {
      setConnectionStatus("disconnected");
      showAlert(
        "Connection Failed",
        "Could not reach STRATUM backend. The server may be temporarily unavailable.",
      );
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

  const pickImage = async () => {
    try {
      // Request permissions first on iOS
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showAlert(
          "Permission Required",
          "Please allow access to your photo library to upload a profile picture.",
        );
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
        // Check file size (50MB max) - fileSize may not always be available
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

  const uploadProfileImage = async (): Promise<string | null> => {
    if (!selectedImage) return null;

    try {
      // Create form data for upload
      const formData = new FormData();
      const filename = `profile_${user?.id}_${Date.now()}.jpg`;

      if (Platform.OS === "web") {
        // Web: fetch blob from URI
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        formData.append("file", blob, filename);
      } else {
        // Native: use file URI directly
        formData.append("file", {
          uri: selectedImage,
          type: "image/jpeg",
          name: filename,
        } as any);
      }

      // Upload to profile pictures endpoint
      const response = await api.post("/files/profile-picture", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      return response.data.url;
    } catch (error: any) {
      console.error("Failed to upload profile image:", error);
      // If upload fails, try using base64 data URL as fallback
      if (selectedImage.startsWith("data:") || Platform.OS === "web") {
        return selectedImage; // Use data URL directly
      }
      throw error;
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      let photoUrl = newPhotoUrl;

      // Upload new image if selected
      if (selectedImage && selectedImage !== user?.photo_url) {
        try {
          const uploadedUrl = await uploadProfileImage();
          if (uploadedUrl) {
            photoUrl = uploadedUrl;
          }
        } catch {
          // Continue with existing photo URL if upload fails
          console.warn("Profile image upload failed, keeping existing photo");
        }
      }

      const updates: { display_name?: string; photo_url?: string; bio?: string } =
        {};
      if (newDisplayName !== user?.display_name) {
        updates.display_name = newDisplayName;
      }
      if (photoUrl !== user?.photo_url) {
        updates.photo_url = photoUrl;
      }
      if (newBio !== (user?.bio || "")) {
        updates.bio = newBio;
      }

      if (Object.keys(updates).length > 0) {
        await api.patch("/auth/me", updates);
        if (refreshUser) {
          await refreshUser();
        }
        showAlert("Success", "Profile updated successfully.");
      }

      setShowProfileModal(false);
      setSelectedImage(null);
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const openProfileModal = () => {
    setNewDisplayName(user?.display_name || "");
    setNewPhotoUrl(user?.photo_url || "");
    setNewBio(user?.bio || "");
    setSelectedImage(null);
    setShowProfileModal(true);
  };

  const handleReplayTutorial = () => {
    showAlert(
      "Replay Tutorial?",
      "This will show you the STRATUM onboarding walkthrough again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start Tutorial",
          onPress: () => {
            replayOnboarding();
          },
        },
      ],
    );
  };

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Profile Settings Section - Moved above Storage */}
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
                  Change photo and display name
                </Text>
              </View>
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

        {/* Storage Section - Mobile Only */}
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
                  {offlineFiles.length} file(s) • {formatSize(stratumUsed)}
                </Text>
              </View>
              <Text style={styles.menuItemArrow}>→</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Connection & Sync Section */}
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
      </ScrollView>

      {/* Offline Usage Modal */}
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

      {/* Profile Edit Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfileModal(false)}
      >
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

          <ScrollView style={styles.modalContent}>
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
          </ScrollView>
        </View>
      </Modal>
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
    marginVertical: 24,
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
  inputGroup: {
    marginBottom: 20,
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
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    color: "#F5F5F5",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    height: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: "#666",
    textAlign: "right",
    marginTop: 4,
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
  // Storage stats in modal
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
});

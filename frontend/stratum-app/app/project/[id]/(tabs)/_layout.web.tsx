/**
 * @file
 * Web-specific project tabs layout.
 *
 * Configures tab navigation for project pages optimized for web browsers
 * with a sidebar similar to the main app layout.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 */
import { Tabs, usePathname, useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Share,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useProjectDetail } from "@/contexts/ProjectDetailContext";
import EditProjectModal from "@/components/project/EditProjectModal";
import { projectService } from "@/services/projectService";
import { showAlert } from "@/utils/alert";
import { useColorScheme } from "@/hooks/use-color-scheme";

/* ─────────────────────────────────────────────
 *  Constants
 * ─────────────────────────────────────────── */
const COLLAPSED_W = 56;
const EXPANDED_W = COLLAPSED_W + 188; // 244
const ROW_H = 72;
const ANIM_MS = 200;
const ACTIVE = "#FF2A2A";

const PROJECT_NAV_ITEMS: {
  name: string;
  label: string;
  icon: string;
}[] = [
  { name: "index", label: "Overview", icon: "house.fill" },
  { name: "notes", label: "Notes", icon: "note.text" },
  { name: "artefacts", label: "Artefacts", icon: "cube.fill" },
  { name: "chat", label: "Chat", icon: "bubble.left.and.bubble.right.fill" },
  { name: "gallery", label: "Gallery", icon: "photo.on.rectangle" },
  { name: "gps", label: "GPS Map", icon: "map" },
  { name: "history", label: "Time Machine", icon: "clock.arrow.circlepath" },
  { name: "matrix", label: "Matrix", icon: "chart.bar.fill" },
  { name: "wheeler", label: "Wheeler", icon: "chart.bar.doc.horizontal" },
];

/* ─────────────────────────────────────────────
 *  Burger icon (three lines)
 * ─────────────────────────────────────────── */
function Burger({ color }: { color: string }) {
  return (
    <View style={bStyles.wrap}>
      <View style={[bStyles.line, { backgroundColor: color }]} />
      <View style={[bStyles.line, { backgroundColor: color }]} />
      <View style={[bStyles.line, { backgroundColor: color }]} />
    </View>
  );
}
const bStyles = StyleSheet.create({
  wrap: { width: 24, height: 18, justifyContent: "space-between" },
  line: { width: 24, height: 3, borderRadius: 1.5 },
});

/* ─────────────────────────────────────────────
 *  Main component
 * ─────────────────────────────────────────── */
export default function ProjectTabsLayoutWeb() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ id: string }>();
  const projectId = params.id;
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const transferStyles = useMemo(
    () => createTransferStyles(isDarkMode),
    [isDarkMode],
  );
  const textPrimary = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const textSecondary = isDarkMode ? "#9A9A9A" : "#666666";
  const chevronColor = isDarkMode ? "#666666" : "#8A8A8A";

  const {
    project,
    setShowMembersModal,
    setShowFilesOverlay,
    onDeleteProject,
    onExitProject,
    refreshProject,
    isOwner,
    members,
    currentUser,
  } = useProjectDetail();

  /* ─────  Remember last known project name to avoid flicker  ───── */
  const lastNameRef = useRef(project?.name || "");
  if (project?.name) lastNameRef.current = project.name;
  const displayName = lastNameRef.current || "Loading...";

  /* ─────  Sidebar collapse state  ───── */
  const [collapsed, setCollapsed] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const widthAnim = useRef(new Animated.Value(EXPANDED_W)).current;
  // Always tracks the real animated sidebar edge - used to anchor the More menu
  const menuLeft = useRef(Animated.add(widthAnim, new Animated.Value(8))).current;

  const toggle = useCallback(() => {
    const target = collapsed ? EXPANDED_W : COLLAPSED_W;
    Animated.timing(widthAnim, {
      toValue: target,
      duration: ANIM_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
    setCollapsed(!collapsed);
  }, [collapsed, widthAnim]);

  /* ─────  Active tab detection  ───── */
  const isActive = useCallback(
    (tabName: string) => {
      if (tabName === "index") {
        return (
          pathname === `/project/${projectId}` ||
          pathname === `/project/${projectId}/`
        );
      }
      return pathname.includes(`/project/${projectId}/${tabName}`);
    },
    [pathname, projectId],
  );

  const handleNavigate = useCallback(
    (tab: string) => {
      if (tab === "files") {
        setShowFilesOverlay(true);
        return;
      }
      if (tab === "index") {
        router.push(`/project/${projectId}` as any);
      } else {
        router.push(`/project/${projectId}/${tab}` as any);
      }
    },
    [projectId, router, setShowFilesOverlay],
  );

  const handleBackPress = useCallback(() => {
    router.push("/(tabs)/projects");
  }, [router]);

  const handleMoreMenuAction = useCallback(
    (id: string) => {
      setShowMoreMenu(false);
      switch (id) {
        case "back":
          router.push("/(tabs)/projects");
          break;
        case "edit":
          setShowEditModal(true);
          break;
        case "members":
          setShowMembersModal(true);
          break;
        case "export":
          if (project) {
            Share.share({
              title: project.name,
              message: `Check out the project "${project.name}" on Stratum!`,
            }).catch(() => {});
          }
          break;
        case "exit": {
          const otherMembers = members.filter(
            (m) => (m.user_id || m.id) !== currentUser?.id,
          );
          if (isOwner && otherMembers.length === 0) {
            showAlert(
              "Cannot Leave",
              "You are the only member of this project. Delete the project instead.",
            );
          } else if (isOwner) {
            setShowTransferModal(true);
          } else {
            showAlert(
              "Leave Project?",
              "Are you sure you want to leave this project?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Leave",
                  style: "destructive",
                  onPress: () => onExitProject?.(),
                },
              ],
            );
          }
          break;
        }
        case "delete":
          showAlert(
            "Delete Project?",
            "This action cannot be undone. All data will be permanently deleted.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => onDeleteProject?.(),
              },
            ],
          );
          break;
        case "publicise": {
          if (project?.id) {
            const doToggle = async () => {
              try {
                await projectService.togglePublicise(project.id);
                await refreshProject();
              } catch {
                showAlert("Error", "Failed to update project visibility.");
              }
            };

            if (project.is_public) {
              showAlert(
                "Privatise Project?",
                "This project will no longer be visible in Unearthed. Only members will be able to access it.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Privatise", onPress: doToggle },
                ],
              );
            } else {
              showAlert(
                "AI Content Consent",
                "Publishing this project will allow AI to read all notes and activities to generate a public History Review visible to everyone.\n\nDo you agree to this use of your project's content?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Agree & Continue",
                    onPress: () =>
                      showAlert(
                        "Publicise Project?",
                        "This project will be visible to everyone in Unearthed. A History Review will be generated automatically.",
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Publicise", onPress: doToggle },
                        ],
                      ),
                  },
                ],
              );
            }
          }
          break;
        }
      }
    },
    [
      project,
      router,
      setShowMembersModal,
      onDeleteProject,
      onExitProject,
      refreshProject,
      isOwner,
      members,
      currentUser?.id,
    ],
  );

  const moreMenuItems = [
    { id: "edit", title: "Edit Project", icon: "pencil" },
    { id: "members", title: "Members", icon: "person.2" },
    ...(isOwner
      ? [
          {
            id: "publicise",
            title: project?.is_public ? "Privatise Project" : "Publicise Project",
            icon: project?.is_public ? "eye.slash" : "eye",
          },
        ]
      : []),
    { id: "export", title: "Export Project", icon: "square.and.arrow.up" },
    {
      id: "exit",
      title: "Exit Project",
      icon: "rectangle.portrait.and.arrow.right",
      color: "#FF2A2A",
    },
    { id: "delete", title: "Delete Project", icon: "trash", color: "#FF2A2A" },
  ];

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Outer shell - full viewport, column direction */}
        <View style={styles.shell}>
          {/* ══════════════════════════════════════════
           *  HEADER ROW - burger + project name (never collapses)
           * ════════════════════════════════════════ */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.burgerBtn}
              onPress={toggle}
              activeOpacity={0.8}
            >
              <Burger color={textPrimary} />
            </TouchableOpacity>
            <Text style={styles.logoText} numberOfLines={1}>
              {displayName}
            </Text>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBackPress}
              activeOpacity={0.7}
            >
              <IconSymbol name="chevron.left" size={16} color="#FF2A2A" />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          </View>

          {/* ══════════════════════════════════════════
           *  BODY ROW - sidebar nav + page content
           * ════════════════════════════════════════ */}
          <View style={styles.bodyRow}>
            {/* Sidebar nav - driven by widthAnim */}
            <Animated.View style={[styles.sidebar, { width: widthAnim }]}>
              {/* Navigation items */}
              {PROJECT_NAV_ITEMS.map(({ name, label, icon }) => {
                const active = isActive(name);
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.navItem, active && styles.navItemActive]}
                    onPress={() => handleNavigate(name)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.iconSlot}>
                      <IconSymbol
                        name={icon as any}
                        size={26}
                        color={active ? ACTIVE : textSecondary}
                      />
                    </View>
                    <Text
                      style={[styles.navLabel, active && styles.navLabelActive]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Spacer to push Files + More to bottom */}
              <View style={{ flex: 1 }} />

              {/* Files button */}
              <TouchableOpacity
                style={styles.moreBtn}
                onPress={() => setShowFilesOverlay(true)}
                activeOpacity={0.7}
              >
                <View style={styles.iconSlot}>
                  <IconSymbol name="folder.fill" size={26} color={textSecondary} />
                </View>
                <Text style={styles.navLabel} numberOfLines={1}>
                  Files
                </Text>
              </TouchableOpacity>

              {/* More button at bottom */}
              <TouchableOpacity
                style={styles.moreBtn}
                onPress={() => setShowMoreMenu(!showMoreMenu)}
                activeOpacity={0.7}
              >
                <View style={styles.iconSlot}>
                  <IconSymbol
                    name="ellipsis.circle"
                    size={26}
                    color={textSecondary}
                  />
                </View>
                <Text style={styles.navLabel} numberOfLines={1}>
                  More
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Page content */}
            <View style={styles.content}>
              <Tabs
                screenOptions={{
                  headerShown: false,
                  tabBarStyle: { display: "none" },
                }}
                initialRouteName="index"
              >
                <Tabs.Screen name="index" options={{ title: "Overview" }} />
                <Tabs.Screen name="notes" options={{ title: "Notes" }} />
                <Tabs.Screen name="artefacts" options={{ title: "Artefacts" }} />
                <Tabs.Screen name="matrix" options={{ title: "Matrix" }} />
                <Tabs.Screen name="chat" options={{ title: "Chat" }} />
                <Tabs.Screen name="gallery" options={{ href: null }} />
                <Tabs.Screen name="gps" options={{ href: null }} />
                <Tabs.Screen name="history" options={{ href: null }} />
                <Tabs.Screen name="tools" options={{ href: null }} />
                <Tabs.Screen name="wheeler" options={{ href: null }} />
              </Tabs>
            </View>
          </View>
        </View>

        {/* More menu - anchored to right of sidebar */}
        {showMoreMenu && (
          <>
            {/* Backdrop - full screen, dismisses menu */}
            <TouchableOpacity
              style={[StyleSheet.absoluteFillObject, { zIndex: 100 }]}
              activeOpacity={1}
              onPress={() => setShowMoreMenu(false)}
            />
            {/* Card - follows the live animated sidebar edge */}
            <Animated.View
              style={[
                styles.moreMenuCard,
                {
                  position: "absolute",
                  zIndex: 101,
                  left: menuLeft,
                  bottom: 16,
                },
              ]}
            >
              {moreMenuItems.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.moreMenuItem,
                    index < moreMenuItems.length - 1 && styles.moreMenuItemBorder,
                  ]}
                  onPress={() => handleMoreMenuAction(item.id)}
                  activeOpacity={0.7}
                >
                  <IconSymbol
                    name={item.icon as any}
                    size={20}
                    color={item.color || textPrimary}
                  />
                  <Text
                    style={[
                      styles.moreMenuItemText,
                      item.color && { color: item.color },
                    ]}
                  >
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          </>
        )}
      </GestureHandlerRootView>

      <EditProjectModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
      />

      {/* Transfer leadership modal */}
      <Modal
        visible={showTransferModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTransferModal(false)}
      >
        <View style={transferStyles.backdrop}>
          <View style={transferStyles.card}>
            <Text style={transferStyles.title}>Transfer Leadership</Text>
            <Text style={transferStyles.desc}>
              You must transfer ownership before leaving. Pick a new leader or choose
              at random.
            </Text>

            <ScrollView style={transferStyles.list}>
              {members
                .filter((m) => (m.user_id || m.id) !== currentUser?.id)
                .map((m) => (
                  <TouchableOpacity
                    key={m.user_id || m.id}
                    style={transferStyles.memberRow}
                    activeOpacity={0.7}
                    disabled={transferLoading}
                    onPress={async () => {
                      const uid = m.user_id || m.id;
                      if (!uid || !project?.id) return;
                      setTransferLoading(true);
                      try {
                        await projectService.transferOwnership(project.id, uid);
                        await projectService.removeMember(
                          project.id,
                          currentUser.id,
                        );
                        setShowTransferModal(false);
                        router.replace("/(tabs)/projects");
                      } catch {
                        showAlert("Error", "Failed to transfer ownership.");
                      } finally {
                        setTransferLoading(false);
                      }
                    }}
                  >
                    <View style={transferStyles.avatar}>
                      <Text style={transferStyles.avatarText}>
                        {m.display_name?.[0]?.toUpperCase() || "?"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={transferStyles.name}>{m.display_name}</Text>
                      <Text style={transferStyles.role}>{m.role}</Text>
                    </View>
                    <IconSymbol
                      name="chevron.right"
                      size={16}
                      color={chevronColor}
                    />
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={transferStyles.footer}>
              <TouchableOpacity
                style={transferStyles.randomBtn}
                disabled={transferLoading}
                activeOpacity={0.7}
                onPress={async () => {
                  const others = members.filter(
                    (m) => (m.user_id || m.id) !== currentUser?.id,
                  );
                  if (others.length === 0 || !project?.id) return;
                  const pick = others[Math.floor(Math.random() * others.length)];
                  const uid = pick.user_id || pick.id;
                  if (!uid) return;
                  setTransferLoading(true);
                  try {
                    await projectService.transferOwnership(project.id, uid);
                    await projectService.removeMember(project.id, currentUser.id);
                    setShowTransferModal(false);
                    router.replace("/(tabs)/projects");
                  } catch {
                    showAlert("Error", "Failed to transfer ownership.");
                  } finally {
                    setTransferLoading(false);
                  }
                }}
              >
                <IconSymbol name="dice" size={18} color="#FF2A2A" />
                <Text style={transferStyles.randomText}>Pick Random</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={transferStyles.cancelBtn}
                onPress={() => setShowTransferModal(false)}
                disabled={transferLoading}
                activeOpacity={0.7}
              >
                <Text style={transferStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

/* ─────────────────────────────────────────────
 *  Styles
 * ─────────────────────────────────────────── */
const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    /* Outer container - column */
    shell: {
      flex: 1,
      flexDirection: "column",
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
    },

    /* ── Header row - always full width, never animates ─── */
    headerRow: {
      height: ROW_H,
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 0,
      paddingLeft: 8,
      gap: 4,
    },
    burgerBtn: {
      width: 56,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 28,
    },
    logoText: {
      fontSize: 20,
      fontWeight: "800",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      letterSpacing: 2,
      flexShrink: 1,
    },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: 12,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: "rgba(255, 42, 42, 0.10)",
      gap: 4,
    },
    backBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#FF2A2A",
    },

    /* ── Body row ──────────────────────────────── */
    bodyRow: {
      flex: 1,
      flexDirection: "row",
    },

    /* Sidebar nav - same bg as page for seamless look */
    sidebar: {
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
      overflow: "hidden",
      paddingTop: 4,
      paddingBottom: 8,
      paddingLeft: 12,
    },

    /* ── Nav items ─────────────────────────────── */
    navItem: {
      height: 44,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      overflow: "hidden",
    },
    navItemActive: {
      backgroundColor: "rgba(255, 42, 42, 0.12)",
    },
    navLabel: {
      fontSize: 15,
      fontWeight: "500",
      color: isDarkMode ? "#9A9A9A" : "#666666",
      flexShrink: 1,
    },
    navLabelActive: {
      color: ACTIVE,
      fontWeight: "600",
    },

    /* Fixed-width icon column - icons stay centred when collapsed */
    iconSlot: {
      width: COLLAPSED_W - 10,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },

    /* ── Page content ──────────────────────────── */
    content: {
      flex: 1,
      overflow: "hidden" as any,
    },

    /* More button at bottom of sidebar */
    moreBtn: {
      height: 44,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      overflow: "hidden",
      marginTop: 8,
      marginBottom: 8,
    },

    moreMenuCard: {
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
      minWidth: 250,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDarkMode ? 0.3 : 0.14,
      shadowRadius: 8,
      elevation: 8,
    },
    moreMenuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
    },
    moreMenuItemText: {
      fontSize: 15,
      fontWeight: "500",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
    },
    moreMenuItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    },
  });

const createTransferStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDarkMode ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.24)",
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      width: 420,
      maxHeight: "80%",
      backgroundColor: isDarkMode ? "#1A1A1A" : "#FFFFFF",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
      padding: 24,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      marginBottom: 8,
    },
    desc: {
      fontSize: 14,
      color: isDarkMode ? "#9A9A9A" : "#666666",
      lineHeight: 20,
      marginBottom: 16,
    },
    list: {
      maxHeight: 300,
    },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 10,
      gap: 12,
      marginBottom: 4,
      backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDarkMode ? "#2A2A2A" : "#E8E8E8",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 15,
      fontWeight: "700",
    },
    name: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 15,
      fontWeight: "600",
    },
    role: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontSize: 12,
      textTransform: "capitalize",
    },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 16,
      gap: 12,
    },
    randomBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: "rgba(255, 42, 42, 0.12)",
    },
    randomText: {
      color: "#FF2A2A",
      fontSize: 15,
      fontWeight: "600",
    },
    cancelBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: isDarkMode ? "#2A2A2A" : "#EFEFEF",
      borderWidth: 1,
      borderColor: isDarkMode ? "transparent" : "#D9D9D9",
    },
    cancelText: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontSize: 15,
      fontWeight: "600",
    },
  });

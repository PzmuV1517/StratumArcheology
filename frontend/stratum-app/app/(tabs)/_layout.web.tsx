/**
 * @file
 * Web-specific tab bar layout.
 *
 * Configures tab navigation optimized for web browsers.
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
import { Tabs, usePathname, useRouter } from "expo-router";
import React, { useState, useRef, useCallback } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/contexts/AuthContext";
import UsernamePromptModal from "@/components/UsernamePromptModal";

/* ─────────────────────────────────────────────
 *  Constants
 * ─────────────────────────────────────────── */
const COLLAPSED_W = 56;
const EXPANDED_W = COLLAPSED_W + 188; // 244
const ROW_H = 72;
const ANIM_MS = 200;
const ACTIVE = "#FF2A2A";
const INACTIVE = "#9A9A9A";
const PAGE_BG = "#111111";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BORDER = "#2A2A2A";

const BASE_NAV_ITEMS = [
  { name: "index", label: "Overview", icon: "house.fill" as const, path: "/" },
  {
    name: "projects",
    label: "Projects",
    icon: "folder.fill" as const,
    path: "/projects",
  },
  {
    name: "explore",
    label: "Unearthed",
    icon: "globe.americas.fill" as const,
    path: "/explore",
  },
  {
    name: "messages",
    label: "Messages",
    icon: "message.fill" as const,
    path: "/messages",
  },
] as const;

/* ─────────────────────────────────────────────
 *  Burger icon (three lines)
 * ─────────────────────────────────────────── */
function Burger() {
  return (
    <View style={bStyles.wrap}>
      <View style={bStyles.line} />
      <View style={bStyles.line} />
      <View style={bStyles.line} />
    </View>
  );
}
const bStyles = StyleSheet.create({
  wrap: { width: 24, height: 18, justifyContent: "space-between" },
  line: { width: 24, height: 3, borderRadius: 1.5, backgroundColor: "#F5F5F5" },
});

/* ─────────────────────────────────────────────
 *  Root layout
 * ─────────────────────────────────────────── */
export default function TabLayout() {
  const { user, logout } = useAuth();
  const canAccessEmonument = Boolean(
    user?.is_emonument_privileged || user?.is_dashboard_admin,
  );
  const [usernameSet, setUsernameSet] = useState(false);
  const needsUsername = !!user && !user.username && !usernameSet;
  const handleUsernameComplete = useCallback(() => setUsernameSet(true), []);

  const [collapsed, setCollapsed] = useState(false);
  const widthAnim = useRef(new Animated.Value(EXPANDED_W)).current;

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const toggle = useCallback(() => {
    const toValue = collapsed ? EXPANDED_W : COLLAPSED_W;
    setCollapsed((c) => !c);
    Animated.timing(widthAnim, {
      toValue,
      duration: ANIM_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [collapsed, widthAnim]);

  const pathname = usePathname();
  const router = useRouter();
  const isActive = useCallback(
    (path: string) => {
      if (path === "/")
        return pathname === "/" || pathname === "" || pathname === "/index";
      // Highlight messages tab when in DM conversation
      if (path === "/messages" && pathname.includes("/dm/")) return true;
      return pathname.startsWith(path);
    },
    [pathname],
  );

  const performLogout = async () => {
    try {
      setIsLoggingOut(true);
      setShowProfileMenu(false);
      await logout();
      router.replace("/(auth)/login");
    } catch (e) {
      console.error("Logout failed:", e);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSettingsClick = () => {
    setShowProfileMenu(false);
    router.push("/settings");
  };

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user) return "?";
    if (user.display_name) return user.display_name.charAt(0).toUpperCase();
    if (user.username) return user.username.charAt(0).toUpperCase();
    if (user.email) return user.email.charAt(0).toUpperCase();
    return "?";
  };

  const navItems = canAccessEmonument
    ? [
        ...BASE_NAV_ITEMS,
        {
          name: "emonument",
          label: "eMonument",
          icon: "mountain.2.fill" as const,
          path: "/emonument",
        },
      ]
    : BASE_NAV_ITEMS;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <UsernamePromptModal
        visible={needsUsername}
        onComplete={handleUsernameComplete}
      />

      {/* Outer shell — full viewport, column direction */}
      <View style={s.shell}>
        {/* ══════════════════════════════════════════
         *  HEADER ROW — burger + STRATUM (never collapses)
         * ════════════════════════════════════════ */}
        <View style={s.headerRow}>
          <TouchableOpacity style={s.burgerBtn} onPress={toggle} activeOpacity={0.8}>
            <Burger />
          </TouchableOpacity>
          <Text style={s.logoText} numberOfLines={1}>
            STRATUM
          </Text>

          {/* Profile button on the right */}
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={s.profileBtn}
            onPress={() => setShowProfileMenu(!showProfileMenu)}
            activeOpacity={0.8}
          >
            {user?.photo_url ? (
              <Image source={{ uri: user.photo_url }} style={s.profileImage} />
            ) : (
              <View style={s.profilePlaceholder}>
                <Text style={s.profileInitial}>{getUserInitials()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Profile dropdown menu */}
        {showProfileMenu && (
          <Modal
            visible={showProfileMenu}
            transparent
            animationType="fade"
            onRequestClose={() => setShowProfileMenu(false)}
          >
            <TouchableOpacity
              style={s.menuBackdrop}
              activeOpacity={1}
              onPress={() => setShowProfileMenu(false)}
            >
              <View style={s.menuCard}>
                <TouchableOpacity
                  style={s.menuItem}
                  onPress={handleSettingsClick}
                  activeOpacity={0.7}
                >
                  <IconSymbol name="gearshape.fill" size={20} color="#F5F5F5" />
                  <Text style={s.menuItemText}>Settings</Text>
                </TouchableOpacity>

                <View style={s.menuDivider} />

                <TouchableOpacity
                  style={[s.menuItem, isLoggingOut && { opacity: 0.5 }]}
                  onPress={performLogout}
                  disabled={isLoggingOut}
                  activeOpacity={0.7}
                >
                  <IconSymbol
                    name="rectangle.portrait.and.arrow.right"
                    size={20}
                    color="#FF2A2A"
                  />
                  <Text style={[s.menuItemText, { color: "#FF2A2A" }]}>
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* ══════════════════════════════════════════
         *  BODY ROW  — sidebar nav + page content
         * ════════════════════════════════════════ */}
        <View style={s.bodyRow}>
          {/* Sidebar nav — also driven by widthAnim */}
          <Animated.View style={[s.sidebar, { width: widthAnim }]}>
            {navItems.map(({ name, label, icon, path }) => {
              const active = isActive(path);
              return (
                <TouchableOpacity
                  key={name}
                  style={[s.navItem, active && s.navItemActive]}
                  onPress={() => router.push(path as any)}
                  activeOpacity={0.7}
                >
                  <View style={s.iconSlot}>
                    <IconSymbol
                      name={icon}
                      size={26}
                      color={active ? ACTIVE : INACTIVE}
                    />
                  </View>
                  <Text
                    style={[s.navLabel, active && s.navLabelActive]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>

          {/* Page content */}
          <View style={s.content}>
            <Tabs
              screenOptions={{
                headerShown: false,
                tabBarStyle: { display: "none" },
              }}
              initialRouteName="index"
            >
              <Tabs.Screen name="index" options={{ title: "Overview" }} />
              <Tabs.Screen name="projects" options={{ title: "Projects" }} />
              <Tabs.Screen name="explore" options={{ title: "Unearthed" }} />
              <Tabs.Screen name="messages" options={{ title: "Messages" }} />
              <Tabs.Screen name="settings" options={{ title: "Settings" }} />
              <Tabs.Screen name="gps" options={{ href: null }} />
              <Tabs.Screen name="dm/[userId]" options={{ href: null }} />
              <Tabs.Screen
                name="emonument"
                options={{ href: canAccessEmonument ? "/emonument" : null }}
              />
            </Tabs>
          </View>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

/* ─────────────────────────────────────────────
 *  Styles
 * ─────────────────────────────────────────── */
const s = StyleSheet.create({
  /* Outer container — column */
  shell: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: "#111111",
  },

  /* ── Header row — always full width, never animates ─── */
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
    color: "#F5F5F5",
    letterSpacing: 2,
  },

  /* ── Body row ──────────────────────────────── */
  bodyRow: {
    flex: 1,
    flexDirection: "row",
  },

  /* Sidebar nav — same bg as page for seamless look */
  sidebar: {
    backgroundColor: PAGE_BG,
    overflow: "hidden",
    paddingTop: 4,
    paddingBottom: 8,
    paddingLeft: 12,
  },

  /* ── Nav items ─────────────────────────────── */
  /* Each item is full-height row. Icon always in fixed-width slot. */
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
    color: INACTIVE,
    flexShrink: 1,
  },
  navLabelActive: {
    color: ACTIVE,
    fontWeight: "600",
  },

  /* Fixed-width icon column — icons stay centred when collapsed */
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

  /* ── Profile button ────────────────────────── */
  profileBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
    overflow: "hidden",
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  profilePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F5F5F5",
  },

  /* ── Profile dropdown menu ───────────────── */
  menuBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "flex-end",
    paddingTop: ROW_H,
    paddingRight: 16,
  },
  menuCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#F5F5F5",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#2A2A2A",
    marginHorizontal: 12,
  },
});

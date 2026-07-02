/**
 * @file
 * iOS-specific tab bar layout.
 *
 * Configures tab navigation with iOS-native styling.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import React, { useState, useCallback } from "react";
import {
  DynamicColorIOS,
  Platform,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Image,
  Modal,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/contexts/AuthContext";
import UsernamePromptModal from "@/components/UsernamePromptModal";
import { useColorScheme } from "@/hooks/use-color-scheme";

// Active color for tab items
const ACTIVE_COLOR = "#FF2A2A";
const isLiquidGlass = parseInt(String(Platform.Version), 10) >= 26;

export default function TabLayout() {
  const { user, logout } = useAuth();
  const canAccessEMonument = Boolean(
    user?.is_emonument_privileged || user?.is_dashboard_admin,
  );
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const textColor = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const surfaceColor = isDarkMode ? "#1E1E1E" : "#FFFFFF";
  const borderColor = isDarkMode ? "#2A2A2A" : "#D9D9D9";
  const profilePlaceholderColor = isDarkMode ? "#2A2A2A" : "#E8E8E8";
  const menuBackdropColor = isDarkMode ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.18)";
  const [usernameSet, setUsernameSet] = useState(false);
  const needsUsername = !!user && !user.username && !usernameSet;
  const handleUsernameComplete = useCallback(() => setUsernameSet(true), []);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const getUserInitials = () => {
    if (!user) return "?";
    if (user.display_name) return user.display_name.charAt(0).toUpperCase();
    if (user.username) return user.username.charAt(0).toUpperCase();
    if (user.email) return user.email.charAt(0).toUpperCase();
    return "?";
  };

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

  const handleSettingsClick = useCallback(() => {
    setShowProfileMenu(false);
    requestAnimationFrame(() => {
      router.push("/settings");
    });
  }, [router]);

  return (
    <>
      <UsernamePromptModal
        visible={needsUsername}
        onComplete={handleUsernameComplete}
      />

      <View style={{ flex: 1 }}>
        <NativeTabs
          minimizeBehavior="onScrollDown"
          tintColor={DynamicColorIOS({ dark: ACTIVE_COLOR, light: ACTIVE_COLOR })}
          labelStyle={{
            color: DynamicColorIOS({ dark: "#9A9A9A", light: "#666666" }),
          }}
          {...(!isLiquidGlass && {
            barStyle: {
              backgroundColor: DynamicColorIOS({
                dark: "rgba(17, 17, 17, 0.85)",
                light: "rgba(255, 255, 255, 0.85)",
              }),
            },
          })}
        >
          {/* Overview - Landing tab (default) */}
          <NativeTabs.Trigger name="index">
            <Label>Overview</Label>
            <Icon sf={{ default: "house", selected: "house.fill" }} />
          </NativeTabs.Trigger>

          {/* Projects - All projects list */}
          <NativeTabs.Trigger name="projects">
            <Label>Projects</Label>
            <Icon sf={{ default: "folder", selected: "folder.fill" }} />
          </NativeTabs.Trigger>

          {/* Unearthed - Public projects & user search */}
          <NativeTabs.Trigger name="explore">
            <Label>Unearthed</Label>
            <Icon
              sf={{ default: "globe.americas", selected: "globe.americas.fill" }}
            />
          </NativeTabs.Trigger>

          {/* Messages - DM Inbox */}
          <NativeTabs.Trigger name="messages">
            <Label>Messages</Label>
            <Icon sf={{ default: "message", selected: "message.fill" }} />
          </NativeTabs.Trigger>

          {/* eMonument - shown only for privileged users */}
          {canAccessEMonument ? (
            <NativeTabs.Trigger name="emonument">
              <Label>eMonument</Label>
              <Icon
                sf={{
                  default: "building.columns",
                  selected: "building.columns.fill",
                }}
              />
            </NativeTabs.Trigger>
          ) : (
            <NativeTabs.Trigger name="emonument" hidden>
              <Label>eMonument</Label>
            </NativeTabs.Trigger>
          )}

          {/* Hidden tabs - not shown in tab bar */}
          <NativeTabs.Trigger name="gps" hidden>
            <Label>GPS</Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="dm/[userId]" hidden>
            <Label>DM</Label>
          </NativeTabs.Trigger>
        </NativeTabs>

        {/* Floating profile button */}
        <TouchableOpacity
          style={[s.profileBtn, { top: insets.top + 8, right: 16 }]}
          onPress={() => setShowProfileMenu((v) => !v)}
          activeOpacity={0.8}
        >
          {user?.photo_url ? (
            <Image source={{ uri: user.photo_url }} style={s.profileImage} />
          ) : (
            <View
              style={[
                s.profilePlaceholder,
                { backgroundColor: profilePlaceholderColor },
              ]}
            >
              <Text style={[s.profileInitial, { color: textColor }]}>
                {getUserInitials()}
              </Text>
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
          <View style={[s.menuBackdrop, { paddingTop: insets.top + 48 }]}>
            <Pressable
              style={[s.menuOverlay, { backgroundColor: menuBackdropColor }]}
              onPress={() => setShowProfileMenu(false)}
            />
            <View
              style={[s.menuCard, { backgroundColor: surfaceColor, borderColor }]}
              onStartShouldSetResponder={() => true}
            >
              <TouchableOpacity
                style={s.menuItem}
                onPress={handleSettingsClick}
                activeOpacity={0.7}
              >
                <IconSymbol name="gearshape.fill" size={20} color={textColor} />
                <Text style={[s.menuItemText, { color: textColor }]}>Settings</Text>
              </TouchableOpacity>

              <View style={[s.menuDivider, { backgroundColor: borderColor }]} />

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
          </View>
        </Modal>
      )}
    </>
  );
}

const s = StyleSheet.create({
  profileBtn: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    zIndex: 100,
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  profilePlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitial: {
    fontSize: 15,
    fontWeight: "700",
  },
  menuBackdrop: {
    flex: 1,
    alignItems: "flex-end",
    paddingRight: 16,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  menuCard: {
    zIndex: 2,
    borderRadius: 12,
    borderWidth: 1,
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
  },
  menuDivider: {
    height: 1,
    marginHorizontal: 12,
  },
});

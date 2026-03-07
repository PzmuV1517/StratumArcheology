/**
 * @file
 * iOS-specific tab bar layout.
 *
 * Configures tab navigation with iOS-native styling.
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
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import React, { useState, useCallback } from "react";
import {
  DynamicColorIOS,
  Platform,
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/src/contexts/AuthContext";
import UsernamePromptModal from "@/src/components/UsernamePromptModal";

// Active color for tab items
const ACTIVE_COLOR = "#FF2A2A";
const isLiquidGlass = parseInt(String(Platform.Version), 10) >= 26;

export default function TabLayout() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const handleSettingsClick = () => {
    setShowProfileMenu(false);
    router.push("/(tabs)/settings");
  };

  return (
    <>
    <UsernamePromptModal visible={needsUsername} onComplete={handleUsernameComplete} />

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
          <Icon sf={{ default: "globe.americas", selected: "globe.americas.fill" }} />
        </NativeTabs.Trigger>

        {/* Messages - DM Inbox */}
        <NativeTabs.Trigger name="messages">
          <Label>Messages</Label>
          <Icon sf={{ default: "message", selected: "message.fill" }} />
        </NativeTabs.Trigger>

        {/* Settings - hidden from tab bar, accessible via profile menu */}
        <NativeTabs.Trigger name="settings" hidden>
          <Label>Settings</Label>
        </NativeTabs.Trigger>

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
          style={[s.menuBackdrop, { paddingTop: insets.top + 48 }]}
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
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitial: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F5F5F5",
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "flex-end",
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

/**
 * @file
 * Main tab bar layout.
 *
 * Configures the bottom tab navigation with icons and labels
 * for the main application sections.
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
import { Tabs, useRouter } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Image,
  Modal,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/contexts/AuthContext";
import UsernamePromptModal from "@/components/UsernamePromptModal";
import { useColorScheme } from "@/hooks/use-color-scheme";

const ACTIVE_COLOR = "#FF2A2A";

export default function TabLayout() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const inactiveColor = isDarkMode ? "#9A9A9A" : "#666666";
  const pageBackground = isDarkMode ? "#111111" : "#F7F7F7";
  const surfaceColor = isDarkMode ? "#1A1A1A" : "#FFFFFF";
  const borderColor = isDarkMode ? "#2A2A2A" : "#D9D9D9";
  const textColor = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const profilePlaceholderColor = isDarkMode ? "#2A2A2A" : "#E8E8E8";
  const menuBackdropColor = isDarkMode ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.18)";
  const tabBorderColor = isDarkMode
    ? "rgba(255, 255, 255, 0.1)"
    : "rgba(0, 0, 0, 0.1)";
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
    // Defer navigation until after the profile menu closes.
    setTimeout(() => {
      router.push("/settings");
    }, 0);
  }, [router]);

  /* ── Profile button shown in each tab header ── */
  const ProfileButton = () => (
    <TouchableOpacity
      style={styles.profileBtn}
      onPress={() => setShowProfileMenu((v) => !v)}
      activeOpacity={0.8}
    >
      {user?.photo_url ? (
        <Image source={{ uri: user.photo_url }} style={styles.profileImage} />
      ) : (
        <View
          style={[
            styles.profilePlaceholder,
            { backgroundColor: profilePlaceholderColor },
          ]}
        >
          <Text style={[styles.profileInitial, { color: textColor }]}>
            {getUserInitials()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <>
      <UsernamePromptModal
        visible={needsUsername}
        onComplete={handleUsernameComplete}
      />

      {/* Profile dropdown menu */}
      {showProfileMenu && (
        <Modal
          visible={showProfileMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowProfileMenu(false)}
        >
          <View style={styles.menuBackdrop}>
            <Pressable
              style={[styles.menuOverlay, { backgroundColor: menuBackdropColor }]}
              onPress={() => setShowProfileMenu(false)}
            />
            <View
              style={[
                styles.menuCard,
                { backgroundColor: surfaceColor, borderColor },
              ]}
            >
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleSettingsClick}
                activeOpacity={0.7}
              >
                <IconSymbol name="gearshape.fill" size={20} color={textColor} />
                <Text style={[styles.menuItemText, { color: textColor }]}>
                  Settings
                </Text>
              </TouchableOpacity>

              <View style={[styles.menuDivider, { backgroundColor: borderColor }]} />

              <TouchableOpacity
                style={[styles.menuItem, isLoggingOut && { opacity: 0.5 }]}
                onPress={performLogout}
                disabled={isLoggingOut}
                activeOpacity={0.7}
              >
                <IconSymbol
                  name="rectangle.portrait.and.arrow.right"
                  size={20}
                  color="#FF2A2A"
                />
                <Text style={[styles.menuItemText, { color: "#FF2A2A" }]}>
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <Tabs
        screenOptions={{
          tabBarActiveTintColor: ACTIVE_COLOR,
          tabBarInactiveTintColor: inactiveColor,
          headerShown: true,
          headerStyle: { backgroundColor: pageBackground },
          headerTintColor: textColor,
          headerTitleStyle: { fontWeight: "700", fontSize: 17 },
          headerRight: () => <ProfileButton />,
          tabBarStyle: {
            backgroundColor: surfaceColor,
            borderTopColor: tabBorderColor,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 0.3,
          },
        }}
        initialRouteName="index"
      >
        {/* Overview - Landing tab */}
        <Tabs.Screen
          name="index"
          options={{
            title: "Overview",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="house.fill" color={color} />
            ),
          }}
        />

        {/* Projects - All projects list */}
        <Tabs.Screen
          name="projects"
          options={{
            title: "Projects",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="folder.fill" color={color} />
            ),
          }}
        />

        {/* Unearthed - Public projects & user search */}
        <Tabs.Screen
          name="explore"
          options={{
            title: "Unearthed",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="globe.americas.fill" color={color} />
            ),
          }}
        />

        {/* Messages - DM Inbox */}
        <Tabs.Screen
          name="messages"
          options={{
            title: "Messages",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="message.fill" color={color} />
            ),
          }}
        />

        {/* Hide GPS tab from navigation */}
        <Tabs.Screen
          name="gps"
          options={{
            href: null,
          }}
        />

        {/* Hide DM route from tab bar */}
        <Tabs.Screen
          name="dm/[userId]"
          options={{
            href: null,
          }}
        />

        {/* Hidden eMonument tab (accessible from Settings) */}
        <Tabs.Screen
          name="emonument"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  /* ── Profile button ────────────────────────── */
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 14,
    overflow: "hidden",
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

  /* ── Profile dropdown menu ───────────────── */
  menuBackdrop: {
    flex: 1,
    alignItems: "flex-end",
    paddingTop: 54,
    paddingRight: 16,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  menuCard: {
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
    flexDirection: "row" as const,
    alignItems: "center" as const,
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

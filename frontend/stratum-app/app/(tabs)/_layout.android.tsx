/**
 * @file
 * Android-specific tab bar layout.
 *
 * Configures tab navigation with Material Design styling.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/contexts/AuthContext";
import UsernamePromptModal from "@/components/UsernamePromptModal";
import { useColorScheme } from "@/hooks/use-color-scheme";

const ACTIVE_COLOR = "#FF2A2A";

export default function TabLayout() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const inactiveColor = isDarkMode ? "#9A9A9A" : "#666666";
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
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: ACTIVE_COLOR,
            tabBarInactiveTintColor: inactiveColor,
            headerShown: false,
            tabBarStyle: {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: surfaceColor,
              borderTopColor: tabBorderColor,
              borderTopWidth: StyleSheet.hairlineWidth,
              height: 84,
              paddingBottom: 24,
              paddingTop: 8,
              elevation: 8,
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
    elevation: 10,
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

/**
 * @file
 * Android-specific tab bar layout.
 *
 * Configures tab navigation with Material Design styling.
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
  Image,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/contexts/AuthContext";
import UsernamePromptModal from "@/components/UsernamePromptModal";

const ACTIVE_COLOR = "#FF2A2A";
const INACTIVE_COLOR = "#9A9A9A";

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
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: ACTIVE_COLOR,
          tabBarInactiveTintColor: INACTIVE_COLOR,
          headerShown: false,
          tabBarStyle: {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#1A1A1A",
            borderTopColor: "rgba(255, 255, 255, 0.1)",
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

        {/* Settings - hidden from tab bar, accessible via profile menu */}
        <Tabs.Screen
          name="settings"
          options={{
            href: null,
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

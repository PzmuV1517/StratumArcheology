/**
 * @file
 * Project detail layout.
 *
 * Configures the navigation structure for individual
 * project detail views.
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
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Share,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Stack, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import styles from "@/src/components/project/ProjectDetailStyles";
import ProjectOverlays from "@/src/components/project/ProjectOverlays";
import {
  ProjectDetailProvider,
  useProjectDetail,
} from "@/src/contexts/ProjectDetailContext";
import {
  ProjectGalleryScreen,
  ProjectMapScreen,
  ProjectHistoryScreen,
  ProjectToolsScreen,
} from "@/src/components/project/ProjectTabsScreens";

let NativeToolbar: React.FC<any> | null = null;
let NativeToolbarButton: React.FC<any> | null = null;
let NativeToolbarMenu: React.FC<any> | null = null;
if (Platform.OS === "ios") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lr = require("liquid-react");
  NativeToolbar = lr.NativeToolbar;
  NativeToolbarButton = lr.NativeToolbarButton;
  NativeToolbarMenu = lr.NativeToolbarMenu;
}

type FullScreenModal = "gallery" | "gps" | "history" | "tools" | null;

function ProjectStack() {
  const {
    loading,
    project,
    setShowFilesOverlay,
    setShowMenu,
    setShowMembersModal,
    onDeleteProject,
  } = useProjectDetail();
  const showHeaderActions = !!project && !loading;
  const insets = useSafeAreaInsets();
  const [activeModal, setActiveModal] = useState<FullScreenModal>(null);

  const moreMenuItems = [
    { id: "gallery", title: "Gallery", icon: "photo.on.rectangle" },
    { id: "gps", title: "GPS Map", icon: "map" },
    { id: "history", title: "Time Machine", icon: "clock.arrow.circlepath" },
    { id: "tools", title: "Tools", icon: "wrench.and.screwdriver" },
    {
      id: "settings",
      title: "Project Settings",
      icon: "gearshape",
      children: [
        { id: "edit", title: "Edit Project", icon: "pencil" },
        { id: "members", title: "Members", icon: "person.2" },
        { id: "export", title: "Export Project", icon: "square.and.arrow.up" },
        {
          id: "exit",
          title: "Exit Project",
          icon: "rectangle.portrait.and.arrow.right",
          destructive: true,
        },
        { id: "delete", title: "Delete Project", icon: "trash", destructive: true },
      ],
    },
  ];

  const handleMenuAction = (event: {
    nativeEvent: { id: string; title: string };
  }) => {
    const { id } = event.nativeEvent;
    switch (id) {
      case "edit":
        setShowMenu(true);
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
      case "exit":
        router.back();
        break;
      case "delete":
        onDeleteProject();
        break;
      case "gallery":
      case "gps":
      case "history":
      case "tools":
        // Open full-screen modal on iOS
        setActiveModal(id as FullScreenModal);
        break;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: true,
          headerTransparent: Platform.OS === "ios",
          headerBlurEffect: undefined,
          headerStyle:
            Platform.OS === "ios"
              ? { backgroundColor: "transparent" }
              : { backgroundColor: "#111111" },
          headerShadowVisible: Platform.OS !== "ios",
          headerTintColor: "#FF2A2A",
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{
            headerTitle: loading ? "Loading..." : project ? "" : "Project Not Found",
            headerTitleStyle: {
              color: project ? "transparent" : "#F5F5F5",
              fontSize: 18,
              fontWeight: "600",
            },
            headerBackTitle: "Projects",
            headerBackVisible: true,
            presentation: "card",
            headerLeft: () => {
              if (Platform.OS === "ios") {
                return (
                  <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      height: 44,
                      marginLeft: -8,
                      paddingRight: 20,
                    }}
                    activeOpacity={0.6}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <IconSymbol
                      name="chevron.backward"
                      size={22}
                      color="#FF2A2A"
                      style={{ marginLeft: 20, marginTop: -9 }}
                    />
                    <Text
                      style={{
                        color: "#FF2A2A",
                        fontSize: 17,
                        marginLeft: 0,
                        lineHeight: 22,
                        marginTop: -9,
                      }}
                    >
                      Projects
                    </Text>
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    height: 44,
                    paddingRight: 16,
                    paddingLeft: 8,
                  }}
                  activeOpacity={0.6}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <IconSymbol name="chevron.backward" size={22} color="#FF2A2A" />
                  <Text
                    style={{
                      color: "#FF2A2A",
                      fontSize: 16,
                      marginLeft: 4,
                      fontWeight: "500",
                    }}
                  >
                    Projects
                  </Text>
                </TouchableOpacity>
              );
            },
            headerRight: () => {
              if (!showHeaderActions) return null;

              // iOS uses standalone NativeToolbar, so no headerRight needed
              if (Platform.OS === "ios") return null;

              return (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={() => setShowFilesOverlay(true)}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                  >
                    <IconSymbol name="folder.fill" size={20} color="#FF2A2A" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowMenu(true)}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                  >
                    <IconSymbol name="line.3.horizontal" size={20} color="#FF2A2A" />
                  </TouchableOpacity>
                </View>
              );
            },
          }}
        />
      </Stack>
      {Platform.OS === "ios" &&
        showHeaderActions &&
        NativeToolbar &&
        NativeToolbarButton &&
        NativeToolbarMenu && (
          <NativeToolbar
            style={{
              position: "absolute",
              top: insets.top,
              right: 0,
              width: 120,
              height: 44,
              zIndex: 100,
            }}
            onToolbarButtonPress={(event: { nativeEvent: { icon: string } }) => {
              const { icon } = event.nativeEvent;
              if (icon === "folder.fill") {
                setShowFilesOverlay(true);
              }
            }}
            onToolbarMenuAction={handleMenuAction}
          >
            <NativeToolbarButton icon="folder.fill" />
            <NativeToolbarMenu icon="ellipsis.circle" menuItems={moreMenuItems} />
          </NativeToolbar>
        )}

      {/* Full-screen modals for iOS */}
      {Platform.OS === "ios" && (
        <>
          <Modal
            visible={activeModal === "gallery"}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setActiveModal(null)}
          >
            <View style={modalStyles.container}>
              <ModalHeader title="Gallery" onBack={() => setActiveModal(null)} />
              <ProjectGalleryScreen />
            </View>
          </Modal>

          <Modal
            visible={activeModal === "gps"}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setActiveModal(null)}
          >
            <View style={modalStyles.container}>
              <ModalHeader title="GPS Map" onBack={() => setActiveModal(null)} />
              <ProjectMapScreen />
            </View>
          </Modal>

          <Modal
            visible={activeModal === "history"}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setActiveModal(null)}
          >
            <View style={modalStyles.container}>
              <ModalHeader
                title="Time Machine"
                onBack={() => setActiveModal(null)}
              />
              <ProjectHistoryScreen />
            </View>
          </Modal>

          <Modal
            visible={activeModal === "tools"}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setActiveModal(null)}
          >
            <View style={modalStyles.container}>
              <ModalHeader title="Tools" onBack={() => setActiveModal(null)} />
              <ProjectToolsScreen />
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}

function ModalHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={modalStyles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={modalStyles.backButton}
        activeOpacity={0.6}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <IconSymbol name="chevron.backward" size={20} color="#FF2A2A" />
        <Text style={modalStyles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={modalStyles.headerTitle}>{title}</Text>
      <View style={modalStyles.headerSpacer} />
    </View>
  );
}

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#111111",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333333",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 70,
  },
  backText: {
    color: "#FF2A2A",
    fontSize: 17,
    marginLeft: 4,
  },
  headerTitle: {
    color: "#F5F5F5",
    fontSize: 17,
    fontWeight: "600",
  },
  headerSpacer: {
    minWidth: 70,
  },
});

export default function ProjectLayout() {
  return (
    <ProjectDetailProvider>
      <View style={styles.safeArea}>
        <View style={styles.container}>
          <ProjectStack />
          <ProjectOverlays />
        </View>
      </View>
    </ProjectDetailProvider>
  );
}

/**
 * @file
 * Module for gallery functionality.
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
import React, { useState, useCallback } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  ProjectGalleryScreen,
  ProjectMoreScreen,
  ProjectMapScreen,
  ProjectHistoryScreen,
  ProjectToolsScreen,
} from "@/src/components/project/ProjectTabsScreens";

type MoreSubScreen = "hub" | "gallery" | "gps" | "history" | "tools";

export default function ProjectGalleryRoute() {
  const [subScreen, setSubScreen] = useState<MoreSubScreen>("hub");

  // Reset to hub whenever we leave this tab
  useFocusEffect(
    useCallback(() => {
      return () => setSubScreen("hub");
    }, []),
  );

  if (Platform.OS !== "ios") {
    return <ProjectGalleryScreen />;
  }

  switch (subScreen) {
    case "gallery":
      return <ProjectGalleryScreen onBack={() => setSubScreen("hub")} />;
    case "gps":
      return <ProjectMapScreen onBack={() => setSubScreen("hub")} />;
    case "history":
      return <ProjectHistoryScreen onBack={() => setSubScreen("hub")} />;
    case "tools":
      return <ProjectToolsScreen onBack={() => setSubScreen("hub")} />;
    default:
      return <ProjectMoreScreen onNavigate={setSubScreen} />;
  }
}

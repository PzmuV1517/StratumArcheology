/**
 * @file
 * Additional tools bottom sheet component.
 *
 * Displays secondary project tools in a draggable bottom sheet.
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
import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface MoreToolsItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onNavigate: (
    tab: "gallery" | "gps" | "history" | "tools" | "wheeler" | "chat",
  ) => void;
}

const ITEMS: {
  key: "gallery" | "gps" | "history" | "tools" | "wheeler" | "chat";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "chat", label: "Project Chat", icon: "chatbubbles" },
  { key: "gallery", label: "Gallery", icon: "images" },
  { key: "gps", label: "GPS Map", icon: "map" },
  { key: "history", label: "Time Machine", icon: "time" },
  { key: "tools", label: "Tools", icon: "construct" },
  { key: "wheeler", label: "Wheeler Notation", icon: "analytics-outline" },
];

export default function MoreToolsSheet({ visible, onClose, onNavigate }: Props) {
  const handlePress = (
    tab: "gallery" | "gps" | "history" | "tools" | "wheeler" | "chat",
  ) => {
    onClose();
    // Small delay so the modal dismisses before navigation
    setTimeout(() => onNavigate(tab), 150);
  };

  const content = (
    <>
      {ITEMS.map((item, i) => (
        <TouchableOpacity
          key={item.key}
          style={[s.row, i < ITEMS.length - 1 && s.rowBorder]}
          activeOpacity={0.6}
          onPress={() => handlePress(item.key)}
        >
          <Ionicons name={item.icon} size={20} color="#FF2A2A" style={s.rowIcon} />
          <Text style={s.rowLabel}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={16} color="#555" />
        </TouchableOpacity>
      ))}
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>{content}</View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  sheet: {
    backgroundColor: "#1E1E1A",
    borderRadius: 16,
    padding: 8,
    width: "100%",
    maxWidth: 320,
    borderWidth: 1,
    borderColor: "#333",
  },
  sheetGlass: {
    borderRadius: 20,
    padding: 8,
    width: "100%",
    maxWidth: 320,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  rowIcon: {
    marginRight: 14,
    width: 24,
    textAlign: "center",
  },
  rowLabel: {
    flex: 1,
    color: "#F5F5F5",
    fontSize: 16,
    fontWeight: "600",
  },
});

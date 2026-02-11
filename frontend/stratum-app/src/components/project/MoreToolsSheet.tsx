import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeMaterialView } from "liquid-react";

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
  onNavigate: (tab: "gallery" | "gps" | "history" | "tools") => void;
}

const ITEMS: {
  key: "gallery" | "gps" | "history" | "tools";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "gallery", label: "Gallery", icon: "images" },
  { key: "gps", label: "GPS Map", icon: "map" },
  { key: "history", label: "Time Machine", icon: "time" },
  { key: "tools", label: "Tools", icon: "construct" },
];

export default function MoreToolsSheet({ visible, onClose, onNavigate }: Props) {
  const handlePress = (tab: "gallery" | "gps" | "history" | "tools") => {
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
        {Platform.OS === "ios" ? (
          <NativeMaterialView material="systemMaterial" style={s.sheetGlass}>{content}</NativeMaterialView>
        ) : (
          <View style={s.sheet}>{content}</View>
        )}
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

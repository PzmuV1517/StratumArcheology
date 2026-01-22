// Platform entry point for AudioPanel
// React Native automatically resolves to .web.tsx or .native.tsx based on platform
import { Platform } from "react-native";

export interface AudioPanelProps {
  audioUrl: string;
}

let AudioPanel: React.ComponentType<AudioPanelProps>;

if (Platform.OS === "web") {
  AudioPanel = require("./AudioPanel.web").default;
} else {
  AudioPanel = require("./AudioPanel.native").default;
}

export default AudioPanel;

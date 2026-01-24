import { Platform } from "react-native";

export interface AudioPanelProps {
  audioUrl: string;
}

const AudioPanel =
  Platform.OS === "web"
    ? require("./AudioPanel.web").default
    : require("./AudioPanel.native").default;

export default AudioPanel;

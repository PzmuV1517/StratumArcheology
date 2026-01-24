import { Platform } from "react-native";

export interface VideoPanelProps {
  src: string | null;
  name?: string;
}

const VideoPanel =
  Platform.OS === "web"
    ? require("./VideoPanel.web").default
    : require("./VideoPanel.native").default;

export default VideoPanel;

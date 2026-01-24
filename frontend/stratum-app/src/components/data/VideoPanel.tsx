import { Platform } from "react-native";

const VideoPanel =
  Platform.OS === "web"
    ? require("./VideoPanel.web").default
    : require("./VideoPanel.native").default;

export default VideoPanel;

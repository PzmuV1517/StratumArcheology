import { Platform } from "react-native";

const PointCloudPanel =
  Platform.OS === "web"
    ? require("./PointCloudPanel.web").default
    : require("./PointCloudPanel.native").default;

export default PointCloudPanel;

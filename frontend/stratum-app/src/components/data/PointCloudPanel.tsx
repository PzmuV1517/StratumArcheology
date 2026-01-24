import { Platform } from "react-native";

export interface PointCloudPanelProps {
  src: string | null;
  name?: string;
}

const PointCloudPanel =
  Platform.OS === "web"
    ? require("./PointCloudPanel.web").default
    : require("./PointCloudPanel.native").default;

export default PointCloudPanel;

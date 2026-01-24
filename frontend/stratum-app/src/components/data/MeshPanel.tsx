import { Platform } from "react-native";

export interface MeshPanelProps {
  src: string | null;
  name?: string;
}

const MeshPanel =
  Platform.OS === "web"
    ? require("./MeshPanel.web").default
    : require("./MeshPanel.native").default;

export default MeshPanel;

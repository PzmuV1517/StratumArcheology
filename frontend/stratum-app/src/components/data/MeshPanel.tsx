import { Platform } from "react-native";

const MeshPanel =
  Platform.OS === "web"
    ? require("./MeshPanel.web").default
    : require("./MeshPanel.native").default;

export default MeshPanel;

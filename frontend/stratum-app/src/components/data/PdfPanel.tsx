import { Platform } from "react-native";

const PdfPanel =
  Platform.OS === "web"
    ? require("./PdfPanel.web").default
    : require("./PdfPanel.native").default;

export default PdfPanel;

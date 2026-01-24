import { Platform } from "react-native";

export interface PdfPanelProps {
  pdfUrl: string;
}

const PdfPanel =
  Platform.OS === "web"
    ? require("./PdfPanel.web").default
    : require("./PdfPanel.native").default;

export default PdfPanel;

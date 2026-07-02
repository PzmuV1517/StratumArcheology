/**
 * @file
 * PDF viewer panel component (platform-agnostic entry point).
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { Platform } from "react-native";

export interface PdfPanelProps {
  pdfUrl: string;
}

const PdfPanel =
  Platform.OS === "web"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./PdfPanel.web").default
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./PdfPanel.native").default;

export default PdfPanel;

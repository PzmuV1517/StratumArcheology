/**
 * @file
 * Audio player panel component (platform-agnostic entry point).
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { Platform } from "react-native";

export interface AudioPanelProps {
  audioUrl: string;
}

const AudioPanel =
  Platform.OS === "web"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./AudioPanel.web").default
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./AudioPanel.native").default;

export default AudioPanel;

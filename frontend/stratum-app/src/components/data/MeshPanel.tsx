/**
 * @file
 * 3D mesh viewer panel component (platform-agnostic entry point).
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { Platform } from "react-native";

export interface MeshPanelProps {
  src: string | null;
  name?: string;
}

const MeshPanel =
  Platform.OS === "web"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./MeshPanel.web").default
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./MeshPanel.native").default;

export default MeshPanel;

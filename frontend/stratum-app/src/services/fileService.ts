/**
 * @file
 * File management service (platform-agnostic entry point).
 *
 * Re-exports platform-specific file service implementations
 * for web and native platforms.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
// Cross-platform file service entry point
// This file uses Metro's platform-specific resolution
// When imported, Metro will automatically resolve to:
// - fileService.web.ts on web
// - fileService.native.ts on iOS/Android

import { Platform } from "react-native";

export * from "./fileService.core";

// Platform-specific imports
// Metro bundler will resolve these based on platform
/** Platform-resolved file service instance (web or native). */
let fileService: any;

if (Platform.OS === "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  fileService = require("./fileService.web").fileService;
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  fileService = require("./fileService.native").fileService;
}

export { fileService };
export default fileService;

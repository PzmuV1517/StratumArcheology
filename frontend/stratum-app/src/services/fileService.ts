// Cross-platform file service entry point
// This file uses Metro's platform-specific resolution
// When imported, Metro will automatically resolve to:
// - fileService.web.ts on web
// - fileService.native.ts on iOS/Android

import { Platform } from "react-native";

// Re-export types from core
export * from "./fileService.core";

// Platform-specific imports
// Metro bundler will resolve these based on platform
let fileService: any;

if (Platform.OS === "web") {
  fileService = require("./fileService.web").fileService;
} else {
  fileService = require("./fileService.native").fileService;
}

export { fileService };
export default fileService;

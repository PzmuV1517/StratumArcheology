/**
 * @file
 * File management service (platform-agnostic entry point).
 *
 * Re-exports platform-specific file service implementations
 * for web and native platforms.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
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

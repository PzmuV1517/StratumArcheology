/**
 * @file
 * TypeScript declarations for optional peer modules.
 *
 * These packages are deliberately not installed. Every call site loads
 * them with a dynamic import inside a try/catch and degrades gracefully
 * when they are absent (plain-text markdown, "install xlsx to preview"),
 * so they stay out of the bundle until someone opts in. The declarations
 * exist only so the optional import type-checks.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
declare module "xlsx";
declare module "react-native-markdown-display";

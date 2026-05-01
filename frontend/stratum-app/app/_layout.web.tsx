/**
 * @file
 * Web-specific root layout.
 *
 * Configures web-specific navigation and layout behavior.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import "./globals.css";
// Explicitly import the non-web layout to avoid a platform resolution cycle

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Layout = require("./_layout.tsx").default;
export default Layout;

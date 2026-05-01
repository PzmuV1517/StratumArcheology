/**
 * @file
 * Harris Matrix components barrel export.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { Platform } from "react-native";

// Re-export with platform resolution
// Note: The bundler (Metro/webpack) handles .web.tsx and .native.tsx extensions
// This file serves as a TypeScript type reference

const HarrisMatrix = Platform.select({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  web: () => require("./HarrisMatrix.web").default,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  default: () => require("./HarrisMatrix.native").default,
})?.();

export default HarrisMatrix;
export { getHarrisMatrixHTML } from "./HarrisMatrixHTML";

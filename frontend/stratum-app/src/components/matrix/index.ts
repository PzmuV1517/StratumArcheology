/**
 * @file
 * Harris Matrix entry point.
 *
 * The bundler picks HarrisMatrix.web.tsx or HarrisMatrix.native.tsx by
 * platform; both take { projectId, canEdit } and share everything in core/.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */

export { default } from "./HarrisMatrix";
export { buildGraph } from "./core/graph";
export { layoutGraph } from "./core/layout";
export { parseDocument } from "./core/model";
export { loadMatrix, saveMatrix } from "./core/store";

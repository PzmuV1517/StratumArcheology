/**
 * @file
 * Hooks barrel export.
 *
 * Re-exports all custom hooks for convenient importing.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
// Export all hooks
export { useAuth } from "./useAuth";
export type { UseAuthReturn } from "./useAuth";

export { useProject } from "./useProject";
export type { UseProjectReturn } from "./useProject";

export { useActivity } from "./useActivity";
export type { UseActivityReturn } from "./useActivity";

export { useNotes } from "./useNotes";
export type { UseNotesReturn } from "./useNotes";

export { useFiles } from "./useFiles";
export type { UseFilesReturn } from "./useFiles";
